/**
 * @fileoverview Unit tests for client-side facet derivation.
 *
 * Verifies the source mapping (`__interceptor__` → interceptor, else service),
 * the per-field value-counts, the descending-count / ascending-value sort, the
 * skipping of null/empty values, and the stable field/label constants.
 *
 * @module lib/audit-facets.test
 */
import { describe, expect, it } from 'vitest'

import { FACET_FIELDS, FACET_LABELS, deriveFacets, sourceOf } from './audit-facets'
import type { NotificationLog } from './types'

/** Build an audit row with sensible defaults, overriding only what a test needs. */
function row(over: Partial<NotificationLog>): NotificationLog {
  return {
    id: 'r1',
    timestamp: '2026-06-23T12:00:00.000Z',
    tenantId: 'acme',
    channel: 'email',
    verb: 'sent',
    recipient: 'j***@acme.com',
    purpose: null,
    providerName: 'nodemailer',
    messageId: null,
    errorMessage: null,
    userId: null,
    metadata: null,
    ...over,
  }
}

describe('sourceOf', () => {
  /** The reserved provider maps to the interceptor source. */
  it('maps __interceptor__ to interceptor', () => {
    expect(sourceOf('__interceptor__')).toBe('interceptor')
  })

  /** Any other provider maps to the service source. */
  it('maps any other provider to service', () => {
    expect(sourceOf('nodemailer')).toBe('service')
  })
})

describe('FACET_FIELDS / FACET_LABELS', () => {
  /** The field list is the five faceted dimensions, in order. */
  it('exposes the five faceted fields', () => {
    expect(FACET_FIELDS).toEqual(['channel', 'verb', 'provider', 'purpose', 'source'])
  })

  /** Every field has a human label. */
  it('has a label for every field', () => {
    for (const field of FACET_FIELDS) expect(FACET_LABELS[field]).toBeTruthy()
  })
})

describe('deriveFacets', () => {
  /** Counts each field value and the derived source across rows. */
  it('tallies channel/verb/provider/purpose/source value-counts', () => {
    const facets = deriveFacets([
      row({ channel: 'email', verb: 'sent', providerName: 'nodemailer', purpose: 'login' }),
      row({ channel: 'otp', verb: 'generated', providerName: '__interceptor__', purpose: 'login' }),
      row({ channel: 'email', verb: 'failed', providerName: 'nodemailer', purpose: null }),
    ])

    expect(facets.channel).toContainEqual({ value: 'email', count: 2 })
    expect(facets.verb).toContainEqual({ value: 'sent', count: 1 })
    expect(facets.provider).toContainEqual({ value: 'nodemailer', count: 2 })
    expect(facets.purpose).toEqual([{ value: 'login', count: 2 }])
    expect(facets.source).toContainEqual({ value: 'service', count: 2 })
    expect(facets.source).toContainEqual({ value: 'interceptor', count: 1 })
  })

  /** Values are sorted by descending count, then ascending value for ties. */
  it('sorts values by descending count then ascending value', () => {
    const facets = deriveFacets([
      row({ channel: 'email' }),
      row({ channel: 'otp' }),
      row({ channel: 'otp' }),
    ])
    expect(facets.channel).toEqual([
      { value: 'otp', count: 2 },
      { value: 'email', count: 1 },
    ])
  })

  /** A null/empty facet value is skipped (no `''` entry appears). */
  it('skips null and empty values', () => {
    const facets = deriveFacets([row({ purpose: null }), row({ purpose: '' })])
    expect(facets.purpose).toEqual([])
  })

  /** An empty input yields empty lists for every field. */
  it('returns empty lists for no rows', () => {
    const facets = deriveFacets([])
    expect(facets.channel).toEqual([])
    expect(facets.source).toEqual([])
  })
})
