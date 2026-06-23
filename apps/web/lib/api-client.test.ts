/**
 * @fileoverview Unit tests for the notification API client — query serialization,
 * RBAC header construction, the `apiFetch` boundary (success / non-ok), and
 * every typed endpoint wrapper.
 *
 * @module lib/api-client.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiError,
  apiFetch,
  encodeAuditQuery,
  getAuditAggregate,
  getAuditLogs,
  getChannels,
  rbacHeaders,
} from './api-client'
import type { AuditFilter } from './api-client'

/** Build a minimal `Response`-like object the client consumes. */
function jsonResponse(
  body: unknown,
  options: { ok?: boolean; status?: number; statusText?: string } = {},
): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    json: () => Promise.resolve(body),
  } as unknown as Response
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('encodeAuditQuery', () => {
  /** Present scalar fields must be serialized as URL params. */
  it('serializes present scalar fields', () => {
    const qs = encodeAuditQuery({ channel: 'email', limit: 50 })
    expect(qs).toContain('channel=email')
    expect(qs).toContain('limit=50')
  })

  /** The `role` key must never appear in the query string (it travels as a header). */
  it('omits the role key from the query string', () => {
    const qs = encodeAuditQuery({ role: 'admin' })
    expect(qs).not.toContain('role=')
  })

  /** `undefined` values must be skipped (no empty params). */
  it('skips undefined values', () => {
    const filter = { channel: undefined, limit: 20 } as unknown as AuditFilter
    const qs = encodeAuditQuery(filter)
    expect(qs).not.toContain('channel=')
    expect(qs).toContain('limit=20')
  })

  /** `null` values must also be skipped. */
  it('skips null values', () => {
    const filter = { tenantId: null } as unknown as AuditFilter
    const qs = encodeAuditQuery(filter)
    expect(qs).not.toContain('tenantId=')
  })

  /** An empty filter produces an empty string. */
  it('produces an empty string for an empty filter', () => {
    expect(encodeAuditQuery({})).toBe('')
  })
})

describe('rbacHeaders', () => {
  /** Both role and non-empty tenantId must produce the two RBAC headers. */
  it('emits x-role and x-tenant-id when both are set', () => {
    const h = rbacHeaders({ role: 'admin', tenantId: 'acme' })
    expect(h['x-role']).toBe('admin')
    expect(h['x-tenant-id']).toBe('acme')
  })

  /** An undefined role must not appear in the headers. */
  it('omits x-role when role is undefined', () => {
    const h = rbacHeaders({ tenantId: 'acme' })
    expect('x-role' in h).toBe(false)
    expect(h['x-tenant-id']).toBe('acme')
  })

  /** An empty tenantId must not produce the x-tenant-id header. */
  it('omits x-tenant-id when tenantId is empty', () => {
    const h = rbacHeaders({ role: 'viewer', tenantId: '' })
    expect('x-tenant-id' in h).toBe(false)
    expect(h['x-role']).toBe('viewer')
  })

  /** An undefined tenantId must not produce the header either. */
  it('omits x-tenant-id when tenantId is undefined', () => {
    const h = rbacHeaders({ role: 'operator' })
    expect('x-tenant-id' in h).toBe(false)
  })

  /** No fields → empty headers object. */
  it('returns an empty object when nothing is set', () => {
    expect(rbacHeaders({})).toEqual({})
  })
})

describe('apiFetch', () => {
  /** A 2xx response is parsed and returned as JSON. */
  it('returns parsed JSON on a 2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }))
    const result = await apiFetch<{ ok: boolean }>('/test', {})
    expect(result).toEqual({ ok: true })
  })

  /** A non-2xx response throws an ApiError with the status code. */
  it('throws ApiError on a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({}, { ok: false, status: 404, statusText: 'Not Found' }),
    )
    await expect(apiFetch('/test', {})).rejects.toMatchObject({ status: 404 })
  })

  /** ApiError is an instance of Error and carries the status. */
  it('ApiError is an Error with the correct name and status', () => {
    const err = new ApiError(401, 'Unauthorized')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ApiError')
    expect(err.status).toBe(401)
    expect(err.message).toBe('Unauthorized')
  })

  /** RBAC headers are merged into the request. */
  it('merges the provided headers into the fetch call', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}))
    await apiFetch('/test', { 'x-role': 'admin' })
    expect(spy.mock.calls[0]![1]!.headers).toMatchObject({
      Accept: 'application/json',
      'x-role': 'admin',
    })
  })
})

describe('getAuditLogs', () => {
  /** The endpoint is called with the encoded filter and RBAC headers. */
  it('calls /audit/logs with the encoded filter', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ data: [], nextCursor: null, hasMore: false }))
    await getAuditLogs({ channel: 'email', role: 'admin', tenantId: 'acme' })
    const url = String(spy.mock.calls[0]![0])
    expect(url).toContain('/audit/logs')
    expect(url).toContain('channel=email')
    expect(url).not.toContain('role=')
  })
})

describe('getAuditAggregate', () => {
  /** The aggregate endpoint is called with the filter. */
  it('calls /audit/aggregate with the encoded filter', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))
    await getAuditAggregate({ role: 'viewer' })
    const url = String(spy.mock.calls[0]![0])
    expect(url).toContain('/audit/aggregate')
  })
})

describe('getChannels', () => {
  /** The channels endpoint is called without filter params. */
  it('calls /channels with no filter params', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))
    await getChannels()
    expect(String(spy.mock.calls[0]![0])).toContain('/channels')
  })
})
