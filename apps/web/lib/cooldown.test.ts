/**
 * @fileoverview Unit tests for the `formatCooldown` seconds formatter.
 *
 * Covers the boundary cases the OTP resend gate relies on: zero, sub-minute,
 * the minute rollover, negative clamping, fractional truncation, and a value
 * past one hour (minutes are not capped at 59 since cooldowns stay short).
 *
 * @module lib/cooldown.test
 */
import { describe, expect, it } from 'vitest'

import { formatCooldown } from './cooldown'

describe('formatCooldown', () => {
  /** Zero renders the empty-clock baseline. */
  it('formats zero as 00:00', () => {
    expect(formatCooldown(0)).toBe('00:00')
  })

  /** A sub-minute value zero-pads the seconds. */
  it('formats 59 seconds as 00:59', () => {
    expect(formatCooldown(59)).toBe('00:59')
  })

  /** The minute boundary rolls over to 01:00. */
  it('formats 60 seconds as 01:00', () => {
    expect(formatCooldown(60)).toBe('01:00')
  })

  /** A negative input clamps to 00:00 (the hook never reports a negative). */
  it('clamps a negative input to 00:00', () => {
    expect(formatCooldown(-5)).toBe('00:00')
  })

  /** A fractional second is truncated to whole seconds. */
  it('truncates a fractional second', () => {
    expect(formatCooldown(75.9)).toBe('01:15')
  })

  /** A large value keeps the MM:SS shape (minutes are not capped at 59). */
  it('formats a value past one hour as MM:SS', () => {
    expect(formatCooldown(3661)).toBe('61:01')
  })
})
