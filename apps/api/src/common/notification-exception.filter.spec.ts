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
} {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
  } as unknown as ArgumentsHost
  return { host, status, json }
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
    const { host, status, json } = buildHost()

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith(exception.getResponse())
  })

  it('maps OTP_COOLDOWN_ACTIVE to status 429', () => {
    /**
     * An active resend cooldown maps to HTTP 429 (Too Many Requests); the filter must
     * read the status from the exception's catalog, not a fixed default.
     */
    const filter = new NotificationExceptionFilter()
    const exception = new NotificationException('OTP_COOLDOWN_ACTIVE')
    const { host, status, json } = buildHost()

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(429)
    expect(json).toHaveBeenCalledWith(exception.getResponse())
  })
})
