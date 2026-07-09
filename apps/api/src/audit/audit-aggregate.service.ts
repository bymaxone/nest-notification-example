/**
 * @fileoverview Time-bucketed aggregation for the Audit Overview charts.
 * @layer app/audit/aggregate
 *
 * Runs one parameterized `$queryRaw` that buckets `notification_logs.timestamp` via `date_bin`,
 * groups by a bounded dimension (`verb`/`channel`/`provider`), counts rows per bucket+dimension,
 * and zero-fills every bucket via `generate_series` so a chart has no gaps. The query honours the
 * time window, the tenant restriction, and the source facet.
 *
 * Bucket alignment: both the zero-fill series and the count buckets are produced by
 * `date_bin(interval, timestamp, origin)` sharing one fixed origin, so the series keys and the
 * count keys land on the same grid. This is why `date_bin` replaces `date_trunc`: a
 * `generate_series` seeded at the raw (sub-bucket-aligned) `from` would step off-grid and never
 * join the boundary-aligned count buckets, zero-filling every bucket to 0 for any real window.
 *
 * SQL safety: every user value is bound through a `Prisma.sql` tagged template — never
 * string-interpolated. The only identifier injected (the group-by column) comes from a hardcoded
 * allow-list keyed by the validated `groupBy` enum, so a caller can never inject a column name.
 * No recipient/PII or OTP code is ever selected — only the bucket, the dimension value, and a count.
 *
 * @module
 */
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service.js'
import { INTERCEPTOR_PROVIDER_NAME, type AuditRestriction } from './audit-read.service.js'
import {
  resolveBucket,
  type AuditAggregateQueryDto,
  type AGGREGATE_GROUP_BY_ALLOW_LIST,
} from './dto/audit-aggregate-query.dto.js'

/** A group-by dimension from the bounded allow-list. */
type GroupByDimension = (typeof AGGREGATE_GROUP_BY_ALLOW_LIST)[number]

/** Explicit bucket sizes mapped to a `date_bin` / `generate_series` interval. */
const EXPLICIT_BUCKET: Record<'1m' | '5m' | '1h', { interval: string }> = {
  '1m': { interval: '1 minute' },
  '5m': { interval: '5 minutes' },
  '1h': { interval: '1 hour' },
}

/** Default lookback window when `from` is absent: one hour, in milliseconds. */
const DEFAULT_WINDOW_MS = 60 * 60 * 1000

/**
 * The fixed epoch origin every `date_bin` shares, so the zero-fill series and the count buckets
 * align to the same grid. `1970-01-01T00:00:00Z` sits on every minute/5-minute/hour boundary, so
 * bins land on natural clock boundaries regardless of where the query window starts.
 */
const BUCKET_ORIGIN = new Date(0)

/**
 * The physical column each group-by dimension maps to. Hardcoded — the only identifier ever
 * spliced into the SQL, keyed by the validated enum, so user input never reaches an identifier.
 */
const DIMENSION_COLUMN: Record<GroupByDimension, Prisma.Sql> = {
  verb: Prisma.sql`"verb"`,
  channel: Prisma.sql`"channel"`,
  provider: Prisma.sql`"providerName"`,
}

/** One zero-filled aggregate row: a bucket timestamp, the dimension value, and the count. */
export interface AuditAggregateRow {
  /** The time-bucket start. */
  bucket: Date
  /** The group-by dimension value (a verb / channel / provider name). */
  dimension: string
  /** Row count in this bucket for this dimension value. */
  n: number
}

/** Server-side time-bucketed aggregation for the Overview charts. */
@Injectable()
export class AuditAggregateService {
  /**
   * @param prisma - The application's Prisma client (owns all read SQL).
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run the zero-filled, time-bucketed aggregate for the requested dimension.
   *
   * @param q - The validated aggregate query merged with the server-side tenant restriction
   *   (the restriction's `tenantId` wins, mirroring `AuditReadService.buildWhere`).
   * @returns The chart series: one row per (bucket × dimension value), zero-filled.
   */
  async query(q: AuditAggregateQueryDto & AuditRestriction): Promise<AuditAggregateRow[]> {
    const to = q.to ? new Date(q.to) : new Date()
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - DEFAULT_WINDOW_MS)
    const { interval } =
      q.bucket === 'auto' ? resolveBucket(q.from, q.to) : EXPLICIT_BUCKET[q.bucket]
    const column = DIMENSION_COLUMN[q.groupBy]
    const tenantId = q.tenantId ?? null
    const source = this.sourceSql(q.source)
    const origin = BUCKET_ORIGIN

    return this.prisma.$queryRaw<AuditAggregateRow[]>(Prisma.sql`
      SELECT b.bucket, d.dimension, COALESCE(c.n, 0)::int AS n
      FROM generate_series(
             date_bin(${interval}::interval, ${from}::timestamptz, ${origin}::timestamptz),
             ${to}::timestamptz,
             ${interval}::interval
           ) AS b(bucket)
      CROSS JOIN (
        SELECT DISTINCT ${column} AS dimension
        FROM "notification_logs"
        WHERE "timestamp" BETWEEN ${from} AND ${to}
          AND (${tenantId}::text IS NULL OR "tenantId" = ${tenantId})
          ${source}
      ) AS d
      LEFT JOIN (
        SELECT date_bin(${interval}::interval, "timestamp", ${origin}::timestamptz) AS bucket,
               ${column} AS dimension, count(*)::int AS n
        FROM "notification_logs"
        WHERE "timestamp" BETWEEN ${from} AND ${to}
          AND (${tenantId}::text IS NULL OR "tenantId" = ${tenantId})
          ${source}
        GROUP BY 1, 2
      ) c ON c.bucket = b.bucket AND c.dimension = d.dimension
      ORDER BY b.bucket, d.dimension
    `)
  }

  /**
   * Build the source-facet SQL fragment (parameterized) for the audit `where`.
   *
   * @param source - `'interceptor'` ⇒ only interceptor rows; `'service'` ⇒ exclude them;
   *   `undefined` ⇒ no source predicate.
   * @returns A `Prisma.Sql` `AND` fragment, or `Prisma.empty`.
   */
  private sourceSql(source: AuditAggregateQueryDto['source']): Prisma.Sql {
    if (source === 'interceptor') {
      return Prisma.sql`AND "providerName" = ${INTERCEPTOR_PROVIDER_NAME}`
    }
    if (source === 'service') {
      return Prisma.sql`AND "providerName" <> ${INTERCEPTOR_PROVIDER_NAME}`
    }
    return Prisma.empty
  }
}
