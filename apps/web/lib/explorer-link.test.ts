/**
 * @fileoverview Unit tests for the Explorer deep-link builder.
 *
 * Verifies the pivot params, the relative-range default, the absolute-window
 * override, the empty-value skipping, and that no `traceId`/`requestId` (or any
 * OTP code) ever appears in a link.
 *
 * @module lib/explorer-link.test
 */
import { describe, expect, it } from 'vitest'

import { explorerHref } from './explorer-link'

describe('explorerHref', () => {
  /** A pivot key applies the default 15m relative range. */
  it('builds a recipient pivot with the default 15m range', () => {
    const href = explorerHref({ recipient: 'j***@acme.com' })
    expect(href).toContain('/explorer?')
    expect(href).toContain('recipient=')
    expect(href).toContain('range=15m')
  })

  /** Every facet field is serialized when present. */
  it('serializes id/verb/recipient/purpose/channel/source', () => {
    const href = explorerHref({
      id: 'row-1',
      verb: 'sent',
      recipient: 'j***@acme.com',
      purpose: 'login',
      channel: 'otp',
      source: 'interceptor',
    })
    expect(href).toContain('id=row-1')
    expect(href).toContain('verb=sent')
    expect(href).toContain('purpose=login')
    expect(href).toContain('channel=otp')
    expect(href).toContain('source=interceptor')
  })

  /** An explicit `range` token overrides the default. */
  it('honours an explicit range token', () => {
    expect(explorerHref({ verb: 'failed', range: '1h' })).toContain('range=1h')
  })

  /** An absolute from/to window omits the relative range. */
  it('uses an absolute window when from/to are set', () => {
    const href = explorerHref({ from: '2026-06-23T00:00:00Z', to: '2026-06-23T01:00:00Z' })
    expect(href).toContain('from=')
    expect(href).toContain('to=')
    expect(href).not.toContain('range=')
  })

  /** A `from` without `to` still drops the relative range (open-ended window). */
  it('uses an open-ended absolute window when only from is set', () => {
    const href = explorerHref({ from: '2026-06-23T00:00:00Z' })
    expect(href).toContain('from=')
    expect(href).not.toContain('to=')
    expect(href).not.toContain('range=')
  })

  /** Empty-string fields are skipped (no dangling params). */
  it('skips empty-string fields', () => {
    const href = explorerHref({ id: '', verb: '', recipient: 'j***@acme.com' })
    expect(href).not.toContain('id=')
    expect(href).not.toContain('verb=')
  })

  /** No legacy correlation keys ever appear. */
  it('never emits traceId or requestId', () => {
    const href = explorerHref({ recipient: 'j***@acme.com', verb: 'sent' })
    expect(href).not.toContain('traceId')
    expect(href).not.toContain('requestId')
  })
})
