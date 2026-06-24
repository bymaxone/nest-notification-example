/**
 * @fileoverview Unit tests for the same-origin SSE proxy route handler.
 *
 * An `EventSource` cannot set headers, so this proxy injects the trusted RBAC
 * headers an upstream `GET /audit/stream` needs. The tests assert it attaches
 * `x-tenant-id` + `x-role`, passes through `Last-Event-ID`, returns a
 * `text/event-stream` response, falls back to least-privilege on an unknown
 * role, sanitises the tenant id, and answers 502 when the upstream body is null.
 *
 * @module app/api/audit/stream/route.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

import { GET } from './route'

/** Build a minimal `NextRequest` double exposing `url`, `headers`, and `signal`. */
function makeRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return {
    url,
    headers: new Headers(headers),
    signal: new AbortController().signal,
  } as unknown as NextRequest
}

/** The init the route passes to the upstream `fetch`. */
function fetchInit(spy: ReturnType<typeof vi.spyOn>): { headers: Record<string, string> } {
  return spy.mock.calls[0]![1] as unknown as { headers: Record<string, string> }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/audit/stream (proxy)', () => {
  /** Attaches the RBAC headers + Last-Event-ID and returns an SSE response. */
  it('injects x-tenant-id/x-role/last-event-id and returns text/event-stream', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('data: x\n\n', { status: 200 }))

    const res = await GET(
      makeRequest('http://localhost/api/audit/stream?role=admin&tenantId=acme&channel=email', {
        'last-event-id': 'cursor-1',
      }),
    )

    expect(res.headers.get('content-type')).toBe('text/event-stream')
    expect(res.headers.get('x-accel-buffering')).toBe('no')
    const url = String(spy.mock.calls[0]![0])
    expect(url).toContain('/audit/stream')
    expect(url).toContain('channel=email')
    expect(url).not.toContain('role=')
    expect(url).not.toContain('tenantId=')
    const { headers } = fetchInit(spy)
    expect(headers['x-role']).toBe('admin')
    expect(headers['x-tenant-id']).toBe('acme')
    expect(headers['last-event-id']).toBe('cursor-1')
  })

  /** An unknown role falls back to least-privileged viewer. */
  it('falls back to viewer on an unknown role', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('data: x\n\n', { status: 200 }))

    await GET(makeRequest('http://localhost/api/audit/stream?role=root&tenantId=acme'))

    expect(fetchInit(spy).headers['x-role']).toBe('viewer')
  })

  /** A blank tenant id omits the x-tenant-id header; absent Last-Event-ID is not forwarded. */
  it('omits x-tenant-id when blank and last-event-id when absent', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('data: x\n\n', { status: 200 }))

    await GET(makeRequest('http://localhost/api/audit/stream?tenantId='))

    const { headers } = fetchInit(spy)
    expect('x-tenant-id' in headers).toBe(false)
    expect('last-event-id' in headers).toBe(false)
  })

  /** Control characters in the tenant id are stripped before forwarding as a header. */
  it('sanitises control characters out of the tenant id', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('data: x\n\n', { status: 200 }))

    await GET(
      makeRequest(`http://localhost/api/audit/stream?tenantId=${encodeURIComponent('ac\x00me')}`),
    )

    expect(fetchInit(spy).headers['x-tenant-id']).toBe('acme')
  })

  /** An entirely absent tenantId param resolves to no header (the `?? ''` branch). */
  it('omits x-tenant-id when the param is absent entirely', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('data: x\n\n', { status: 200 }))

    await GET(makeRequest('http://localhost/api/audit/stream?role=admin'))

    expect('x-tenant-id' in fetchInit(spy).headers).toBe(false)
  })

  /** A null upstream body yields a 502 (stream unavailable). */
  it('returns 502 when the upstream body is null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    const res = await GET(makeRequest('http://localhost/api/audit/stream?tenantId=acme'))

    expect(res.status).toBe(502)
  })
})
