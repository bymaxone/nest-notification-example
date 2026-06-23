/**
 * @fileoverview Aggregate query DTO — extends the base audit filter with `groupBy` + `bucket`.
 * @layer app/audit/dto
 *
 * Validates the query params for `GET /audit/aggregate`. The `groupBy` allow-list is bounded
 * to the three Overview-chart dimensions (`verb`/`channel`/`provider`) so a caller can never
 * group by a high-cardinality column (`recipient`, `cursor`, `id`). `resolveBucket` maps the
 * query window to a `date_trunc` unit + `generate_series` interval when `bucket === 'auto'`.
 *
 * @module
 */
import { z } from 'zod'

import { auditQuerySchema } from './audit-query.dto.js'

/** Bounded group-by dimensions for the Overview charts — never high-cardinality columns. */
export const AGGREGATE_GROUP_BY_ALLOW_LIST = ['verb', 'channel', 'provider'] as const

/** Time bucket sizes; `auto` resolves from the query window via {@link resolveBucket}. */
export const BUCKET_SIZES = ['auto', '1m', '5m', '1h'] as const

/**
 * Resolve an `auto` bucket to a PostgreSQL `date_trunc` unit and a `generate_series` interval.
 *
 * `unit` is passed verbatim to `date_trunc(unit, "timestamp")`, so it must be a single-word
 * PostgreSQL time identifier (`minute`/`hour`); `interval` drives the zero-fill step. Short
 * windows bucket by the minute, day-scale windows by 5 minutes, longer ones by the hour — so
 * a chart never renders thousands of points.
 *
 * @param from - Window start ISO string (or `undefined` for `now-1h`).
 * @param to - Window end ISO string (or `undefined` for `now`).
 * @returns `{ unit, interval }` for use in the aggregate raw SQL.
 */
export function resolveBucket(
  from: string | undefined,
  to: string | undefined,
): { unit: string; interval: string } {
  const end = to ? new Date(to) : new Date()
  const start = from ? new Date(from) : new Date(end.getTime() - 60 * 60 * 1000)
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  if (hours <= 6) return { unit: 'minute', interval: '1 minute' }
  if (hours <= 24) return { unit: 'minute', interval: '5 minutes' }
  return { unit: 'hour', interval: '1 hour' }
}

/**
 * Aggregate query DTO: the base audit filter plus a bounded `groupBy` and a `bucket` size.
 * `groupBy` defaults to `verb` so the endpoint always returns a populated series.
 */
export const auditAggregateQuerySchema = auditQuerySchema.extend({
  /** The dimension each bucket is split by — bounded to the chart allow-list. */
  groupBy: z.enum(AGGREGATE_GROUP_BY_ALLOW_LIST).default('verb'),
  /** The time bucket size; `auto` derives from the window. */
  bucket: z.enum(BUCKET_SIZES).default('auto'),
})

/** Parsed, fully-defaulted aggregate query inferred from {@link auditAggregateQuerySchema}. */
export type AuditAggregateQueryDto = z.infer<typeof auditAggregateQuerySchema>
