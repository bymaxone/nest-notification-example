/**
 * Unit tests for {@link AuditEventBus} and the {@link matches} predicate.
 *
 * Covers `matches` per field + the source facet + the free-text `q` over a null/non-null
 * `errorMessage`; `emit` fan-out; `publishPersisted` (happy path + the best-effort swallow);
 * `replaySince` (undefined/empty/malformed → EMPTY, valid → keyset replay, non-matching rows
 * filtered, the source-seeded vs fresh `AND`, the exact Prisma call shape); `toEvent`; and the
 * constructor's `setMaxListeners`.
 */
import { describe, expect, it, jest } from '@jest/globals'
import { firstValueFrom, toArray } from 'rxjs'
import type { NotificationLog } from '@prisma/client'

import type { PrismaService } from '../prisma/prisma.service.js'
import { AuditReadService, INTERCEPTOR_PROVIDER_NAME } from './audit-read.service.js'
import {
  AuditEventBus,
  matches,
  type AuditBusEntry,
  type AuditSseEvent,
} from './audit-event.bus.js'
import { auditQuerySchema, type AuditQueryDto } from './dto/audit-query.dto.js'

/** Build a bus over a real (pure) `AuditReadService` and a controllable Prisma mock. */
function buildBus(rows: NotificationLog[] = []) {
  const findMany = jest.fn<(args: unknown) => Promise<NotificationLog[]>>().mockResolvedValue(rows)
  const prisma = { notificationLog: { findMany } } as unknown as PrismaService
  const audit = new AuditReadService()
  return { bus: new AuditEventBus(audit, prisma), audit, findMany }
}

/** Build a `NotificationLog` row used by `publishPersisted` / `fetchSince`. */
function makeRow(overrides: Partial<NotificationLog> = {}): NotificationLog {
  return {
    id: 'row-1',
    timestamp: new Date('2026-06-23T12:00:00.000Z'),
    tenantId: 'acme',
    channel: 'otp',
    verb: 'generated',
    recipient: 'j***@acme.com',
    purpose: 'email_verification',
    providerName: 'memory',
    messageId: null,
    errorMessage: null,
    userId: null,
    metadata: null,
    ...overrides,
  } as NotificationLog
}

/** Build an `AuditBusEntry` for `matches` predicate tests. */
function makeEntry(overrides: Partial<AuditBusEntry> = {}): AuditBusEntry {
  return {
    id: 'row-1',
    timestamp: new Date('2026-06-23T12:00:00.000Z'),
    tenantId: 'acme',
    channel: 'otp',
    verb: 'generated',
    recipient: 'j***@acme.com',
    purpose: 'email_verification',
    providerName: 'memory',
    messageId: null,
    errorMessage: 'gateway declined',
    userId: null,
    cursor: 'cursor-1',
    ...overrides,
  }
}

/** Parse raw params through the real schema so predicates receive a typed filter. */
function filter(raw: Record<string, unknown> = {}): AuditQueryDto {
  return auditQuerySchema.parse(raw)
}

describe('matches()', () => {
  it('returns true when every specified predicate is satisfied', () => {
    /** A fully-matching entry against a multi-field filter must pass. */
    expect(
      matches(
        makeEntry(),
        filter({
          tenantId: 'acme',
          channel: 'otp',
          verb: 'generated',
          purpose: 'email_verification',
          recipient: 'j***@acme.com',
          provider: 'memory',
          q: 'declined',
        }),
      ),
    ).toBe(true)
  })

  it('rejects a tenant mismatch', () => {
    /** A row from another tenant must never match a tenant-scoped filter. */
    expect(matches(makeEntry({ tenantId: 'globex' }), filter({ tenantId: 'acme' }))).toBe(false)
  })

  it('rejects a channel mismatch', () => {
    /** A `channel=email` filter must reject an `otp` row. */
    expect(matches(makeEntry({ channel: 'otp' }), filter({ channel: 'email' }))).toBe(false)
  })

  it('rejects a verb mismatch', () => {
    /** A `verb=sent` filter must reject a `generated` row. */
    expect(matches(makeEntry({ verb: 'generated' }), filter({ verb: 'sent' }))).toBe(false)
  })

  it('rejects a purpose mismatch', () => {
    /** A `purpose=password_reset` filter must reject an `email_verification` row. */
    expect(
      matches(makeEntry({ purpose: 'email_verification' }), filter({ purpose: 'password_reset' })),
    ).toBe(false)
  })

  it('rejects a recipient mismatch', () => {
    /** Recipient is exact-match (already masked); a different masked recipient is excluded. */
    expect(matches(makeEntry(), filter({ recipient: 'x***@acme.com' }))).toBe(false)
  })

  it('rejects a provider mismatch', () => {
    /** A `provider=nodemailer` filter must reject a `memory` row. */
    expect(matches(makeEntry({ providerName: 'memory' }), filter({ provider: 'nodemailer' }))).toBe(
      false,
    )
  })

  it('rejects when free-text q is absent from errorMessage', () => {
    /** `q` searches `errorMessage`; a non-substring must fail. */
    expect(matches(makeEntry({ errorMessage: 'success' }), filter({ q: 'declined' }))).toBe(false)
  })

  it('treats a null errorMessage as empty for the q search', () => {
    /** A row with no error message can never satisfy a free-text `q` (the `?? ''` arm). */
    expect(matches(makeEntry({ errorMessage: null }), filter({ q: 'declined' }))).toBe(false)
  })

  it('source=interceptor rejects a non-interceptor row', () => {
    /** The interceptor view excludes service-provider rows. */
    expect(matches(makeEntry({ providerName: 'memory' }), filter({ source: 'interceptor' }))).toBe(
      false,
    )
  })

  it('source=interceptor accepts an interceptor row', () => {
    /** An `__interceptor__` row passes the interceptor facet. */
    expect(
      matches(
        makeEntry({ providerName: INTERCEPTOR_PROVIDER_NAME }),
        filter({ source: 'interceptor' }),
      ),
    ).toBe(true)
  })

  it('source=service rejects an interceptor row', () => {
    /** The service view excludes interceptor rows. */
    expect(
      matches(
        makeEntry({ providerName: INTERCEPTOR_PROVIDER_NAME }),
        filter({ source: 'service' }),
      ),
    ).toBe(false)
  })

  it('source=service accepts a service row', () => {
    /** A real-provider row passes the service facet. */
    expect(matches(makeEntry({ providerName: 'memory' }), filter({ source: 'service' }))).toBe(true)
  })
})

describe('AuditEventBus.emit', () => {
  it('fans the entry out to listeners on the audit event', () => {
    /** `emit` must broadcast on `'audit'` so the SSE `fromEvent` source receives live rows. */
    const { bus } = buildBus()
    const received: AuditBusEntry[] = []
    bus.emitter.on('audit', (e) => received.push(e as AuditBusEntry))

    const entry = makeEntry()
    bus.emit(entry)

    expect(received).toEqual([entry])
  })
})

describe('AuditEventBus.publishPersisted', () => {
  it('projects and broadcasts a committed row with its keyset cursor', () => {
    /** A persisted row is projected (metadata dropped) and emitted with its resumable cursor id. */
    const { bus, audit } = buildBus()
    const received: AuditBusEntry[] = []
    bus.emitter.on('audit', (e) => received.push(e as AuditBusEntry))

    const row = makeRow()
    bus.publishPersisted(row)

    expect(received).toHaveLength(1)
    const entry = received[0] as AuditBusEntry
    expect(entry.cursor).toBe(audit.encodeCursor({ timestamp: row.timestamp, id: row.id }))
    expect(entry).not.toHaveProperty('metadata')
  })

  it('swallows a projection failure without throwing back into the delivery path', () => {
    /**
     * If cursor encoding throws (a defensive impossibility), `publishPersisted` must swallow it
     * — the live tail is best-effort and can never break delivery. No entry is emitted.
     */
    const { bus, audit } = buildBus()
    jest.spyOn(audit, 'encodeCursor').mockImplementation(() => {
      throw new Error('encode boom')
    })
    const received: AuditBusEntry[] = []
    bus.emitter.on('audit', (e) => received.push(e as AuditBusEntry))

    expect(() => bus.publishPersisted(makeRow())).not.toThrow()
    expect(received).toHaveLength(0)
  })
})

describe('AuditEventBus.replaySince', () => {
  it('returns EMPTY when lastId is undefined', async () => {
    /** No prior position ⇒ replay is skipped (live-only). */
    const { bus } = buildBus()
    const out = await firstValueFrom(bus.replaySince(undefined, filter()).pipe(toArray()))
    expect(out).toHaveLength(0)
  })

  it('returns EMPTY for an empty-string lastId', async () => {
    /** An empty `Last-Event-ID` is treated like "no prior position". */
    const { bus } = buildBus()
    const out = await firstValueFrom(bus.replaySince('', filter()).pipe(toArray()))
    expect(out).toHaveLength(0)
  })

  it('returns EMPTY for a malformed lastId (no 500)', async () => {
    /** An undecodable cursor degrades gracefully to live-only. */
    const { bus } = buildBus()
    const out = await firstValueFrom(bus.replaySince('!!!bad!!!', filter()).pipe(toArray()))
    expect(out).toHaveLength(0)
  })

  it('replays keyset rows newer than the cursor as SSE events', async () => {
    /** A valid cursor triggers a keyset fetch; each matching row maps to an SSE event. */
    const newer = makeRow({ id: 'row-2', timestamp: new Date('2026-06-23T13:00:00.000Z') })
    const { bus, audit } = buildBus([newer])
    const lastId = audit.encodeCursor({ timestamp: new Date('2026-06-23T12:00:00Z'), id: 'row-1' })

    const out = await firstValueFrom(bus.replaySince(lastId, filter()).pipe(toArray()))

    expect(out).toHaveLength(1)
    const event = out[0] as AuditSseEvent
    expect(event.id).toBe(audit.encodeCursor({ timestamp: newer.timestamp, id: newer.id }))
    const data = JSON.parse(event.data) as AuditBusEntry
    expect(data.id).toBe('row-2')
  })

  it('drops replayed rows that fail the client filter', async () => {
    /** `fetchSince` re-applies `matches` per row so a non-matching row is not yielded. */
    const nonMatching = makeRow({ id: 'row-2', channel: 'otp' })
    const { bus, audit } = buildBus([nonMatching])
    const lastId = audit.encodeCursor({ timestamp: new Date('2026-06-23T11:00:00Z'), id: 'row-0' })

    const out = await firstValueFrom(
      bus.replaySince(lastId, filter({ channel: 'email' })).pipe(toArray()),
    )

    expect(out).toHaveLength(0)
  })

  it('seeds a fresh AND with just the keyset clause when no source facet is present', async () => {
    /** Covers the `Array.isArray(where.AND)` false arm in `fetchSince`. */
    const { bus, audit, findMany } = buildBus([])
    const lastId = audit.encodeCursor({ timestamp: new Date('2026-06-23T11:00:00Z'), id: 'row-0' })

    await firstValueFrom(bus.replaySince(lastId, filter()).pipe(toArray()))

    const passed = findMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } }
    expect(passed.where.AND).toHaveLength(1)
  })

  it('appends the keyset clause onto the source-facet AND', async () => {
    /** Covers the `Array.isArray(where.AND)` true arm: a source filter pre-seeds the AND. */
    const { bus, audit, findMany } = buildBus([])
    const lastId = audit.encodeCursor({ timestamp: new Date('2026-06-23T11:00:00Z'), id: 'row-0' })

    await firstValueFrom(bus.replaySince(lastId, filter({ source: 'service' })).pipe(toArray()))

    const passed = findMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } }
    expect(passed.where.AND).toHaveLength(2)
  })

  it('queries with ascending order and a 500-row cap', async () => {
    /** Replay is time-ordered oldest-first and capped so a reconnect never floods. */
    const { bus, audit, findMany } = buildBus([])
    const lastId = audit.encodeCursor({ timestamp: new Date('2026-06-23T11:00:00Z'), id: 'row-0' })

    await firstValueFrom(bus.replaySince(lastId, filter()).pipe(toArray()))

    const args = findMany.mock.calls[0]?.[0] as { orderBy: unknown; take: number }
    expect(args.orderBy).toEqual([{ timestamp: 'asc' }, { id: 'asc' }])
    expect(args.take).toBe(500)
  })

  it('builds the strictly-newer gt keyset OR clause', async () => {
    /** The replay lower bound is exclusive: `(timestamp > t) OR (timestamp = t AND id > id)`. */
    const anchor = new Date('2026-06-23T11:00:00.000Z')
    const { bus, audit, findMany } = buildBus([])
    const lastId = audit.encodeCursor({ timestamp: anchor, id: 'row-0' })

    await firstValueFrom(bus.replaySince(lastId, filter()).pipe(toArray()))

    const passed = findMany.mock.calls[0]?.[0] as { where: { AND: Array<{ OR: unknown[] }> } }
    const orClause = passed.where.AND[0] as { OR: unknown[] }
    expect(orClause.OR[0]).toEqual({ timestamp: { gt: anchor } })
    expect(orClause.OR[1]).toEqual({ timestamp: anchor, id: { gt: 'row-0' } })
  })

  it('replays rows older than the default 1h window by anchoring on the cursor', async () => {
    /**
     * Resumable-live-tail contract: a client offline for >1h reconnects with a cursor whose
     * timestamp predates `buildWhere`'s default `now-1h` window. The replay lower bound is
     * derived from the cursor (not the default window), so the row is still replayed and the
     * compiled `timestamp.gte` equals the cursor timestamp rather than `now-1h`.
     */
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const staleRow = makeRow({
      id: 'row-stale',
      timestamp: new Date(threeHoursAgo.getTime() + 1000),
    })
    const { bus, audit, findMany } = buildBus([staleRow])
    const lastId = audit.encodeCursor({ timestamp: threeHoursAgo, id: 'row-anchor' })

    const out = await firstValueFrom(bus.replaySince(lastId, filter()).pipe(toArray()))

    // The row older than the default window is replayed, not dropped by a stale lower bound.
    expect(out).toHaveLength(1)
    const passed = findMany.mock.calls[0]?.[0] as { where: { timestamp: { gte: Date } } }
    expect(passed.where.timestamp.gte).toEqual(threeHoursAgo)
    expect(passed.where.timestamp.gte.getTime()).toBeLessThan(Date.now() - 60 * 60 * 1000)
  })

  it('honors an explicit from window instead of the cursor anchor', async () => {
    /**
     * When the caller pins an explicit `from`, the replay respects that window rather than
     * deriving the lower bound from the cursor — covers the explicit-window branch.
     */
    const explicitFrom = new Date('2026-06-23T10:00:00.000Z')
    const { bus, audit, findMany } = buildBus([])
    const lastId = audit.encodeCursor({ timestamp: new Date('2026-06-23T09:00:00Z'), id: 'row-0' })

    await firstValueFrom(
      bus.replaySince(lastId, filter({ from: explicitFrom.toISOString() })).pipe(toArray()),
    )

    const passed = findMany.mock.calls[0]?.[0] as { where: { timestamp: { gte: Date } } }
    expect(passed.where.timestamp.gte).toEqual(explicitFrom)
  })
})

describe('AuditEventBus.toEvent', () => {
  it('uses the entry cursor as the SSE id', () => {
    /** The SSE `id` must be the keyset cursor so a reconnect resumes from this row. */
    const { bus } = buildBus()
    const event = bus.toEvent(makeEntry({ cursor: 'cursor-xyz' }))
    expect(event.id).toBe('cursor-xyz')
    expect(JSON.parse(event.data)).toMatchObject({ id: 'row-1' })
  })
})

describe('AuditEventBus construction', () => {
  it('raises the emitter maxListeners to 100 for many concurrent SSE clients', () => {
    /** Without the bump, many live-tail clients would trip Node's leak warning. */
    const { bus } = buildBus()
    expect(bus.emitter.getMaxListeners()).toBe(100)
  })
})
