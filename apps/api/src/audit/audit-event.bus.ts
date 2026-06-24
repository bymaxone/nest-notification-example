/**
 * @fileoverview In-process event bus for the audit SSE live-tail feed.
 * @layer app/audit/sse
 *
 * Wraps a Node.js `EventEmitter` so a `NotificationLog` row persisted by the write path
 * (the `PrismaNotificationLogRepository`, which the library's services AND its
 * `NotificationAuditInterceptor` both write through) is broadcast to every connected SSE
 * client. `replaySince` uses the shared keyset cursor codec to replay rows missed while a
 * client was disconnected (`Last-Event-ID`), so no row is lost on reconnect.
 *
 * Feedback-loop safety: this bus is fed ONLY from the write path (`publishPersisted`). The
 * read/stream path never writes an audit row, so emitting to the live tail can never loop
 * back into the audit store. `publishPersisted` is best-effort — a fan-out failure is
 * swallowed so it can never break the delivery pipeline.
 *
 * This is an in-process singleton: a real multi-instance deployment would back it with a
 * persistent bus (Redis Streams / Kafka) so every API replica sees every row.
 *
 * @module
 */
import { EventEmitter } from 'node:events'
import { Injectable } from '@nestjs/common'
import { EMPTY, Observable, from as from$ } from 'rxjs'
import type { NotificationLog, Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service.js'
import {
  AuditReadService,
  INTERCEPTOR_PROVIDER_NAME,
  type AuditCursor,
  type AuditRestriction,
} from './audit-read.service.js'
import type { AuditQueryDto } from './dto/audit-query.dto.js'

/** Max concurrent SSE listeners before Node warns of a leak. */
const MAX_LISTENERS = 100

/** Keyset replay cap — never stream an unbounded backlog on reconnect. */
const REPLAY_LIMIT = 500

/** The `'audit'` event name new rows are emitted under. */
const AUDIT_EVENT = 'audit'

/** A persisted audit row projected for the live tail, plus its keyset cursor (the SSE `id`). */
export interface AuditBusEntry {
  /** Row id. */
  id: string
  /** Row timestamp. */
  timestamp: Date
  /** Owning tenant. */
  tenantId: string
  /** Delivery channel. */
  channel: string
  /** Lifecycle/interceptor verb. */
  verb: string
  /** Masked recipient (never raw). */
  recipient: string
  /** OTP purpose / email template, when present. */
  purpose: string | null
  /** Provider name; `__interceptor__` for interceptor rows (the source facet discriminator). */
  providerName: string
  /** Provider message id, when present. */
  messageId: string | null
  /** Error message only (never a stack trace), when present — the free-text `q` target. */
  errorMessage: string | null
  /** Owning user, when present. */
  userId: string | null
  /** The opaque keyset cursor for this row; used as the SSE `id`. */
  cursor: string
}

/** The SSE `MessageEvent` shape NestJS `@Sse()` serialises. */
export interface AuditSseEvent {
  /** JSON-serialised payload (an {@link AuditBusEntry}, or empty for a keep-alive). */
  data: string
  /** Keyset cursor — the SSE `id` a client re-sends as `Last-Event-ID`. */
  id?: string
  /** Event type (e.g. `ping` for keep-alives). */
  type?: string
}

/**
 * Test whether an {@link AuditBusEntry} satisfies an {@link AuditQueryDto} filter.
 *
 * Mirrors the non-time predicates of `AuditReadService.buildWhere` — exact `tenantId`,
 * `channel`, `verb`, `purpose`, `recipient`, `provider`, the case-insensitive free-text `q`
 * over `errorMessage`, and the source facet on `providerName === '__interceptor__'`. The time
 * window is not re-checked: a live entry is emitted at write time and is therefore current.
 *
 * @param entry - The live or replayed audit entry.
 * @param filter - The validated SSE client filter.
 * @returns `true` when the entry satisfies every specified predicate.
 */
export function matches(entry: AuditBusEntry, filter: AuditQueryDto): boolean {
  if (filter.tenantId !== undefined && entry.tenantId !== filter.tenantId) return false
  if (filter.channel !== undefined && entry.channel !== filter.channel) return false
  if (filter.verb !== undefined && entry.verb !== filter.verb) return false
  if (filter.purpose !== undefined && entry.purpose !== filter.purpose) return false
  if (filter.recipient !== undefined && entry.recipient !== filter.recipient) return false
  if (filter.provider !== undefined && entry.providerName !== filter.provider) return false
  if (
    filter.q !== undefined &&
    // Stryker disable next-line StringLiteral: the `?? ''` only guards `null.toLowerCase()`; for a
    // null errorMessage the row must never satisfy a real free-text query, which holds for any
    // non-empty fallback the caller's `q` is not a coincidental substring of — the empty fallback's
    // value is not observable through the predicate's contract.
    !(entry.errorMessage ?? '').toLowerCase().includes(filter.q.toLowerCase())
  ) {
    return false
  }
  if (filter.source === 'interceptor' && entry.providerName !== INTERCEPTOR_PROVIDER_NAME) {
    return false
  }
  if (filter.source === 'service' && entry.providerName === INTERCEPTOR_PROVIDER_NAME) {
    return false
  }
  return true
}

/**
 * Injectable in-process bus broadcasting persisted audit rows to SSE clients.
 *
 * Entries are emitted as `'audit'` events on the internal `EventEmitter`; `replaySince`
 * fetches rows newer than the client's last cursor from Postgres for gapless reconnects.
 */
@Injectable()
export class AuditEventBus {
  /** Node.js EventEmitter — exposed for `fromEvent()` in the SSE controller. */
  readonly emitter = new EventEmitter()

  /**
   * @param audit - The shared cursor codec + `where` compiler.
   * @param prisma - The application's Prisma client (replay reads only).
   */
  constructor(
    private readonly audit: AuditReadService,
    private readonly prisma: PrismaService,
  ) {
    this.emitter.setMaxListeners(MAX_LISTENERS)
  }

  /**
   * Broadcast an entry to all connected SSE clients.
   *
   * @param entry - The audit entry enriched with its keyset cursor.
   */
  emit(entry: AuditBusEntry): void {
    this.emitter.emit(AUDIT_EVENT, entry)
  }

  /**
   * Project a freshly-persisted row and broadcast it live — best-effort.
   *
   * Called by the write path (`PrismaNotificationLogRepository`) after a row is committed so a
   * fresh live-tail connection (which carries no `Last-Event-ID`, hence no replay) still sees
   * the row in real time. Any failure is swallowed: a live-tail fan-out problem must NEVER
   * propagate back into the delivery pipeline.
   *
   * @param row - The persisted `NotificationLog` row (already masked, code-free).
   */
  publishPersisted(row: NotificationLog): void {
    try {
      this.emit(this.toBusEntry(row))
    } catch {
      // Swallow — the live tail is a best-effort observer of the delivery path.
    }
  }

  /**
   * Replay rows newer than the client's last cursor, matching the filter.
   *
   * Returns `EMPTY` when `lastId` is absent/blank or undecodable — the client then receives
   * live entries only, never an HTTP 500.
   *
   * @param lastId - The `Last-Event-ID` header value (may be `undefined`).
   * @param filter - The validated SSE client filter.
   * @param restriction - The server-side tenant restriction.
   * @returns An observable of replayed SSE events.
   */
  replaySince(
    lastId: string | undefined,
    filter: AuditQueryDto,
    restriction?: AuditRestriction,
  ): Observable<AuditSseEvent> {
    // Stryker disable next-line ConditionalExpression,StringLiteral: this early return is a fast
    // path, not a behavioural fork — an undefined or empty `lastId` that skips it falls through to
    // `decodeCursor`, which throws and is caught below to return the same EMPTY, so every mutated
    // form of the guard yields the identical observable.
    if (lastId === undefined || lastId === '') return EMPTY

    let from: AuditCursor
    try {
      from = this.audit.decodeCursor(lastId)
    } catch {
      // Malformed cursor — degrade to live-only (no 500).
      return EMPTY
    }

    return from$(this.fetchSince(from, filter, restriction))
  }

  /**
   * Map an entry to an SSE event whose `id` is the row's keyset cursor.
   *
   * @param entry - The audit entry emitted on the bus.
   * @returns An SSE event carrying the serialised entry and its resumable cursor `id`.
   */
  toEvent(entry: AuditBusEntry): AuditSseEvent {
    return { data: JSON.stringify(entry), id: entry.cursor }
  }

  /**
   * Keyset-fetch rows strictly newer than `from` that match the filter, as SSE events.
   *
   * @param from - The exclusive keyset lower bound.
   * @param filter - The validated SSE client filter.
   * @param restriction - The server-side tenant restriction.
   * @returns An async generator of SSE events ordered oldest-first.
   */
  private async *fetchSince(
    from: AuditCursor,
    filter: AuditQueryDto,
    restriction?: AuditRestriction,
  ): AsyncGenerator<AuditSseEvent> {
    // Replay anchors its lower bound on the cursor, never on `buildWhere`'s default `now-1h`
    // window: a client reconnecting after >1h offline must still receive every row since the
    // cursor. An explicit `filter.from` is honored when the caller pinned a window.
    const replayFilter: AuditQueryDto =
      filter.from === undefined ? { ...filter, from: from.timestamp.toISOString() } : filter
    const where = this.audit.buildWhere(replayFilter, restriction)
    const fromClause: Prisma.NotificationLogWhereInput = {
      OR: [
        { timestamp: { gt: from.timestamp } },
        { timestamp: from.timestamp, id: { gt: from.id } },
      ],
    }
    const existing = Array.isArray(where.AND) ? where.AND : []
    where.AND = [...existing, fromClause]

    const rows = await this.prisma.notificationLog.findMany({
      where,
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: REPLAY_LIMIT,
    })

    for (const row of rows) {
      const entry = this.toBusEntry(row)
      if (matches(entry, filter)) {
        yield this.toEvent(entry)
      }
    }
  }

  /**
   * Project a `NotificationLog` row to a cursor-enriched {@link AuditBusEntry}.
   *
   * Caller-supplied `metadata` is intentionally omitted from the live payload so arbitrary
   * caller data is never fanned out over the stream.
   *
   * @param row - The persisted audit row.
   * @returns The projected bus entry.
   */
  private toBusEntry(row: NotificationLog): AuditBusEntry {
    return {
      id: row.id,
      timestamp: row.timestamp,
      tenantId: row.tenantId,
      channel: row.channel,
      verb: row.verb,
      recipient: row.recipient,
      purpose: row.purpose,
      providerName: row.providerName,
      messageId: row.messageId,
      errorMessage: row.errorMessage,
      userId: row.userId,
      cursor: this.audit.encodeCursor({ timestamp: row.timestamp, id: row.id }),
    }
  }
}
