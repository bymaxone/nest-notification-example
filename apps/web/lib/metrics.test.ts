/**
 * @fileoverview Unit tests for the chart-data transforms.
 *
 * Covers time formatting (valid + invalid), the per-bucket delivery series
 * (grouping, sent/failed tally, chronological sort), donut totals + sort,
 * single-dimension + grand totals, the divide-by-zero-safe rate, and the value
 * formatters.
 *
 * @module lib/metrics.test
 */
import { describe, expect, it } from 'vitest'

import {
  deliverySeries,
  formatCount,
  formatPct,
  formatTime,
  grandTotal,
  ratePct,
  toDonut,
  totalOf,
} from './metrics'
import type { AggregateBucket } from './types'

/** Build an aggregate bucket row. */
function bucket(b: string, dimension: string, n: number): AggregateBucket {
  return { bucket: b, dimension, n }
}

describe('formatTime', () => {
  /** A valid ISO timestamp becomes HH:MM. */
  it('formats a valid timestamp as HH:MM', () => {
    expect(formatTime('2026-06-23T09:05:00.000Z')).toMatch(/^\d{2}:\d{2}$/)
  })

  /** An invalid input is echoed back. */
  it('returns the input when not a valid date', () => {
    expect(formatTime('not-a-date')).toBe('not-a-date')
  })
})

describe('deliverySeries', () => {
  /** Groups by bucket, tallies sent/failed, and sorts chronologically. */
  it('reshapes verb buckets into per-bucket sent/failed points', () => {
    const points = deliverySeries([
      bucket('2026-06-23T10:00:00.000Z', 'sent', 3),
      bucket('2026-06-23T10:00:00.000Z', 'failed', 1),
      bucket('2026-06-23T09:00:00.000Z', 'sent', 2),
      bucket('2026-06-23T10:00:00.000Z', 'generated', 9),
    ])
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ sent: 2, failed: 0 })
    expect(points[1]).toMatchObject({ sent: 3, failed: 1 })
  })

  /** No rows yields no points. */
  it('returns no points for an empty series', () => {
    expect(deliverySeries([])).toEqual([])
  })
})

describe('toDonut', () => {
  /** Sums per dimension and sorts by descending value. */
  it('sums per dimension and sorts descending', () => {
    const slices = toDonut([
      bucket('b1', 'nodemailer', 1),
      bucket('b2', 'nodemailer', 2),
      bucket('b1', '__interceptor__', 5),
    ])
    expect(slices).toEqual([
      { name: '__interceptor__', value: 5 },
      { name: 'nodemailer', value: 3 },
    ])
  })

  /** Equal values break the tie by ascending name. */
  it('breaks equal-value ties by ascending name', () => {
    const slices = toDonut([bucket('b1', 'bbb', 2), bucket('b1', 'aaa', 2)])
    expect(slices).toEqual([
      { name: 'aaa', value: 2 },
      { name: 'bbb', value: 2 },
    ])
  })
})

describe('totalOf / grandTotal', () => {
  /** totalOf sums a single dimension; grandTotal sums everything. */
  it('totals a single dimension and the whole series', () => {
    const rows = [bucket('b1', 'sent', 4), bucket('b1', 'failed', 1), bucket('b2', 'sent', 2)]
    expect(totalOf(rows, 'sent')).toBe(6)
    expect(totalOf(rows, 'missing')).toBe(0)
    expect(grandTotal(rows)).toBe(7)
  })
})

describe('ratePct', () => {
  /** A normal ratio is a percentage. */
  it('computes a percentage', () => {
    expect(ratePct(3, 4)).toBe(75)
  })

  /** A zero denominator is guarded to 0. */
  it('returns 0 when the denominator is 0', () => {
    expect(ratePct(3, 0)).toBe(0)
  })
})

describe('formatters', () => {
  /** Percent formatting keeps one decimal. */
  it('formats a percentage with one decimal', () => {
    expect(formatPct(92.34)).toBe('92.3%')
  })

  /** Count formatting rounds and separates thousands. */
  it('formats a count with separators', () => {
    expect(formatCount(1234.6)).toBe('1,235')
  })
})
