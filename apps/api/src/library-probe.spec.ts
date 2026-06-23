/**
 * Unit tests for the library export-surface probe.
 *
 * Verifies the runtime-value exports that prove `@bymax-one/nest-notification`'s
 * `.` (server) subpath resolves through the local `file:` link: the seven DI-token
 * symbol labels, the three zero-arg class names, the OTP code length, the
 * constant-time comparison results (match + mismatch), the hash utility, the error
 * codes and definition keys, the canonical purpose and template keys, the default
 * TTL spot-check, the cooldown helper outputs, and the aggregate `probe` constant.
 * Type-only exports are erased at runtime and are proven via the TypeScript
 * compiler (type aliases in the probe module itself).
 */
import { describe, expect, it } from '@jest/globals'

import {
  canonicalTemplateKeys,
  compareMatches,
  compareMismatch,
  errorDefinitionKeys,
  injectionTokenLabels,
  probe,
  purposeKeys,
  resendCooldownSeconds,
  sampleCodeLength,
  sampleErrorCode,
  sampleFormattedCooldown,
  sampleHash,
  sampleRetryAfterHeader,
  zeroArgClassNames,
} from './library-probe.js'

/** The seven DI-token labels, in the order the probe emits them. */
const EXPECTED_TOKEN_LABELS = [
  'Symbol(BYMAX_NOTIFICATION_OPTIONS)',
  'Symbol(BYMAX_NOTIFICATION_EMAIL_PROVIDER)',
  'Symbol(BYMAX_NOTIFICATION_OTP_STORAGE)',
  'Symbol(BYMAX_NOTIFICATION_TEMPLATE_RENDERER)',
  'Symbol(BYMAX_NOTIFICATION_LOG_REPOSITORY)',
  'Symbol(BYMAX_NOTIFICATION_SMS_PROVIDER)',
  'Symbol(BYMAX_NOTIFICATION_PUSH_PROVIDER)',
]

describe('library-probe', () => {
  it('labels the seven DI-token symbols from the `.` subpath', () => {
    /**
     * Each DI token is a unique symbol created in the library constants module;
     * their `toString()` labels identify the advanced DI surface resolved.
     */
    expect(injectionTokenLabels).toEqual(EXPECTED_TOKEN_LABELS)
  })

  it('exposes the three zero-arg class-form provider names', () => {
    /**
     * `NoOpEmailProvider`, `InMemoryOtpStorage`, and `NoOpNotificationLogRepository`
     * each have a zero-argument constructor so they work as `useClass` values in
     * `forRootAsync`; their class names prove the value imports resolved.
     */
    expect(zeroArgClassNames).toEqual([
      'NoOpEmailProvider',
      'InMemoryOtpStorage',
      'NoOpNotificationLogRepository',
    ])
  })

  it('generates an OTP code of the correct length', () => {
    /**
     * `generateOtpCode(6, 'numeric')` is the standard 6-digit numeric code; the
     * length proves the crypto utility resolved and produced a value.
     */
    expect(sampleCodeLength).toBe(6)
  })

  it('returns true for equal inputs via safeCompare', () => {
    /**
     * `safeCompare('123456', '123456')` must return `true`; this exercises the
     * happy path of the constant-time comparison utility.
     */
    expect(compareMatches).toBe(true)
  })

  it('returns false for differing inputs via safeCompare', () => {
    /**
     * `safeCompare('123456', '999999')` must return `false`; this exercises the
     * mismatch path and ensures both branches of the comparison are covered.
     */
    expect(compareMismatch).toBe(false)
  })

  it('produces a hex string from hashTenantRecipient', () => {
    /**
     * `hashTenantRecipient('tenant-a', 'user@example.com')` returns a hex digest;
     * a non-empty string proves the hashing utility resolved.
     */
    expect(typeof sampleHash).toBe('string')
    expect(sampleHash.length).toBeGreaterThan(0)
    expect(/^[0-9a-f]+$/i.test(sampleHash)).toBe(true)
  })

  it('exposes the OTP_INVALID_CODE error code from NOTIFICATION_ERROR_CODES', () => {
    /**
     * Spot-checking one stable entry from the error-code catalog proves the
     * `NOTIFICATION_ERROR_CODES` constant resolved.
     */
    expect(sampleErrorCode).toBe('notification.otp_invalid_code')
  })

  it('exposes the error-definition keys from NOTIFICATION_ERROR_DEFINITIONS', () => {
    /**
     * The definition map must carry the same keys as `NOTIFICATION_ERROR_CODES`;
     * a non-empty key list proves the map resolved.
     */
    expect(errorDefinitionKeys.length).toBeGreaterThan(0)
    expect(errorDefinitionKeys).toContain('OTP_INVALID_CODE')
  })

  it('exposes the canonical notification-purpose keys from NOTIFICATION_PURPOSES', () => {
    /**
     * `NOTIFICATION_PURPOSES` contains the five canonical purpose constants;
     * its key list proves the constant resolved.
     */
    expect(purposeKeys).toContain('EMAIL_VERIFICATION')
    expect(purposeKeys).toContain('PASSWORD_RESET')
    expect(purposeKeys.length).toBeGreaterThan(0)
  })

  it('exposes the canonical email-template keys from CANONICAL_EMAIL_TEMPLATES', () => {
    /**
     * `CANONICAL_EMAIL_TEMPLATES` contains the conventional template names;
     * the key list proves the constant resolved.
     */
    expect(canonicalTemplateKeys).toContain('OTP_CODE')
    expect(canonicalTemplateKeys).toContain('WELCOME')
    expect(canonicalTemplateKeys.length).toBeGreaterThan(0)
  })

  it('exposes the resend-cooldown TTL from DEFAULT_TTLS', () => {
    /**
     * `DEFAULT_TTLS.RESEND_COOLDOWN_SECONDS` is 60 seconds per the library spec;
     * the value proves the shared constant resolved.
     */
    expect(resendCooldownSeconds).toBe(60)
  })

  it('formats a Retry-After header string from toRetryAfterHeader', () => {
    /**
     * `toRetryAfterHeader(60)` must return a non-empty string; the cooldown
     * helper resolved and produced a valid Retry-After value.
     */
    expect(typeof sampleRetryAfterHeader).toBe('string')
    expect(sampleRetryAfterHeader.length).toBeGreaterThan(0)
  })

  it('formats a cooldown display string from formatCooldown', () => {
    /**
     * `formatCooldown(90)` should produce a non-empty string (e.g. "1:30" or
     * "90s") proving the presentation helper resolved.
     */
    expect(typeof sampleFormattedCooldown).toBe('string')
    expect(sampleFormattedCooldown.length).toBeGreaterThan(0)
  })

  it('aggregates every runtime proof in the frozen probe constant', () => {
    /**
     * The `probe` object collects all runtime proofs so a single import asserts
     * the whole `.` subpath token/util surface; it must carry every named export.
     */
    expect(probe.injectionTokenLabels).toEqual(EXPECTED_TOKEN_LABELS)
    expect(probe.zeroArgClassNames).toEqual([
      'NoOpEmailProvider',
      'InMemoryOtpStorage',
      'NoOpNotificationLogRepository',
    ])
    expect(probe.sampleCodeLength).toBe(6)
    expect(probe.compareMatches).toBe(true)
    expect(probe.compareMismatch).toBe(false)
    expect(typeof probe.sampleHash).toBe('string')
    expect(probe.sampleErrorCode).toBe('notification.otp_invalid_code')
    expect(probe.errorDefinitionKeys.length).toBeGreaterThan(0)
    expect(probe.purposeKeys.length).toBeGreaterThan(0)
    expect(probe.canonicalTemplateKeys.length).toBeGreaterThan(0)
    expect(probe.resendCooldownSeconds).toBe(60)
    expect(typeof probe.sampleRetryAfterHeader).toBe('string')
    expect(typeof probe.sampleFormattedCooldown).toBe('string')
  })
})
