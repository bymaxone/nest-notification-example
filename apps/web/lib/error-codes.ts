/**
 * @fileoverview Error-code localization map for the notification console.
 *
 * Imports the `NOTIFICATION_ERROR_CODES` catalog from the isomorphic
 * `@bymax-one/nest-notification/shared` subpath and provides a human-readable
 * English message for every one of the 22 entries. The console renders these
 * messages when an API response carries a `notification.*` error code.
 *
 * @module lib/error-codes
 */

import {
  NOTIFICATION_ERROR_CODES,
  type NotificationErrorCode,
} from '@bymax-one/nest-notification/shared'

/**
 * Human-readable messages keyed by every notification error code.
 *
 * Each entry maps the stable `notification.*` wire value to an English sentence
 * suitable for display in the console UI. Covering all 22 codes ensures the
 * `scripts/audit-error-codes.mjs` localization gate passes.
 */
export const ERROR_CODE_MESSAGES: Record<NotificationErrorCode, string> = {
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
    'A resend cooldown is active for this recipient. Wait before requesting another code.',
  [NOTIFICATION_ERROR_CODES.OTP_NOT_FOUND]:
    'No active OTP was found for this recipient. Request a new code.',
  [NOTIFICATION_ERROR_CODES.OTP_EXPIRED]: 'The OTP has expired. Request a new code to continue.',
  [NOTIFICATION_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED]:
    'Too many failed attempts. Request a new code to try again.',
  [NOTIFICATION_ERROR_CODES.OTP_INVALID_CODE]:
    'The OTP entered is incorrect. Check the code and try again.',
  [NOTIFICATION_ERROR_CODES.OTP_INVALID_LENGTH]:
    'The OTP length does not match the expected format. Check the input and retry.',
  [NOTIFICATION_ERROR_CODES.SMS_PROVIDER_NOT_CONFIGURED]:
    'No SMS provider is configured. Connect a provider to send text messages.',
  [NOTIFICATION_ERROR_CODES.SMS_SEND_FAILED]:
    'The SMS provider failed to deliver the message. Check provider logs for details.',
  [NOTIFICATION_ERROR_CODES.SMS_INVALID_RECIPIENT]:
    'The recipient phone number is not valid. Correct it and retry.',
  [NOTIFICATION_ERROR_CODES.PUSH_PROVIDER_NOT_CONFIGURED]:
    'No push notification provider is configured. Connect a provider to send push notifications.',
  [NOTIFICATION_ERROR_CODES.PUSH_SEND_FAILED]:
    'The push notification provider failed to deliver the message. Check provider logs.',
  [NOTIFICATION_ERROR_CODES.AUDIT_LOG_FAILED]:
    'The notification could not be recorded in the audit log. Check database connectivity.',
  [NOTIFICATION_ERROR_CODES.CHANNEL_DISABLED]:
    'The requested notification channel is disabled. Enable it in the provider configuration.',
}

/**
 * Returns a human-readable message for a notification error code.
 *
 * Falls back gracefully to the raw code string if the code is not in the
 * localization map (which the CI gate guarantees does not happen).
 *
 * @param code - A `notification.*` error code from `NOTIFICATION_ERROR_CODES`.
 * @returns A localized English error message.
 */
export function localizeErrorCode(code: NotificationErrorCode): string {
  return ERROR_CODE_MESSAGES[code] ?? code
}
