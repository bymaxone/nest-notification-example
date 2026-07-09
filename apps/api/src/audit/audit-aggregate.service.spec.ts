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

/** The flattened SQL text (literals joined) + bound values of the captured `Prisma.Sql`. */
function sqlOf(call: unknown): { text: string; values: unknown[] } {
  const sql = call as { strings: string[]; values: unknown[] }
  return { text: sql.strings.join('?'), values: sql.values }
}

/** The epoch-millisecond timestamps among the bound values (the window bounds are Dates). */
function boundDateMs(values: unknown[]): number[] {
  return values.filter((v): v is Date => v instanceof Date).map((d) => d.getTime())
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

  it.each([
    ['1m', '1 minute'],
    ['5m', '5 minutes'],
    ['1h', '1 hour'],
  ])('binds the exact date_bin interval for the %s bucket', async (bucket, interval) => {
    /**
     * Scenario: each explicit bucket size.
     * Contract: the `EXPLICIT_BUCKET` map binds the precise `date_bin` / `generate_series` interval
     * as a query parameter — pinning the literal `'1 minute'`/`'5 minutes'`/… strings so a blanked
     * bucket entry (which would zero-fill at the wrong granularity) is caught.
     */
    await built.service.query(aggQuery({ groupBy: 'verb', bucket }))

    const { values } = sqlOf(built.queryRaw.mock.calls[0]?.[0])
    expect(values).toContain(interval)
  })

  it('seeds the zero-fill series from a date_bin of the window start, not the raw bound', async () => {
    /**
     * Scenario: any aggregate query.
     * Contract: the `generate_series` first argument is `date_bin(...)`, so the series keys land on
     * the same aligned grid as the `date_bin` count buckets. A series seeded at the raw, sub-bucket
     * `from` (e.g. `now - 1h` carrying a sub-minute offset) would step off-grid and never join the
     * boundary-aligned count buckets — zero-filling every bucket to 0. This pins the alignment so
     * that regression cannot return.
     */
    await built.service.query(aggQuery({ groupBy: 'verb' }))

    const { text } = sqlOf(built.queryRaw.mock.calls[0]?.[0])
    // Both the series seed and the count bucket must derive from date_bin (never date_trunc).
    expect(text).toMatch(/generate_series\(\s*date_bin\(/)
    expect(text).not.toContain('date_trunc')
  })

  it('binds the group-by column identifier for each dimension', async () => {
    /**
     * Scenario: each bounded group-by dimension.
     * Contract: the hardcoded `DIMENSION_COLUMN` identifier is spliced into the SQL text (never a
     * bound value), so `verb`/`channel`/`provider` select `"verb"`/`"channel"`/`"providerName"` —
     * proving the allow-listed column name reaches the query rather than an empty identifier.
     */
    const cases: Array<[AuditAggregateQueryDto['groupBy'], string]> = [
      ['verb', '"verb"'],
      ['channel', '"channel"'],
      ['provider', '"providerName"'],
    ]
    for (const [groupBy, column] of cases) {
      const local = build([])
      await local.service.query(aggQuery({ groupBy }))
      expect(sqlOf(local.queryRaw.mock.calls[0]?.[0]).text).toContain(column)
    }
  })

  it('derives the default window as exactly one hour before an explicit `to`', async () => {
    /**
     * Scenario: an explicit `to` with no `from` and an explicit bucket (so `resolveBucket` is not
     * involved). Contract: `from` is bound as `to - 1h` — pinning the `60 * 60 * 1000` window math
     * and its subtraction, so a widened/flipped window is rejected.
     */
    const to = new Date('2026-06-23T12:00:00.000Z')
    await built.service.query(aggQuery({ groupBy: 'verb', bucket: '1h', to: to.toISOString() }))

    const ms = boundDateMs(sqlOf(built.queryRaw.mock.calls[0]?.[0]).values)
    expect(ms).toContain(to.getTime())
    expect(ms).toContain(to.getTime() - 60 * 60 * 1000)
  })

  it('binds the interceptor source fragment with the reserved provider name', async () => {
    /**
     * Scenario: `source=interceptor` grouped by `verb` (so `providerName` can only come from the
     * source facet). Contract: the SQL gains an `AND "providerName" = ?` fragment bound to the
     * reserved `__interceptor__` name — proving the interceptor branch emits the equality filter.
     */
    await built.service.query(aggQuery({ groupBy: 'verb', source: 'interceptor' }))

    const { text, values } = sqlOf(built.queryRaw.mock.calls[0]?.[0])
    expect(text).toContain('"providerName" = ')
    expect(values).toContain('__interceptor__')
  })

  it('binds the service source fragment as a not-equals on the reserved provider name', async () => {
    /**
     * Scenario: `source=service` grouped by `verb`.
     * Contract: the SQL gains an `AND "providerName" <> ?` fragment bound to `__interceptor__` —
     * the `<>` operator (not `=`) is what excludes the interceptor rows, so the equality-operator
     * and the branch selection are both pinned.
     */
    await built.service.query(aggQuery({ groupBy: 'verb', source: 'service' }))

    const { text, values } = sqlOf(built.queryRaw.mock.calls[0]?.[0])
    expect(text).toContain('"providerName" <> ')
    expect(values).toContain('__interceptor__')
  })

  it('emits no providerName predicate when no source facet is requested', async () => {
    /**
     * Scenario: a `verb` grouping with no `source`.
     * Contract: `sourceSql` returns `Prisma.empty`, so the SQL references no `providerName` at all
     * — proving neither source branch fires when the facet is absent.
     */
    await built.service.query(aggQuery({ groupBy: 'verb' }))

    expect(sqlOf(built.queryRaw.mock.calls[0]?.[0]).text).not.toContain('providerName')
  })
})
