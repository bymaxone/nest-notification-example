/**
 * Unit tests for {@link AuditController}.
 *
 * A mocked `PrismaService` (just `notificationLog.findMany`) and a real {@link AuditReadService}
 * back the controller. Covers the first page (no cursor), a mid page (cursor → keyset clause
 * appended onto an existing source-facet `AND`), the last page (`hasMore=false`,
 * `nextCursor=null`), the HTTP-410 stale-cursor path, and the non-stale rethrow.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { GoneException } from '@nestjs/common'
import type { NotificationLog } from '@prisma/client'

import type { PrismaService } from '../prisma/prisma.service.js'
import { AuditController } from './audit.controller.js'
import { AuditReadService, StaleCursorError } from './audit-read.service.js'
import type { AuditAggregateService, AuditAggregateRow } from './audit-aggregate.service.js'
import { auditQuerySchema, type AuditQueryDto } from './dto/audit-query.dto.js'
import { auditAggregateQuerySchema } from './dto/audit-aggregate-query.dto.js'

/** Mock surface of `PrismaService` the controller touches. */
type FindMany = jest.Mock<(args: unknown) => Promise<NotificationLog[]>>

/** Mock surface of `AuditAggregateService.query`. */
type AggregateQuery = jest.Mock<(q: unknown) => Promise<AuditAggregateRow[]>>

/** Build a controller over a `findMany` mock + a real cursor codec + an aggregate mock. */
function buildController(rows: NotificationLog[]): {
  controller: AuditController
  audit: AuditReadService
  findMany: FindMany
  aggregateQuery: AggregateQuery
} {
  const findMany = jest.fn<(args: unknown) => Promise<NotificationLog[]>>().mockResolvedValue(rows)
  const prisma = { notificationLog: { findMany } } as unknown as PrismaService
  const audit = new AuditReadService()
  const aggregateQuery = jest
    .fn<(q: unknown) => Promise<AuditAggregateRow[]>>()
    .mockResolvedValue([])
  const aggregate = { query: aggregateQuery } as unknown as AuditAggregateService
  return {
    controller: new AuditController(prisma, audit, aggregate),
    audit,
    findMany,
    aggregateQuery,
  }
}

/** Build a `NotificationLog`-shaped row for the page assertions. */
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

/** Parse raw query params through the real schema so the handler receives a typed DTO. */
function parse(raw: Record<string, unknown>): AuditQueryDto {
  return auditQuerySchema.parse(raw)
}

const TENANT = 'acme'

describe('AuditController.list', () => {
  let row: NotificationLog

  beforeEach(() => {
    row = makeRow()
  })

  it('returns the first page with a nextCursor when a full page is fetched (no cursor)', async () => {
    /**
     * Scenario: first page, `limit=1`, one row returned ⇒ a full page.
     * Contract: no cursor clause is applied, `hasMore` is true, and `nextCursor` encodes the
     * last row so the client can page forward.
     */
    const { controller, audit, findMany } = buildController([row])
    const result = await controller.list(TENANT, parse({ limit: '1' }))

    expect(result.hasMore).toBe(true)
    expect(result.data).toEqual([row])
    expect(result.nextCursor).toBe(audit.encodeCursor({ timestamp: row.timestamp, id: row.id }))
    // No cursor supplied ⇒ the where carries no keyset AND clause.
    const passed = findMany.mock.calls[0]?.[0] as { where: { AND?: unknown } }
    expect(passed.where.AND).toBeUndefined()
  })

  it('appends the keyset clause onto an existing source-facet AND on a mid page', async () => {
    /**
     * Scenario: a cursor is supplied alongside `source=service`, so `buildWhere` already seeded
     * `where.AND` with the source predicate.
     * Contract: the keyset OR clause is appended (covers the `Array.isArray(where.AND)` true arm),
     * giving a two-element AND, and the rows are ordered timestamp/id descending.
     */
    const { controller, audit, findMany } = buildController([row])
    const cursor = audit.encodeCursor({
      timestamp: new Date('2026-06-23T13:00:00.000Z'),
      id: 'row-9',
    })
    await controller.list(TENANT, parse({ limit: '1', source: 'service', cursor }))

    const passed = findMany.mock.calls[0]?.[0] as {
      where: { AND: unknown[] }
      orderBy: unknown
    }
    expect(passed.where.AND).toHaveLength(2)
    expect(passed.orderBy).toEqual([{ timestamp: 'desc' }, { id: 'desc' }])
  })

  it('seeds a fresh AND for the keyset clause when no source facet is present', async () => {
    /**
     * Scenario: a cursor with no `source` filter.
     * Contract: `where.AND` was undefined, so the keyset clause seeds a single-element array
     * (covers the `Array.isArray(where.AND)` false arm).
     */
    const { controller, audit, findMany } = buildController([row])
    const cursor = audit.encodeCursor({ timestamp: row.timestamp, id: row.id })
    await controller.list(TENANT, parse({ limit: '5', cursor }))

    const passed = findMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } }
    expect(passed.where.AND).toHaveLength(1)
  })

  it('scopes the where to the trusted tenant and builds the exact keyset OR clause', async () => {
    /**
     * Scenario: a decodable cursor with no source facet.
     * Contract: the `where` carries the trusted `tenantId`, and the appended keyset clause is the
     * strictly-older tuple `(timestamp < t) OR (timestamp = t AND id < id)` — pinning the tenant
     * restriction object and every nested predicate of the cursor clause.
     */
    const { controller, audit, findMany } = buildController([row])
    const ts = new Date('2026-06-23T13:00:00.000Z')
    const cursor = audit.encodeCursor({ timestamp: ts, id: 'row-9' })

    await controller.list(TENANT, parse({ limit: '5', cursor }))

    const passed = findMany.mock.calls[0]?.[0] as {
      where: { tenantId: string; AND: Array<{ OR: unknown[] }> }
    }
    expect(passed.where.tenantId).toBe(TENANT)
    const keyset = passed.where.AND[0] as { OR: unknown[] }
    expect(keyset.OR[0]).toEqual({ timestamp: { lt: ts } })
    expect(keyset.OR[1]).toEqual({ timestamp: ts, id: { lt: 'row-9' } })
  })

  it('returns the last page with hasMore=false and nextCursor=null', async () => {
    /**
     * Scenario: fewer rows than `limit` come back ⇒ the last page.
     * Contract: `hasMore` is false and `nextCursor` is null (covers the ternary false arm).
     */
    const { controller } = buildController([row])
    const result = await controller.list(TENANT, parse({ limit: '50' }))

    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
  })

  it('maps a stale cursor to HTTP 410 Gone with a restart-pagination message', async () => {
    /**
     * Scenario: a malformed/foreign cursor.
     * Contract: `decodeCursor` throws `StaleCursorError`, which the handler maps to a
     * `GoneException` (HTTP 410) whose message tells the client to restart pagination.
     */
    const { controller } = buildController([row])
    await expect(controller.list(TENANT, parse({ cursor: 'garbage!!!' }))).rejects.toBeInstanceOf(
      GoneException,
    )
    await expect(controller.list(TENANT, parse({ cursor: 'garbage!!!' }))).rejects.toThrow(
      /stale.*restart/,
    )
  })

  it('rethrows a non-stale decode error unchanged', async () => {
    /**
     * Scenario: `decodeCursor` throws an unexpected (non-stale) error.
     * Contract: the handler rethrows it verbatim rather than masking it as a 410 — covers the
     * `throw error` arm of the catch.
     */
    const { controller, audit } = buildController([row])
    const boom = new Error('unexpected')
    jest.spyOn(audit, 'decodeCursor').mockImplementation(() => {
      throw boom
    })
    await expect(controller.list(TENANT, parse({ cursor: 'whatever' }))).rejects.toBe(boom)
  })

  it('does not mistake a non-StaleCursorError for a stale cursor', () => {
    /** A guard assertion: only `StaleCursorError` carries the 410 semantics. */
    expect(new Error('x') instanceof StaleCursorError).toBe(false)
  })
})

describe('AuditController.aggregate', () => {
  it('delegates to the aggregate service with the trusted tenant overriding the query', async () => {
    /**
     * Scenario: an aggregate request whose query carries a (spoofed) tenantId.
     * Contract: the handler resolves the tenant server-side and spreads it LAST so it overrides
     * the query tenantId, then returns the service's chart series verbatim.
     */
    const { controller, aggregateQuery } = buildController([])
    const series: AuditAggregateRow[] = [
      { bucket: new Date('2026-06-23T12:00:00Z'), dimension: 'generated', n: 3 },
    ]
    aggregateQuery.mockResolvedValue(series)

    const q = auditAggregateQuerySchema.parse({ tenantId: 'globex', groupBy: 'verb' })
    const result = await controller.aggregate(TENANT, q)

    expect(result).toBe(series)
    const passed = aggregateQuery.mock.calls[0]?.[0] as { tenantId: string; groupBy: string }
    expect(passed.tenantId).toBe(TENANT)
    expect(passed.groupBy).toBe('verb')
  })
})
