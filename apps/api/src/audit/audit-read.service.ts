/**
 * @fileoverview Keyset cursor codec + Prisma `where` compiler shared by every `/audit/*` read endpoint.
 * @layer app/audit/service
 *
 * One opaque keyset cursor codec (`encodeCursor`/`decodeCursor` over `{ timestamp, id }`,
 * base64url JSON) and one `AuditQueryDto → Prisma.NotificationLogWhereInput` compiler live here
 * so `GET /audit/logs`, the SSE replay, and `GET /audit/aggregate` filter the delivery audit log
 * identically. The cursor is opaque — clients never see the `timestamp`/`id` in plaintext.
 *
 * RBAC: callers pass an optional `restriction` `{ tenantId }` that is ANDed into the `where` and
 * cannot be widened by the incoming query — the restriction always wins (anti-spoof).
 *
 * Source facet: rows written by the library's `NotificationAuditInterceptor` carry
 * `providerName === '__interceptor__'` (the HTTP-boundary `sent`/`failed` view); service verbs
 * carry the real provider name. The `source` filter maps to a `providerName` predicate so a
 * reader can keep "what the service did" apart from "what the HTTP boundary saw".
 *
 * @module
 */
import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import type { AuditQueryDto } from './dto/audit-query.dto.js'

/**
 * The reserved `providerName` the library's `NotificationAuditInterceptor` stamps on every
 * `sent`/`failed` row it writes. This is the discriminator behind the source facet.
 */
export const INTERCEPTOR_PROVIDER_NAME = '__interceptor__'

/** Default lookback window when a query omits `from`: one hour before now, in milliseconds. */
const DEFAULT_WINDOW_MS = 60 * 60 * 1000

/**
 * Thrown when {@link AuditReadService.decodeCursor} receives a value that is not a valid keyset
 * cursor. Controllers map this to HTTP 410 Gone so clients know to restart pagination; the SSE
 * replay path degrades to live-only instead.
 */
export class StaleCursorError extends Error {
  /**
   * @param message - Human-readable reason; defaults to a stable description.
   */
  constructor(message = 'cursor is stale or malformed') {
    super(message)
    this.name = 'StaleCursorError'
  }
}

/** RBAC restriction injected by callers — overrides the incoming query's `tenantId`. */
export interface AuditRestriction {
  /** The trusted, server-resolved tenant id; cannot be widened by a query param. */
  tenantId?: string
}

/** The decoded keyset cursor components. */
export interface AuditCursor {
  /** The last-seen row's timestamp. */
  timestamp: Date
  /** The last-seen row's id (tie-breaker within the same millisecond). */
  id: string
}

/**
 * Shared keyset cursor codec and audit `where` compiler.
 *
 * @example
 * ```typescript
 * const where = service.buildWhere(query, { tenantId: 'acme' })
 * const cursor = service.encodeCursor({ timestamp: row.timestamp, id: row.id })
 * ```
 */
@Injectable()
export class AuditReadService {
  /**
   * Encode a keyset cursor as an opaque base64url string.
   *
   * @param cursor - The last row's `timestamp` and `id`.
   * @returns Base64url-encoded JSON cursor (opaque to clients).
   */
  encodeCursor(cursor: AuditCursor): string {
    const payload = JSON.stringify({ t: cursor.timestamp.toISOString(), i: cursor.id })
    return Buffer.from(payload).toString('base64url')
  }

  /**
   * Decode an opaque base64url cursor back to `{ timestamp, id }`.
   *
   * @param value - Base64url-encoded cursor from a prior response.
   * @returns The decoded cursor components.
   * @throws {StaleCursorError} When the cursor is missing, malformed, or carries an invalid date/id.
   */
  decodeCursor(value: string): AuditCursor {
    try {
      const json = Buffer.from(value, 'base64url').toString('utf8')
      const parsed = JSON.parse(json) as { t: unknown; i: unknown }
      const timestamp = new Date(parsed.t as string)
      if (Number.isNaN(timestamp.getTime()) || typeof parsed.i !== 'string') {
        throw new Error('bad cursor')
      }
      return { timestamp, id: parsed.i }
    } catch {
      throw new StaleCursorError()
    }
  }

  /**
   * Compile an {@link AuditQueryDto} into a Prisma `NotificationLog` where clause.
   *
   * Applies the time window (default `now-1h`..`now`), the tenant scope (the `restriction`
   * wins over `q.tenantId`), exact `channel`/`verb`/`purpose`/`recipient`/`provider` matches,
   * a case-insensitive free-text `contains` over `errorMessage`, and the source facet.
   *
   * @param q - Validated filter DTO.
   * @param restriction - Optional RBAC restriction; takes precedence over `q.tenantId`.
   * @returns A Prisma where clause for the `notification_logs` table.
   */
  buildWhere(q: AuditQueryDto, restriction?: AuditRestriction): Prisma.NotificationLogWhereInput {
    const from = new Date(q.from ?? new Date(Date.now() - DEFAULT_WINDOW_MS).toISOString())
    const to = new Date(q.to ?? new Date().toISOString())
    const where: Prisma.NotificationLogWhereInput = { timestamp: { gte: from, lte: to } }

    // RBAC: restriction.tenantId wins — it cannot be widened by the incoming query.
    const tenantId = restriction?.tenantId ?? q.tenantId
    if (tenantId !== undefined) where.tenantId = tenantId

    if (q.channel !== undefined) where.channel = q.channel
    if (q.verb !== undefined) where.verb = q.verb
    if (q.purpose !== undefined) where.purpose = q.purpose
    if (q.recipient !== undefined) where.recipient = q.recipient
    if (q.provider !== undefined) where.providerName = q.provider
    if (q.q !== undefined) where.errorMessage = { contains: q.q, mode: 'insensitive' }

    // Source facet, composed via AND so it never clashes with an explicit `provider` filter.
    // `where.AND` is unset here, so a fresh single-element array is always correct; the
    // controllers append their keyset clause to it later.
    const sourcePredicate = this.sourcePredicate(q.source)
    if (sourcePredicate !== undefined) {
      where.AND = [sourcePredicate]
    }

    return where
  }

  /**
   * Map the `source` facet to a `providerName` predicate fragment.
   *
   * @param source - `'interceptor'` ⇒ only interceptor rows; `'service'` ⇒ exclude them;
   *   `undefined` ⇒ no source predicate.
   * @returns A `where` fragment, or `undefined` when no source filter is requested.
   */
  private sourcePredicate(
    source: AuditQueryDto['source'],
  ): Prisma.NotificationLogWhereInput | undefined {
    if (source === 'interceptor') return { providerName: INTERCEPTOR_PROVIDER_NAME }
    if (source === 'service') return { providerName: { not: INTERCEPTOR_PROVIDER_NAME } }
    return undefined
  }
}
