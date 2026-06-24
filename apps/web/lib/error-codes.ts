/**
 * @fileoverview Error-code localization map for the notification console.
 *
 * Imports the `NOTIFICATION_ERROR_CODES` catalog from the isomorphic
 * `@bymax-one/nest-notification/shared` subpath and provides a human-readable
 * English message for every one of the 22 entries. The console renders these
 * messages when an API response carries a `notification.*` error code; matching
 * is done on `error.code` (the stable wire value), never on the HTTP status.
 *
 * @module lib/error-codes
 */

import {
  NOTIFICATION_ERROR_CODES,
  type NotificationErrorCode,
} from '@bymax-one/nest-notification/shared'

/**
 * Human-readable messages keyed by every notification error code (wire value).
 *
 * Each entry maps the stable `notification.*` value to an English sentence
 * suitable for display in the console UI. The `satisfies Record<
 * NotificationErrorCode, string>` constraint is a compile-time exhaustiveness
 * guard: if the library publishes a new code, `tsc` fails here until a message
 * is added — which also keeps the `scripts/audit-error-codes.mjs` gate green.
 */
export const NOTIFICATION_ERROR_MESSAGES = {
  [NOTIFICATION_ERROR_CODES.EMAIL_PROVIDER_NOT_CONFIGURED]:
    'No email provider is configured. Set up an SMTP or Resend provider to send emails.',
  [NOTIFICATION_ERROR_CODES.EMAIL_SEND_FAILED]:
    'The email provider failed to deliver the message. Check provider logs for details.',
  [NOTIFICATION_ERROR_CODES.EMAIL_ATTACHMENTS_TOO_LARGE]:
    'The email attachments exceed the maximum allowed size. Reduce attachment sizes and retry.',
  [NOTIFICATION_ERROR_CODES.EMAIL_INVALID_RECIPIENT]:
    'The recipient address is not a valid email address. Correct it and retry.',
  [NOTIFICATION_ERROR_CODES.EMAIL_MISSING_BODY]:
    'The email has neither a template nor a subject and body. Provide at least one.',
  [NOTIFICATION_ERROR_CODES.TEMPLATE_NOT_FOUND]:
    'No template was found with the given name. Register the template before sending.',
  [NOTIFICATION_ERROR_CODES.TEMPLATE_RENDER_FAILED]:
    'The email template could not be rendered. Check the template syntax and variables.',
  [NOTIFICATION_ERROR_CODES.OTP_STORAGE_NOT_CONFIGURED]:
    'OTP storage is not configured. Connect Redis or use the in-memory store.',
  [NOTIFICATION_ERROR_CODES.OTP_EMAIL_DELIVERY_NOT_CONFIGURED]:
    'OTP email delivery is not configured. Set up an email provider for OTP flows.',
  [NOTIFICATION_ERROR_CODES.OTP_COOLDOWN_ACTIVE]:
    'Please wait before requesting another code. A resend cooldown is active for this recipient.',
  [NOTIFICATION_ERROR_CODES.OTP_NOT_FOUND]:
    'This code has expired or never existed. Request a new one.',
  [NOTIFICATION_ERROR_CODES.OTP_EXPIRED]: 'The code has expired. Request a new code to continue.',
  [NOTIFICATION_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED]:
    'Too many failed attempts. Request a new code to try again.',
  [NOTIFICATION_ERROR_CODES.OTP_INVALID_CODE]: 'Incorrect code — check the digits and try again.',
  [NOTIFICATION_ERROR_CODES.OTP_INVALID_LENGTH]:
    'The code length does not match the expected format. Check the input and retry.',
  [NOTIFICATION_ERROR_CODES.SMS_PROVIDER_NOT_CONFIGURED]:
    'No SMS provider is configured. SMS delivery is not enabled in this build.',
  [NOTIFICATION_ERROR_CODES.SMS_SEND_FAILED]:
    'The SMS provider failed to deliver the message. Check provider logs for details.',
  [NOTIFICATION_ERROR_CODES.SMS_INVALID_RECIPIENT]:
    'The recipient phone number is not valid. Correct it and retry.',
  [NOTIFICATION_ERROR_CODES.PUSH_PROVIDER_NOT_CONFIGURED]:
    'No push provider is configured. Push delivery is not enabled in this build.',
  [NOTIFICATION_ERROR_CODES.PUSH_SEND_FAILED]:
    'The push provider failed to deliver the message. Check provider logs for details.',
  [NOTIFICATION_ERROR_CODES.AUDIT_LOG_FAILED]:
    'The notification could not be recorded in the audit log. Check database connectivity.',
  [NOTIFICATION_ERROR_CODES.CHANNEL_DISABLED]:
    'The requested notification channel is disabled. Enable it in the provider configuration.',
} satisfies Record<NotificationErrorCode, string>

/** Fallback shown when an API returns a code that is not in the catalog. */
const UNKNOWN_NOTIFICATION_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.'

/** The message map widened to a string lookup, so an arbitrary code can be probed. */
const MESSAGES_BY_CODE: Record<string, string> = NOTIFICATION_ERROR_MESSAGES

/**
 * Resolve a notification error code (the wire value matched on `error.code`) to a
 * human-readable message, falling back to a generic message for an unknown code.
 *
 * @param code - A `notification.*` error code from `NOTIFICATION_ERROR_CODES`.
 * @returns The localized English message, or a safe generic fallback.
 */
export function localizeNotificationError(code: string): string {
  return MESSAGES_BY_CODE[code] ?? UNKNOWN_NOTIFICATION_ERROR_MESSAGE
}
