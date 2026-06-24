/**
 * @fileoverview Unit tests for the app-local OTP purpose map.
 *
 * Asserts the two OVERVIEW §9 overrides the box relies on (email_verification =
 * 6-digit numeric / 60 min; password_reset = 8-char alphanumeric / 900s — NOT the
 * seconds-only DEFAULT_TTLS value) and the default + fallback resolution.
 *
 * @module lib/otp-purposes.test
 */
import { describe, expect, it } from 'vitest'

import { DEFAULT_OTP_PURPOSE, getOtpPurposeConfig, OTP_PURPOSES } from './otp-purposes'

describe('OTP_PURPOSES', () => {
  /** email_verification mirrors §9: 6-digit numeric on a 60-minute window. */
  it('configures email_verification as 6-digit numeric / 3600s', () => {
    expect(getOtpPurposeConfig('email_verification')).toMatchObject({
      length: 6,
      type: 'numeric',
      ttlSeconds: 3600,
    })
  })

  /** password_reset mirrors §9's override: 8-char alphanumeric / 900s (15 min). */
  it('configures password_reset as 8-char alphanumeric / 900s', () => {
    expect(getOtpPurposeConfig('password_reset')).toMatchObject({
      length: 8,
      type: 'alphanumeric',
      ttlSeconds: 900,
    })
  })

  /** Every entry exposes a label and a positive slot count. */
  it.each(OTP_PURPOSES)('exposes a label and length for "$purpose"', (config) => {
    expect(config.label.length).toBeGreaterThan(0)
    expect(config.length).toBeGreaterThan(0)
  })
})

describe('getOtpPurposeConfig', () => {
  /** An unknown purpose falls back to the default (email_verification). */
  it('falls back to the default for an unknown purpose', () => {
    expect(getOtpPurposeConfig('not_a_purpose')).toBe(DEFAULT_OTP_PURPOSE)
  })

  /** The default is the first configured purpose. */
  it('defaults to email_verification', () => {
    expect(DEFAULT_OTP_PURPOSE.purpose).toBe('email_verification')
  })
})
