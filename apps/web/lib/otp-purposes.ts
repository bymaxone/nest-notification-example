/**
 * @fileoverview App-local OTP purpose map driving the segmented box.
 *
 * Mirrors the backend's per-purpose OTP config (the `perPurpose` overrides wired
 * in `apps/api`): each purpose carries the slot count, character class, and TTL
 * the box should use. These are intentionally NOT derived from the library's
 * `DEFAULT_TTLS`, which is seconds-only and carries no length/type — the example
 * deliberately overrides `password_reset` to an 8-character alphanumeric code on
 * a 15-minute (900s) window, so that value lives here, not in `DEFAULT_TTLS`.
 *
 * The OTP purpose `mfa_oob` (an out-of-band MFA challenge code) is unrelated to
 * the `mfa_enabled` / `mfa_disabled` email templates — different concepts.
 *
 * @module lib/otp-purposes
 */

import type { OtpInputType } from '@bymax-one/nest-notification/react'
import type { OtpPurpose } from '@bymax-one/nest-notification/shared'

/** Per-purpose OTP presentation config for the segmented box. */
export interface OtpPurposeConfig {
  /** The wire purpose label sent to the backend. */
  purpose: OtpPurpose
  /** Human label for the purpose selector. */
  label: string
  /** Number of single-character slots. */
  length: number
  /** Character class each slot accepts (drives `inputMode`). */
  type: OtpInputType
  /** Time-to-live in seconds (drives the expiry pill window). */
  ttlSeconds: number
}

/**
 * The selectable OTP purposes, mirroring the backend OVERVIEW §9 `perPurpose`
 * config: `email_verification` (6-digit / 60 min), `password_reset`
 * (8-char alphanumeric / 15 min), plus the short interactive challenges.
 */
export const OTP_PURPOSES = [
  {
    purpose: 'email_verification',
    label: 'Email verification',
    length: 6,
    type: 'numeric',
    ttlSeconds: 3600,
  },
  {
    purpose: 'password_reset',
    label: 'Password reset',
    length: 8,
    type: 'alphanumeric',
    ttlSeconds: 900,
  },
  {
    purpose: 'mfa_oob',
    label: 'MFA challenge (out-of-band)',
    length: 6,
    type: 'numeric',
    ttlSeconds: 300,
  },
  {
    purpose: 'phone_verification',
    label: 'Phone verification',
    length: 6,
    type: 'numeric',
    ttlSeconds: 600,
  },
] as const satisfies readonly OtpPurposeConfig[]

/** The default purpose the panel opens with. */
export const DEFAULT_OTP_PURPOSE: OtpPurposeConfig = OTP_PURPOSES[0]

/**
 * Resolve a purpose label to its config, falling back to the default.
 *
 * @param purpose - The purpose label (e.g. from the selector).
 * @returns The matching purpose config, or {@link DEFAULT_OTP_PURPOSE}.
 */
export function getOtpPurposeConfig(purpose: string): OtpPurposeConfig {
  return OTP_PURPOSES.find((entry) => entry.purpose === purpose) ?? DEFAULT_OTP_PURPOSE
}
