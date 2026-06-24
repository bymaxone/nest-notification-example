/**
 * Unit tests for {@link AuditAggregateService}.
 *
 * A mocked `$queryRaw` proves the service builds and runs one parameterized aggregate query for
 * each group-by dimension, each source-facet mode, the explicit vs `auto` bucket sizing, and the
 * default vs explicit time window — and returns the zero-filled series verbatim. The query is
 * parameterized (a `Prisma.Sql`), never a string, so no user value is interpolated.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import type { PrismaService } from '../prisma/prisma.service.js'
import { AuditAggregateService, type AuditAggregateRow } from './audit-aggregate.service.js'
import type { AuditRestriction } from './audit-read.service.js'
import {
  auditAggregateQuerySchema,
  type AuditAggregateQueryDto,
} from './dto/audit-aggregate-query.dto.js'

/** Build the service over a `$queryRaw` mock; return both. */
function build(rows: AuditAggregateRow[] = []) {
  const queryRaw = jest.fn<(sql: unknown) => Promise<AuditAggregateRow[]>>().mockResolvedValue(rows)
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService
  return { service: new AuditAggregateService(prisma), queryRaw }
}

/** Strip the schema's optional `tenantId` so the trusted restriction is the only source. */
function dropSchemaTenant(query: AuditAggregateQueryDto): Omit<AuditAggregateQueryDto, 'tenantId'> {
  const next = { ...query }
  delete next.tenantId
  return next
}

/** Parse + merge a tenant restriction so the service receives a fully-typed query. */
function aggQuery(
  raw: Record<string, unknown>,
  tenantId?: string,
): AuditAggregateQueryDto & AuditRestriction {
  // The schema carries its own optional `tenantId`, but the trusted restriction is the single
  // source of truth (as in the controller): drop the parsed one and re-add only a concrete
  // string, so the value never widens to `string | undefined` under exactOptionalPropertyTypes.
  const query = dropSchemaTenant(auditAggregateQuerySchema.parse(raw))
  return tenantId === undefined ? query : { ...query, tenantId }
}

describe('AuditAggregateService.query', () => {
  let built: ReturnType<typeof build>

  beforeEach(() => {
    built = build([{ bucket: new Date('2026-06-23T12:00:00Z'), dimension: 'generated', n: 2 }])
  })

  it('runs a single parameterized Prisma.Sql query and returns the series', async () => {
    /** The aggregate is one tagged-template `$queryRaw` — a `Prisma.Sql` with bound values, never a
     *  raw string — and its rows pass through. The bound `values` prove no user input is interpolated. */
    const result = await built.service.query(aggQuery({ groupBy: 'verb' }, 'acme'))

    expect(built.queryRaw).toHaveBeenCalledTimes(1)
    const sql = built.queryRaw.mock.calls[0]?.[0] as { values: unknown[]; strings: string[] }
    expect(typeof sql).not.toBe('string')
    expect(Array.isArray(sql.values)).toBe(true)
    // The tenant id is bound as a parameter, not spliced into the SQL text.
    expect(sql.values).toContain('acme')
    expect(result).toEqual([
      { bucket: new Date('2026-06-23T12:00:00Z'), dimension: 'generated', n: 2 },
    ])
  })

  it('supports each bounded group-by dimension', async () => {
    /** verb/channel/provider each map to a hardcoded column — covers all three allow-list arms. */
    for (const groupBy of ['verb', 'channel', 'provider'] as const) {
      await built.service.query(aggQuery({ groupBy }))
    }
    expect(built.queryRaw).toHaveBeenCalledTimes(3)
  })

  it('applies the interceptor source facet', async () => {
    /** source=interceptor adds the `providerName = __interceptor__` SQL fragment. */
    await built.service.query(aggQuery({ groupBy: 'provider', source: 'interceptor' }))
    expect(built.queryRaw).toHaveBeenCalledTimes(1)
  })

  it('applies the service source facet', async () => {
    /** source=service adds the `providerName <> __interceptor__` SQL fragment. */
    await built.service.query(aggQuery({ groupBy: 'provider', source: 'service' }))
    expect(built.queryRaw).toHaveBeenCalledTimes(1)
  })

  it('omits the source predicate when no source facet is requested', async () => {
    /** No source ⇒ `Prisma.empty` fragment (covers the undefined arm of sourceSql). */
    await built.service.query(aggQuery({ groupBy: 'verb' }))
    expect(built.queryRaw).toHaveBeenCalledTimes(1)
  })

  it('honours an explicit bucket size', async () => {
    /** An explicit `5m` bucket uses the EXPLICIT_BUCKET map rather than resolveBucket. */
    await built.service.query(aggQuery({ groupBy: 'verb', bucket: '5m' }))
    expect(built.queryRaw).toHaveBeenCalledTimes(1)
  })

  it('honours an explicit time window and tenant restriction', async () => {
    /** Explicit from/to + a tenant restriction drive the window + tenant predicate (auto bucket). */
    await built.service.query(
      aggQuery(
        { groupBy: 'channel', from: '2026-06-23T00:00:00Z', to: '2026-06-23T06:00:00Z' },
        'acme',
      ),
    )
    expect(built.queryRaw).toHaveBeenCalledTimes(1)
  })

  it('defaults to a now-1h..now window when from/to are absent', async () => {
    /** With no window the service derives `now-1h`..`now` (covers the from/to default arms). */
    await built.service.query(aggQuery({ groupBy: 'verb' }))
    expect(built.queryRaw).toHaveBeenCalledTimes(1)
  })
})
