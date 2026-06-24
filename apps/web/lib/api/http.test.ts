/**
 * @fileoverview Unit tests for the shared API transport.
 *
 * Drives a stubbed `fetch` to cover: tenant-header presence/omission, the JSON
 * GET success + thrown-ApiError paths, and every `postForResult` branch — a 2xx
 * JSON result, a 204 (undefined data), and the error-envelope parser across a
 * full envelope, a `Retry-After` header, a non-numeric header falling back to the
 * cooldown detail, a missing/odd `error` shape, and a body that fails to parse.
 *
 * @module lib/api/http.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../types'
import { API_BASE, getJson, postForResult, tenantHeaders } from './http'

/** Build a minimal `Response`-like object for the fetch stub. */
function makeResponse(init: {
  ok: boolean
  status: number
  statusText?: string
  json?: () => Promise<unknown>
  headers?: Record<string, string>
}): Response {
  return {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText ?? '',
    json: init.json ?? (() => Promise.resolve(null)),
    headers: { get: (key: string) => init.headers?.[key] ?? null },
  } as unknown as Response
}

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  vi.clearAllMocks()
})

describe('tenantHeaders', () => {
  /** A blank tenant omits the header so the API resolves its default. */
  it('omits x-tenant-id for a blank tenant', () => {
    expect(tenantHeaders('')).toEqual({})
  })

  /** A concrete tenant scopes the request via x-tenant-id. */
  it('sends x-tenant-id for a concrete tenant', () => {
    expect(tenantHeaders('acme')).toEqual({ 'x-tenant-id': 'acme' })
  })
})

describe('getJson', () => {
  /** A 2xx response resolves to the parsed JSON payload. */
  it('returns the parsed JSON on success', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: true, status: 200, json: () => Promise.resolve({ a: 1 }) }),
    )
    await expect(getJson('/x', 'acme')).resolves.toEqual({ a: 1 })
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/x`, {
      headers: { Accept: 'application/json', 'x-tenant-id': 'acme' },
    })
  })

  /** A non-2xx response throws an ApiError carrying the status. */
  it('throws ApiError on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 503, statusText: 'Unavailable' }))
    await expect(getJson('/x', '')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('postForResult', () => {
  /** A 2xx JSON response yields { ok:true, data }. */
  it('returns the parsed data on a 2xx', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: true, status: 200, json: () => Promise.resolve({ expiresAt: 9 }) }),
    )
    const result = await postForResult<{ expiresAt: number }>('/otp/generate', { a: 1 }, 'acme')
    expect(result).toEqual({ ok: true, data: { expiresAt: 9 } })
  })

  /** A 204 yields { ok:true, data: undefined } without parsing a body. */
  it('returns undefined data on a 204', async () => {
    const json = vi.fn(() => Promise.resolve({}))
    fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 204, json }))
    const result = await postForResult('/otp/consume', {}, '')
    expect(result).toEqual({ ok: true, data: undefined })
    expect(json).not.toHaveBeenCalled()
  })

  /** A full envelope surfaces the code, message, and details.remainingSeconds. */
  it('parses a full error envelope with a cooldown detail', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            error: {
              code: 'notification.otp_cooldown_active',
              message: 'wait',
              details: { remainingSeconds: 42 },
            },
          }),
      }),
    )
    const result = await postForResult('/otp/resend', {}, 'acme')
    expect(result).toEqual({
      ok: false,
      code: 'notification.otp_cooldown_active',
      message: 'wait',
      retryAfterSeconds: 42,
    })
  })

  /** A numeric Retry-After header takes precedence over the body detail. */
  it('prefers a numeric Retry-After header', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: false,
        status: 429,
        headers: { 'Retry-After': '17' },
        json: () =>
          Promise.resolve({
            error: {
              code: 'notification.otp_cooldown_active',
              message: 'm',
              details: { remainingSeconds: 99 },
            },
          }),
      }),
    )
    const result = await postForResult('/otp/resend', {}, '')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.retryAfterSeconds).toBe(17)
  })

  /** A non-numeric header falls back to the cooldown detail. */
  it('falls back to the detail when the header is not numeric', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: false,
        status: 429,
        headers: { 'Retry-After': 'soon' },
        json: () => Promise.resolve({ error: { code: 'c', details: { remainingSeconds: 8 } } }),
      }),
    )
    const result = await postForResult('/otp/resend', {}, '')
    if (!result.ok) {
      expect(result.retryAfterSeconds).toBe(8)
      expect(result.message).toBe('')
    }
  })

  /** A body without an `error` key yields an empty code and null retry. */
  it('handles a body with no error envelope', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 500, json: () => Promise.resolve({ oops: true }) }),
    )
    const result = await postForResult('/x', {}, '')
    expect(result).toEqual({ ok: false, code: '', message: '', retryAfterSeconds: null })
  })

  /** A non-string code is rejected (envelope treated as absent). */
  it('rejects a non-string error code', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 400, json: () => Promise.resolve({ error: { code: 7 } }) }),
    )
    const result = await postForResult('/x', {}, '')
    if (!result.ok) expect(result.code).toBe('')
  })

  /** Odd `details` shapes (non-object, missing field, non-number) yield null retry. */
  it.each([
    { error: { code: 'c' } },
    { error: { code: 'c', details: null } },
    { error: { code: 'c', details: { other: 1 } } },
    { error: { code: 'c', details: { remainingSeconds: 'x' } } },
  ])('returns null retry for odd details %#', async (envelope) => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 400, json: () => Promise.resolve(envelope) }),
    )
    const result = await postForResult('/x', {}, '')
    if (!result.ok) expect(result.retryAfterSeconds).toBeNull()
  })

  /** A null and a primitive error are both treated as no envelope. */
  it.each([null, 'boom', { error: null }, { error: 'str' }])(
    'treats %o as no envelope',
    async (body) => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: false, status: 500, json: () => Promise.resolve(body) }),
      )
      const result = await postForResult('/x', {}, '')
      if (!result.ok) expect(result.code).toBe('')
    },
  )

  /** A body that fails to parse falls back to empty code/message. */
  it('handles a body that fails to parse', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 500, json: () => Promise.reject(new Error('bad json')) }),
    )
    const result = await postForResult('/x', {}, '')
    expect(result).toEqual({ ok: false, code: '', message: '', retryAfterSeconds: null })
  })
})
