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
import { NotificationException } from '@bymax-one/nest-notification'
import type { Response } from 'express'

/** Serializes a {@link NotificationException} to its catalog body and status. */
@Catch(NotificationException)
@Injectable()
export class NotificationExceptionFilter implements ExceptionFilter {
  /**
   * Forward the exception's catalog body with its catalog HTTP status.
   *
   * @param exception - The thrown library exception.
   * @param host - The arguments host used to reach the HTTP response.
   */
  catch(exception: NotificationException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    // `getResponse()` already IS the catalog body `{ error: { code, message, details } }`.
    response.status(exception.getStatus()).json(exception.getResponse())
  }
}
