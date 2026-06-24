/**
 * Unit tests for {@link AuditReadService}.
 *
 * Covers the keyset cursor codec (round-trip + every {@link StaleCursorError} branch) and the
 * `buildWhere` compiler (default + explicit window, tenant scoping with the RBAC override, each
 * exact filter field, the free-text `errorMessage` contains, and all three source-facet modes).
 */
import { describe, expect, it, beforeEach } from '@jest/globals'

import { AuditReadService, StaleCursorError } from './audit-read.service.js'
import type { AuditQueryDto } from './dto/audit-query.dto.js'

/** Build a minimal valid `AuditQueryDto` with the schema defaults, overriding as needed. */
function query(overrides: Partial<AuditQueryDto> = {}): AuditQueryDto {
  return { limit: 50, ...overrides }
}

describe('AuditReadService cursor codec', () => {
  let service: AuditReadService

  beforeEach(() => {
    service = new AuditReadService()
  })

  it('round-trips a cursor through encode → decode', () => {
    /** The opaque cursor must decode back to the exact timestamp + id it encoded. */
    const timestamp = new Date('2026-06-23T12:00:00.000Z')
    const encoded = service.encodeCursor({ timestamp, id: 'row-1' })
    const decoded = service.decodeCursor(encoded)
    expect(decoded.timestamp.toISOString()).toBe(timestamp.toISOString())
    expect(decoded.id).toBe('row-1')
  })

  it('produces an opaque (non-plaintext) cursor', () => {
    /** The id/timestamp must not appear verbatim — the cursor is base64url, not readable. */
    const encoded = service.encodeCursor({
      timestamp: new Date('2026-06-23T12:00:00Z'),
      id: 'row-1',
    })
    expect(encoded).not.toContain('row-1')
    expect(encoded).not.toContain('2026-06-23')
  })

  it('throws StaleCursorError on an empty string', () => {
    /** An empty cursor decodes to empty JSON and must be rejected, not silently accepted. */
    expect(() => service.decodeCursor('')).toThrow(StaleCursorError)
  })

  it('throws StaleCursorError on undecodable garbage', () => {
    /** Random text is not valid base64url JSON — `JSON.parse` throws → StaleCursorError. */
    expect(() => service.decodeCursor('%%%not-base64%%%')).toThrow(StaleCursorError)
  })

  it('throws StaleCursorError when the encoded date is invalid', () => {
    /** A well-formed envelope carrying a non-date `t` must be rejected (NaN guard). */
    const bad = Buffer.from(JSON.stringify({ t: 'not-a-date', i: 'row-1' })).toString('base64url')
    expect(() => service.decodeCursor(bad)).toThrow(StaleCursorError)
  })

  it('throws StaleCursorError when the id is not a string', () => {
    /** A non-string `i` fails the `typeof` guard and degrades to StaleCursorError. */
    const bad = Buffer.from(JSON.stringify({ t: new Date().toISOString(), i: 42 })).toString(
      'base64url',
    )
    expect(() => service.decodeCursor(bad)).toThrow(StaleCursorError)
  })

  it('carries the StaleCursorError name and respects a provided message', () => {
    /** Controllers branch on `instanceof`/`name`; the custom-message arm must also be honoured. */
    const fromDecode = (() => {
      try {
        service.decodeCursor('')
      } catch (error) {
        return error as StaleCursorError
      }
      throw new Error('expected throw')
    })()
    expect(fromDecode.name).toBe('StaleCursorError')
    expect(new StaleCursorError('explicit reason').message).toBe('explicit reason')
    // The default message arm: constructing without an argument uses the stable default text.
    expect(new StaleCursorError().message).toBe('cursor is stale or malformed')
  })
})

describe('AuditReadService.buildWhere', () => {
  let service: AuditReadService

  beforeEach(() => {
    service = new AuditReadService()
  })

  it('applies a default now-1h..now window when from/to are absent', () => {
    /** Without an explicit window the compiler bounds the query to the last hour. */
    const before = Date.now()
    const where = service.buildWhere(query())
    const window = where.timestamp as { gte: Date; lte: Date }
    expect(window.gte.getTime()).toBeLessThanOrEqual(before - 60 * 60 * 1000 + 1000)
    expect(window.lte.getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  it('uses the explicit from/to window when supplied', () => {
    /** Explicit ISO bounds must drive the timestamp range verbatim. */
    const where = service.buildWhere(
      query({ from: '2026-06-01T00:00:00.000Z', to: '2026-06-02T00:00:00.000Z' }),
    )
    const window = where.timestamp as { gte: Date; lte: Date }
    expect(window.gte.toISOString()).toBe('2026-06-01T00:00:00.000Z')
    expect(window.lte.toISOString()).toBe('2026-06-02T00:00:00.000Z')
  })

  it('scopes to the query tenantId when no restriction is present', () => {
    /** With no RBAC restriction the query's own tenantId applies. */
    expect(service.buildWhere(query({ tenantId: 'acme' })).tenantId).toBe('acme')
  })

  it('lets the restriction tenantId override the query tenantId (anti-spoof)', () => {
    /** A forged query tenantId can never widen scope — the restriction always wins. */
    const where = service.buildWhere(query({ tenantId: 'globex' }), { tenantId: 'acme' })
    expect(where.tenantId).toBe('acme')
  })

  it('omits the tenant predicate when neither restriction nor query supplies one', () => {
    /** An admin-style query with no tenant scope leaves tenantId unset (covers the absent arm). */
    expect(service.buildWhere(query()).tenantId).toBeUndefined()
  })

  it('applies each exact filter field', () => {
    /** channel/verb/purpose/recipient/provider all map to exact-equality predicates. */
    const where = service.buildWhere(
      query({
        channel: 'otp',
        verb: 'generated',
        purpose: 'email_verification',
        recipient: 'j***@acme.com',
        provider: 'nodemailer',
      }),
    )
    expect(where).toMatchObject({
      channel: 'otp',
      verb: 'generated',
      purpose: 'email_verification',
      recipient: 'j***@acme.com',
      providerName: 'nodemailer',
    })
  })

  it('maps free-text q to a case-insensitive errorMessage contains', () => {
    /** The only free-text column is `errorMessage`; `q` searches it insensitively. */
    expect(service.buildWhere(query({ q: 'declined' })).errorMessage).toEqual({
      contains: 'declined',
      mode: 'insensitive',
    })
  })

  it('source=interceptor narrows to interceptor rows only', () => {
    /** The HTTP-boundary view: only rows stamped with the reserved `__interceptor__` provider. */
    const where = service.buildWhere(query({ source: 'interceptor' }))
    expect(where.AND).toEqual([{ providerName: '__interceptor__' }])
  })

  it('source=service excludes interceptor rows', () => {
    /** The "what the service did" view: every row except the reserved `__interceptor__` provider. */
    const where = service.buildWhere(query({ source: 'service' }))
    expect(where.AND).toEqual([{ providerName: { not: '__interceptor__' } }])
  })

  it('omits the source predicate entirely when source is absent', () => {
    /** No source filter ⇒ both sources are returned (no AND clause). */
    expect(service.buildWhere(query()).AND).toBeUndefined()
  })
})
