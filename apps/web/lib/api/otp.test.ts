/**
 * @fileoverview Unit tests for the OTP API client.
 *
 * Drives a stubbed `fetch` to cover generate/resend/consume success, the verify
 * reason→code mapping (valid, invalid_code with remainingAttempts, not_found,
 * max_attempts, and a null/odd body), and that `getOtpStatus` sends only the
 * recipient + purpose — the guessed code never appears in a GET query string.
 *
 * @module lib/api/otp.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NOTIFICATION_ERROR_CODES } from '@bymax-one/nest-notification/shared'
import { ApiError } from '../types'
import { consumeOtp, generateOtp, getOtpStatus, resendOtp, verifyOtp } from './otp'

/** Build a minimal `Response`-like object for the fetch stub. */
function makeResponse(init: {
  ok: boolean
  status: number
  json?: () => Promise<unknown>
}): Response {
  return {
    ok: init.ok,
    status: init.status,
    statusText: '',
    json: init.json ?? (() => Promise.resolve(null)),
    headers: { get: () => null },
  } as unknown as Response
}

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  vi.clearAllMocks()
})

const REF = {
  tenantId: 'acme',
  recipient: 'demo@example.com',
  purpose: 'email_verification',
} as const

describe('generateOtp / resendOtp', () => {
  /** Generate posts the body and returns the expiry/cooldown on success. */
  it('generates and returns the expiry on success', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ expiresAt: 5, cooldownSeconds: 60 }),
      }),
    )
    const result = await generateOtp({ ...REF, deliverVia: 'email' })
    expect(result).toEqual({ ok: true, data: { expiresAt: 5, cooldownSeconds: 60 } })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/otp/generate')
    const [, init] = fetchMock.mock.calls[0]!
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'content-type': 'application/json', 'x-tenant-id': 'acme' })
    expect(JSON.parse(init.body)).toEqual({
      recipient: 'demo@example.com',
      purpose: 'email_verification',
      deliverVia: 'email',
    })
  })

  /** Resend hits the resend route with the exact body. */
  it('resends via the resend route', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ expiresAt: 5, cooldownSeconds: 60 }),
      }),
    )
    await resendOtp({ ...REF, deliverVia: 'manual' })
    expect(fetchMock.mock.calls[0]![0]).toContain('/otp/resend')
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      recipient: 'demo@example.com',
      purpose: 'email_verification',
      deliverVia: 'manual',
    })
  })
})

describe('consumeOtp', () => {
  /** Consume posts the reference and resolves on a 204. */
  it('consumes the active code', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 204 }))
    const result = await consumeOtp(REF)
    expect(result.ok).toBe(true)
    expect(fetchMock.mock.calls[0]![0]).toContain('/otp/consume')
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      recipient: 'demo@example.com',
      purpose: 'email_verification',
    })
  })
})

describe('verifyOtp', () => {
  /** A 200 maps to a successful outcome with no code echoed. */
  it('returns ok on a valid code', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200 }))
    const result = await verifyOtp({ ...REF, code: '123456' })
    expect(result).toEqual({ ok: true })
    // The guessed code travels only in the request body, never a query string.
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/otp/verify')
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain('123456')
    const [, init] = fetchMock.mock.calls[0]!
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'content-type': 'application/json', 'x-tenant-id': 'acme' })
    expect(JSON.parse(init.body)).toEqual({
      recipient: 'demo@example.com',
      purpose: 'email_verification',
      code: '123456',
    })
  })

  /** An invalid_code 401 maps to OTP_INVALID_CODE with the remaining attempts. */
  it('maps invalid_code with remainingAttempts', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ valid: false, reason: 'invalid_code', remainingAttempts: 2 }),
      }),
    )
    const result = await verifyOtp({ ...REF, code: '000000' })
    expect(result).toEqual({
      ok: false,
      code: NOTIFICATION_ERROR_CODES.OTP_INVALID_CODE,
      remainingAttempts: 2,
    })
  })

  /** A not_found 404 maps to OTP_NOT_FOUND with null attempts. */
  it('maps not_found', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ valid: false, reason: 'not_found' }),
      }),
    )
    const result = await verifyOtp({ ...REF, code: '000000' })
    expect(result).toEqual({
      ok: false,
      code: NOTIFICATION_ERROR_CODES.OTP_NOT_FOUND,
      remainingAttempts: null,
    })
  })

  /** A max_attempts 429 maps to OTP_MAX_ATTEMPTS_EXCEEDED. */
  it('maps max_attempts', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ valid: false, reason: 'max_attempts' }),
      }),
    )
    const result = await verifyOtp({ ...REF, code: '000000' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe(NOTIFICATION_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED)
  })

  /** A null body falls back to OTP_INVALID_CODE with null attempts. */
  it('falls back when the body has no reason', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 401, json: () => Promise.resolve(null) }),
    )
    const result = await verifyOtp({ ...REF, code: '000000' })
    expect(result).toEqual({
      ok: false,
      code: NOTIFICATION_ERROR_CODES.OTP_INVALID_CODE,
      remainingAttempts: null,
    })
  })

  /** A body that fails to parse falls back to the invalid-code outcome. */
  it('tolerates a verify body that fails to parse', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 401, json: () => Promise.reject(new Error('bad json')) }),
    )
    const result = await verifyOtp({ ...REF, code: '000000' })
    expect(result).toEqual({
      ok: false,
      code: NOTIFICATION_ERROR_CODES.OTP_INVALID_CODE,
      remainingAttempts: null,
    })
  })

  /** Odd bodies (non-string reason, string body, missing/odd attempts) are tolerated. */
  it.each([
    'weird',
    { reason: 123 },
    { foo: 1 },
    { reason: 'invalid_code', remainingAttempts: 'x' },
  ])('tolerates an odd verify body %o', async (body) => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 401, json: () => Promise.resolve(body) }),
    )
    const result = await verifyOtp({ ...REF, code: '000000' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.remainingAttempts).toBeNull()
  })
})

describe('getOtpStatus', () => {
  /** Status sends only recipient + purpose; the code is never in the query. */
  it('queries by recipient and purpose only', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ exists: true, cooldownSeconds: 0 }),
      }),
    )
    const result = await getOtpStatus(REF)
    expect(result).toEqual({ exists: true, cooldownSeconds: 0 })
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('recipient=demo%40example.com')
    expect(url).toContain('purpose=email_verification')
    expect(url).not.toContain('code')
  })

  /** A non-2xx status throws ApiError (an error envelope is never typed as status). */
  it('throws ApiError on a non-2xx status', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 500 }))
    await expect(getOtpStatus(REF)).rejects.toBeInstanceOf(ApiError)
  })
})
