/**
 * @fileoverview Unit tests for the roadmap startup-rejection probes.
 *
 * Drives a stubbed `fetch` to cover each probe's code mapping (SMS/Push mapped,
 * useClass null), the verbatim `errorMessage` extraction, and the resilience
 * paths: a body without the field, a non-string field, and a network rejection.
 *
 * @module lib/api/roadmap.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NOTIFICATION_ERROR_CODES } from '@bymax-one/nest-notification/shared'
import { tryConfigureAsyncUseClass, tryConfigurePush, tryConfigureSms } from './roadmap'

/** Build a minimal `Response`-like object for the fetch stub. */
function makeResponse(json: () => Promise<unknown>): Response {
  return {
    ok: true,
    status: 200,
    statusText: '',
    json,
    headers: { get: () => null },
  } as unknown as Response
}

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  vi.clearAllMocks()
})

describe('roadmap probes', () => {
  /** SMS maps the provider-not-configured code and returns the verbatim message. */
  it('maps the SMS code and returns the verbatim message', async () => {
    fetchMock.mockResolvedValue(
      makeResponse(() =>
        Promise.resolve({ rejected: true, errorMessage: 'sms not supported in v0.1' }),
      ),
    )
    const result = await tryConfigureSms()
    expect(result).toEqual({
      code: NOTIFICATION_ERROR_CODES.SMS_PROVIDER_NOT_CONFIGURED,
      message: 'sms not supported in v0.1',
    })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/admin/try-configure-sms')
  })

  /** Push maps the push-provider code. */
  it('maps the Push code', async () => {
    fetchMock.mockResolvedValue(
      makeResponse(() => Promise.resolve({ errorMessage: 'push rejected' })),
    )
    const result = await tryConfigurePush()
    expect(result.code).toBe(NOTIFICATION_ERROR_CODES.PUSH_PROVIDER_NOT_CONFIGURED)
    expect(result.message).toBe('push rejected')
  })

  /** useClass maps no catalog code (null). */
  it('maps no code for useClass', async () => {
    fetchMock.mockResolvedValue(
      makeResponse(() => Promise.resolve({ errorMessage: 'useClass rejected' })),
    )
    const result = await tryConfigureAsyncUseClass()
    expect(result.code).toBeNull()
    expect(result.message).toBe('useClass rejected')
  })

  /** A body without errorMessage yields an empty message. */
  it('returns an empty message when the field is absent', async () => {
    fetchMock.mockResolvedValue(makeResponse(() => Promise.resolve({ rejected: true })))
    expect((await tryConfigureSms()).message).toBe('')
  })

  /** A non-string errorMessage is ignored. */
  it('ignores a non-string errorMessage', async () => {
    fetchMock.mockResolvedValue(makeResponse(() => Promise.resolve({ errorMessage: 42 })))
    expect((await tryConfigureSms()).message).toBe('')
  })

  /** A null body yields an empty message. */
  it('tolerates a null body', async () => {
    fetchMock.mockResolvedValue(makeResponse(() => Promise.resolve(null)))
    expect((await tryConfigureSms()).message).toBe('')
  })

  /** A network rejection resolves to an empty message (no throw). */
  it('resolves to an empty message on a network error', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const result = await tryConfigurePush()
    expect(result).toEqual({
      code: NOTIFICATION_ERROR_CODES.PUSH_PROVIDER_NOT_CONFIGURED,
      message: '',
    })
  })

  /** A body that fails to parse resolves to an empty message. */
  it('tolerates a body that fails to parse', async () => {
    fetchMock.mockResolvedValue(makeResponse(() => Promise.reject(new Error('bad json'))))
    expect((await tryConfigureAsyncUseClass()).message).toBe('')
  })
})
