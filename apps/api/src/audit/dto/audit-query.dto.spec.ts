/**
 * Behavioural tests for the audit filter + aggregate DTOs.
 *
 * The `*.dto.ts` files are excluded from coverage scope (non-executable glue), but the Zod
 * schemas are still exercised here so the coercion, defaults, enum rejection, and the
 * `resolveBucket` window mapping are proven at the edge — the contract every `/audit/*`
 * endpoint relies on.
 */
import { describe, expect, it } from '@jest/globals'

import { auditQuerySchema } from './audit-query.dto.js'
import { auditAggregateQuerySchema, resolveBucket } from './audit-aggregate-query.dto.js'

describe('auditQuerySchema', () => {
  it('coerces a string limit to an int and clamps within 1–100', () => {
    /** Query params arrive as strings; `limit=5` must coerce to the number 5. */
    expect(auditQuerySchema.parse({ limit: '5' }).limit).toBe(5)
  })

  it('defaults limit to 50 when absent', () => {
    /** A missing `limit` must fall back to the 50-row default page size. */
    expect(auditQuerySchema.parse({}).limit).toBe(50)
  })

  it('rejects a limit above the 100 cap', () => {
    /** The clamp prevents a hostile caller requesting an unbounded page. */
    expect(() => auditQuerySchema.parse({ limit: '1000' })).toThrow()
  })

  it('accepts every known channel/verb/purpose/source value', () => {
    /** The enums must admit each library-parity literal plus both source-facet modes. */
    const parsed = auditQuerySchema.parse({
      channel: 'otp',
      verb: 'generated',
      purpose: 'email_verification',
      source: 'interceptor',
      from: '2026-06-23T00:00:00Z',
      to: '2026-06-23T23:59:59Z',
    })
    expect(parsed).toMatchObject({ channel: 'otp', verb: 'generated', source: 'interceptor' })
  })

  it('throws on an unknown verb', () => {
    /** An out-of-union verb must be rejected at validation, never silently dropped. */
    expect(() => auditQuerySchema.parse({ verb: 'exploded' })).toThrow()
  })

  it('throws on a non-ISO from timestamp', () => {
    /** `from`/`to` must be ISO-8601 so the service can build a valid time window. */
    expect(() => auditQuerySchema.parse({ from: 'yesterday' })).toThrow()
  })
})

describe('auditAggregateQuerySchema', () => {
  it('defaults groupBy to verb and bucket to auto', () => {
    /** The aggregate endpoint must always return a populated series, so both fields default. */
    expect(auditAggregateQuerySchema.parse({})).toMatchObject({ groupBy: 'verb', bucket: 'auto' })
  })

  it('accepts each bounded groupBy dimension', () => {
    /** Only the three chart dimensions are allowed — high-cardinality columns are excluded. */
    for (const groupBy of ['verb', 'channel', 'provider'] as const) {
      expect(auditAggregateQuerySchema.parse({ groupBy }).groupBy).toBe(groupBy)
    }
  })

  it('rejects an out-of-allow-list groupBy', () => {
    /** Grouping by `recipient` would be high-cardinality and is rejected. */
    expect(() => auditAggregateQuerySchema.parse({ groupBy: 'recipient' })).toThrow()
  })
})

describe('resolveBucket', () => {
  it('buckets a <=6h window by the minute', () => {
    /** A short window renders minute-resolution points. */
    expect(resolveBucket('2026-06-23T00:00:00Z', '2026-06-23T02:00:00Z')).toEqual({
      unit: 'minute',
      interval: '1 minute',
    })
  })

  it('buckets a <=24h window by 5 minutes', () => {
    /** A day-scale window steps every 5 minutes to bound the point count. */
    expect(resolveBucket('2026-06-23T00:00:00Z', '2026-06-23T20:00:00Z')).toEqual({
      unit: 'minute',
      interval: '5 minutes',
    })
  })

  it('buckets a >24h window by the hour', () => {
    /** A multi-day window collapses to hourly buckets. */
    expect(resolveBucket('2026-06-20T00:00:00Z', '2026-06-23T00:00:00Z')).toEqual({
      unit: 'hour',
      interval: '1 hour',
    })
  })

  it('defaults to a now-1h..now window when both bounds are omitted', () => {
    /** With no explicit window the default hour falls into the minute bucket. */
    expect(resolveBucket(undefined, undefined)).toEqual({ unit: 'minute', interval: '1 minute' })
  })
})
