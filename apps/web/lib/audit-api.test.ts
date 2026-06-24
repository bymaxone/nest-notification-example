/**
 * @fileoverview Unit tests for the `/audit/*` typed client.
 *
 * Drives `fetchLogs` / `fetchAggregate` over a stubbed global `fetch`, asserting
 * the keyset envelope is returned, the trusted `x-tenant-id` header is attached,
 * the `groupBy` param is appended, and a stale-cursor 410 surfaces as a typed
 * `ApiError` carrying the status.
 *
 * @module lib/audit-api.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchAggregate, fetchLogs } from './audit-api'
import { ApiError } from './types'

/** Build a real `Response` the client consumes. */
function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchLogs', () => {
  /** The keyset page envelope is returned and the URL carries the filter. */
  it('calls /audit/logs and returns the keyset page', async () => {
    const page = { data: [], nextCursor: 'c1', hasMore: true }
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(page))

    const result = await fetchLogs({ channel: 'email', role: 'admin', tenantId: 'acme' })

    expect(result).toEqual(page)
    const [url, init] = spy.mock.calls[0]!
    expect(String(url)).toContain('/audit/logs')
    expect(String(url)).toContain('channel=email')
    expect((init!.headers as Record<string, string>)['x-tenant-id']).toBe('acme')
  })

  /** A stale cursor (410) becomes a typed ApiError carrying the status. */
  it('surfaces a 410 stale cursor as an ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 410, 'Gone'))

    await expect(fetchLogs({ cursor: 'stale' })).rejects.toBeInstanceOf(ApiError)
    await expect(fetchLogs({ cursor: 'stale' })).rejects.toMatchObject({ status: 410 })
  })
})

describe('fetchAggregate', () => {
  /** The aggregate endpoint is called with the groupBy appended to a non-empty query. */
  it('appends groupBy to a populated query', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))

    await fetchAggregate({ tenantId: 'acme', role: 'viewer' }, 'verb')

    const url = String(spy.mock.calls[0]![0])
    expect(url).toContain('/audit/aggregate')
    expect(url).toContain('tenantId=acme')
    expect(url).toContain('groupBy=verb')
  })

  /** With an empty query the groupBy is the sole param (no leading `&`). */
  it('appends groupBy without a leading separator on an empty query', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))

    await fetchAggregate({}, 'channel')

    const url = String(spy.mock.calls[0]![0])
    expect(url).toContain('/audit/aggregate?groupBy=channel')
    expect(url).not.toContain('?&')
  })

  /** The cursor/limit are dropped from the aggregate query (charts span the window). */
  it('omits cursor and limit from the aggregate query', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))

    await fetchAggregate({ cursor: 'c1', limit: 50, tenantId: 'acme' }, 'provider')

    const url = String(spy.mock.calls[0]![0])
    expect(url).not.toContain('cursor=')
    expect(url).not.toContain('limit=')
  })
})
