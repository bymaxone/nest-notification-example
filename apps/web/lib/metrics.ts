/**
 * @fileoverview Pure transforms turning `/audit/aggregate` buckets into chart data.
 *
 * The browser never re-aggregates raw rows — it only reshapes the server's
 * zero-filled `{ bucket, dimension, n }` series into the shapes the Overview
 * panels render: a per-bucket delivery line (sent vs failed), per-dimension
 * totals (donut slices / badges), and the delivery-health rates. All functions
 * are side-effect-free and fully unit-tested (`OVERVIEW.md §15`).
 *
 * @module lib/metrics
 */

import type { AggregateBucket } from './types'

/** One point on the delivery-rate line: a formatted time plus the sent/failed counts. */
export interface DeliveryPoint {
  /** The bucket start (ISO) — used as the stable React key. */
  bucket: string
  /** Short `HH:MM` label for the x-axis. */
  time: string
  /** Count of `sent` rows in the bucket. */
  sent: number
  /** Count of `failed` rows in the bucket. */
  failed: number
}

/** One categorical slice: a dimension value and its total count. */
export interface DonutSlice {
  /** The dimension value (a channel / provider / verb name). */
  name: string
  /** The summed count across the window. */
  value: number
}

/** Format an ISO timestamp as a short `HH:MM` axis label (falls back to the input). */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Reshape a `verb`-grouped series into per-bucket sent/failed points (oldest→newest).
 *
 * @param buckets - The aggregate rows grouped by verb.
 * @returns One {@link DeliveryPoint} per distinct bucket, in chronological order.
 */
export function deliverySeries(buckets: readonly AggregateBucket[]): DeliveryPoint[] {
  const byBucket = new Map<string, DeliveryPoint>()
  for (const { bucket, dimension, n } of buckets) {
    const point = byBucket.get(bucket) ?? { bucket, time: formatTime(bucket), sent: 0, failed: 0 }
    if (dimension === 'sent') point.sent += n
    else if (dimension === 'failed') point.failed += n
    byBucket.set(bucket, point)
  }
  return [...byBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket))
}

/**
 * Sum the count of every distinct dimension value across the window.
 *
 * @param buckets - The aggregate rows.
 * @returns Donut slices sorted by descending value, then ascending name.
 */
export function toDonut(buckets: readonly AggregateBucket[]): DonutSlice[] {
  const totals = new Map<string, number>()
  for (const { dimension, n } of buckets) {
    totals.set(dimension, (totals.get(dimension) ?? 0) + n)
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

/**
 * Sum the count for a single dimension value (e.g. the `sent` verb total).
 *
 * @param buckets - The aggregate rows.
 * @param dimension - The dimension value to total.
 * @returns The summed count (0 when the value is absent).
 */
export function totalOf(buckets: readonly AggregateBucket[], dimension: string): number {
  return buckets.reduce((acc, b) => (b.dimension === dimension ? acc + b.n : acc), 0)
}

/** Sum every count in the series (the window grand total). */
export function grandTotal(buckets: readonly AggregateBucket[]): number {
  return buckets.reduce((acc, b) => acc + b.n, 0)
}

/**
 * A bounded percentage `numerator / denominator`, guarding division by zero.
 *
 * @param numerator - The part.
 * @param denominator - The whole.
 * @returns The percentage in `[0, 100]`, or `0` when the denominator is `0`.
 */
export function ratePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

/** Format a percentage with one decimal place (e.g. `92.3%`). */
export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

/** Format an integer count with thousands separators. */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}
