/**
 * @fileoverview Pure mapping of the library's `OtpVerifyResult` to an HTTP outcome.
 * @layer app/otp
 *
 * `OtpService.verify` NEVER throws for a wrong/missing/exhausted code — it returns a
 * discriminated {@link OtpVerifyResult}. Keeping the HTTP mapping here (out of the
 * library and out of the controller body) makes it unit-testable in isolation and the
 * controller stays thin.
 *
 * @module
 */
import type { OtpVerifyResult } from '@bymax-one/nest-notification'

/** The HTTP status + response body a verify outcome maps to. */
export interface OtpVerifyHttpOutcome {
  status: number
  body: unknown
}

/**
 * Maps a discriminated {@link OtpVerifyResult} to an HTTP status + body.
 *
 * - `valid` → **200**.
 * - `invalid_code` → **401**, echoing the `remainingAttempts` so a client can show
 *   "N tries left" without ever seeing the code.
 * - `not_found` → **404**. The storage layer makes an expired entry indistinguishable
 *   from one that never existed (its TTL simply lapsed), so 404 is the honest mapping —
 *   deliberately NOT 410 Gone, which would leak that the code had once existed.
 * - `max_attempts` → **429** with NO `Retry-After`. A verify result carries no cooldown
 *   value; only generate/resend surface a cooldown (`OTP_COOLDOWN_ACTIVE`) and its
 *   `Retry-After`. The lockout is permanent for this code, not a timed wait.
 *
 * @param result - The verification outcome returned by `OtpService.verify`.
 * @returns The HTTP status and JSON body to send.
 */
export function mapOtpVerifyResult(result: OtpVerifyResult): OtpVerifyHttpOutcome {
  if (result.valid) {
    return { status: 200, body: { valid: true } }
  }
  if (result.reason === 'invalid_code') {
    return {
      status: 401,
      body: { valid: false, reason: 'invalid_code', remainingAttempts: result.remainingAttempts },
    }
  }
  if (result.reason === 'not_found') {
    return { status: 404, body: { valid: false, reason: 'not_found' } }
  }
  // `max_attempts`: 429 with no Retry-After — verify carries no cooldown to wait on.
  return { status: 429, body: { valid: false, reason: 'max_attempts' } }
}
