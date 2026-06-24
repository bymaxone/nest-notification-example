/**
 * @fileoverview Cooldown seconds → `MM:SS` formatter for the OTP console.
 *
 * Mirrors the formatting style of the library's `useOtpCountdown.formatted` (the
 * `MM:SS` form under one hour) so a resend-cooldown counter and the expiry pill
 * read identically. Negative inputs clamp to `00:00`, matching the hook, which
 * never reports a negative remainder.
 *
 * @module lib/cooldown
 */

/** Seconds in one minute — the modulus/divisor for the `MM:SS` split. */
const SECONDS_PER_MINUTE = 60

/**
 * Zero-pad a non-negative integer to two digits.
 *
 * @param value - The number to pad.
 * @returns The value as a two-character, zero-padded string.
 */
function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

/**
 * Format a remaining-seconds count as `MM:SS`, clamping negatives to `00:00`.
 *
 * @param seconds - Whole seconds remaining (negatives are treated as zero).
 * @returns The remainder formatted as a zero-padded `MM:SS` string.
 */
export function formatCooldown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / SECONDS_PER_MINUTE)
  const remainder = safe % SECONDS_PER_MINUTE
  return `${pad2(minutes)}:${pad2(remainder)}`
}
