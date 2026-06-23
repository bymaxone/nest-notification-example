/**
 * Unit tests for {@link mapOtpVerifyResult}.
 *
 * Proves all four branches of the discriminated `OtpVerifyResult → HTTP` mapping:
 * success → 200, invalid_code → 401 (with `remainingAttempts`), not_found → 404,
 * max_attempts → 429 with no cooldown. The mapping is the single place the controller
 * trusts to translate a verify outcome, so every branch is asserted in isolation.
 */
import { describe, expect, it } from '@jest/globals'

import { mapOtpVerifyResult } from './otp-verify-mapping.js'

describe('mapOtpVerifyResult', () => {
  it('maps a valid verification to 200 { valid: true }', () => {
    /**
     * Scenario: the guessed code matched.
     * Contract: a correct verify is the only 200, and the body is the minimal success shape.
     */
    expect(mapOtpVerifyResult({ valid: true })).toEqual({ status: 200, body: { valid: true } })
  })

  it('maps invalid_code to 401 echoing remainingAttempts (never the code)', () => {
    /**
     * Scenario: a wrong guess that has not yet hit the ceiling.
     * Contract: 401 with the decreasing `remainingAttempts` so a client can show tries
     * left — protects the no-code-in-response invariant (only the counter is exposed).
     */
    const outcome = mapOtpVerifyResult({
      valid: false,
      reason: 'invalid_code',
      remainingAttempts: 3,
    })

    expect(outcome).toEqual({
      status: 401,
      body: { valid: false, reason: 'invalid_code', remainingAttempts: 3 },
    })
  })

  it('maps not_found to 404 (expiry is indistinguishable from never-existed)', () => {
    /**
     * Scenario: no entry, or it expired.
     * Contract: 404 (not 410) — the chosen honest mapping that never leaks that a code
     * once existed; protects the expiry-as-not-found rule.
     */
    expect(mapOtpVerifyResult({ valid: false, reason: 'not_found' })).toEqual({
      status: 404,
      body: { valid: false, reason: 'not_found' },
    })
  })

  it('maps max_attempts to 429 with no Retry-After / cooldown field', () => {
    /**
     * Scenario: the attempt ceiling was reached.
     * Contract: 429, but the body carries NO cooldown/Retry-After value — verify has no
     * cooldown; only generate/resend do. Protects the "only one Retry-After path" rule.
     */
    const outcome = mapOtpVerifyResult({ valid: false, reason: 'max_attempts' })

    expect(outcome).toEqual({ status: 429, body: { valid: false, reason: 'max_attempts' } })
    expect(JSON.stringify(outcome.body)).not.toMatch(/retry|cooldown/i)
  })
})
