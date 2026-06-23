/**
 * Unit tests for {@link NotificationExceptionFilter}.
 *
 * Drives `catch()` with a mocked `ArgumentsHost` and asserts the filter forwards the
 * library exception's catalog body verbatim with its catalog HTTP status — proving the
 * consumer-facing error contract `{ error: { code, message, details } }` is preserved.
 */
import type { ArgumentsHost } from '@nestjs/common'
import { NotificationException } from '@bymax-one/nest-notification'
import { describe, expect, it, jest } from '@jest/globals'

import { NotificationExceptionFilter } from './notification-exception.filter.js'

/** A chainable `status().json()` response stub plus the `ArgumentsHost` wrapping it. */
function buildHost(): {
  host: ArgumentsHost
  status: jest.Mock
  json: jest.Mock
  setHeader: jest.Mock
} {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const setHeader = jest.fn()
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status, json, setHeader }) }),
  } as unknown as ArgumentsHost
  return { host, status, json, setHeader }
}

describe('NotificationExceptionFilter', () => {
  it('serializes OTP_INVALID_CODE to status 401 with the catalog body', () => {
    /**
     * An invalid OTP maps to HTTP 401 in the library catalog; the filter must apply
     * that status and forward the exact `{ error: { code, message, details } }` body
     * the exception produced (no re-shaping, no hardcoded details).
     */
    const filter = new NotificationExceptionFilter()
    const exception = new NotificationException('OTP_INVALID_CODE')
    const { host, status, json, setHeader } = buildHost()

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith(exception.getResponse())
    // A non-cooldown error carries no `retryAfter` detail, so no Retry-After header.
    expect(setHeader).not.toHaveBeenCalled()
  })

  it('maps OTP_COOLDOWN_ACTIVE to status 429 with a Retry-After header from details', () => {
    /**
     * An active resend cooldown maps to HTTP 429 (Too Many Requests) and the filter must
     * surface the `details.retryAfter` seconds as a standard `Retry-After` header so a
     * client can time its retry — the only Retry-After path in the OTP surface.
     */
    const filter = new NotificationExceptionFilter()
    const exception = new NotificationException('OTP_COOLDOWN_ACTIVE', {
      remainingSeconds: 30,
      retryAfter: '30',
    })
    const { host, status, json, setHeader } = buildHost()

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(429)
    expect(json).toHaveBeenCalledWith(exception.getResponse())
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '30')
  })

  it('forwards a string getResponse() body verbatim and sets no Retry-After', () => {
    /**
     * NestJS `HttpException.getResponse()` is typed `string | object` and may return a
     * bare STRING. The filter must not read a nested `error.details` shape off a string
     * (which would throw mid-handling and degrade the catalog response to a 500); it
     * sets no Retry-After header and forwards the string body with the exception status.
     */
    const filter = new NotificationExceptionFilter()
    const exception = {
      getResponse: (): string => 'Service Unavailable',
      getStatus: (): number => 503,
    } as unknown as NotificationException
    const { host, status, json, setHeader } = buildHost()

    filter.catch(exception, host)

    expect(setHeader).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(503)
    expect(json).toHaveBeenCalledWith('Service Unavailable')
  })
})
