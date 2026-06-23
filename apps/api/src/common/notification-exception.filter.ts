/**
 * Global exception filter mapping `NotificationException` to its HTTP response.
 *
 * Layer: app/common. The library's `NotificationException` already carries the
 * consumer-facing catalog body `{ error: { code, message, details } }` and its own
 * HTTP status; this filter forwards them verbatim so every controller surfaces the
 * library's typed errors without per-endpoint wiring. It reads no request data and
 * logs nothing — the body is already the safe, masked catalog payload.
 *
 * @module
 */
import { type ArgumentsHost, Catch, type ExceptionFilter, Injectable } from '@nestjs/common'
import { NotificationException, type NotificationErrorResponse } from '@bymax-one/nest-notification'
import type { Response } from 'express'

/**
 * Reads a `Retry-After` header value from a catalog body's `details.retryAfter`.
 *
 * Only the cooldown error (`OTP_COOLDOWN_ACTIVE`) carries a string `retryAfter` (in
 * whole seconds); every other catalog entry has no such detail, so this returns
 * `undefined` and no header is set.
 *
 * @param body - The exception's catalog body `{ error: { code, message, details } }`.
 * @returns The `Retry-After` value, or `undefined` when the body carries no cooldown.
 */
function retryAfterOf(body: string | object): string | undefined {
  const details = (body as NotificationErrorResponse).error.details
  const retryAfter = details?.['retryAfter']
  return typeof retryAfter === 'string' ? retryAfter : undefined
}

/** Serializes a {@link NotificationException} to its catalog body and status. */
@Catch(NotificationException)
@Injectable()
export class NotificationExceptionFilter implements ExceptionFilter {
  /**
   * Forward the exception's catalog body with its catalog HTTP status, attaching a
   * `Retry-After` header for the cooldown error so a client can time its retry.
   *
   * @param exception - The thrown library exception.
   * @param host - The arguments host used to reach the HTTP response.
   */
  catch(exception: NotificationException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    // `getResponse()` already IS the catalog body `{ error: { code, message, details } }`.
    const body = exception.getResponse()
    const retryAfter = retryAfterOf(body)
    if (retryAfter !== undefined) {
      // The cooldown 429 surfaces a standard Retry-After header (CORS exposes it).
      response.setHeader('Retry-After', retryAfter)
    }
    response.status(exception.getStatus()).json(body)
  }
}
