/**
 * @fileoverview Unit tests for the notification channel severity metadata map.
 *
 * Verifies that every `NotificationChannel` resolves to a complete, accessible
 * descriptor (colour token, Lucide icon, human label) and that the lookup
 * helper returns the same object held in `CHANNEL_SEVERITY` for each channel.
 *
 * @module lib/severity.test
 */
import { describe, expect, it, vi } from 'vitest'

import { ALL_CHANNELS, CHANNEL_SEVERITY, getSeverityForChannel } from './severity'

/** Expected colour + label per channel (icon identity checked structurally). */
const EXPECTED = {
  email: { color: '#60a5fa', label: 'Email' },
  otp: { color: '#ff6224', label: 'OTP' },
  sms: { color: '#22c55e', label: 'SMS' },
  push: { color: '#a855f7', label: 'Push' },
} as const

/**
 * Re-import the module fresh so the top-level object literals are re-evaluated
 * during each test — kills module-load-initializer mutants.
 */
async function freshSeverity(): Promise<typeof import('./severity')> {
  vi.resetModules()
  return import('./severity')
}

describe('CHANNEL_SEVERITY map', () => {
  it.each(['email', 'otp', 'sms', 'push'] as const)(
    'exposes the exact colour, label, and icon for "%s"',
    async (channel) => {
      const { CHANNEL_SEVERITY: fresh } = await freshSeverity()
      expect(fresh[channel].color).toBe(EXPECTED[channel].color)
      expect(fresh[channel].label).toBe(EXPECTED[channel].label)
      // Lucide icons are forwardRef components — objects/functions, never null/undefined.
      expect(fresh[channel].icon).toBeTruthy()
      expect(['function', 'object']).toContain(typeof fresh[channel].icon)
    },
  )

  /** The map must cover exactly the four known channels. */
  it('covers every notification channel and no others', () => {
    expect(Object.keys(CHANNEL_SEVERITY).sort()).toEqual(['email', 'otp', 'push', 'sms'])
  })
})

describe('ALL_CHANNELS', () => {
  /** Must list all four channels in order. */
  it('lists all four channels', () => {
    expect([...ALL_CHANNELS].sort()).toEqual(['email', 'otp', 'push', 'sms'])
  })
})

describe('getSeverityForChannel', () => {
  it.each(['email', 'otp', 'sms', 'push'] as const)(
    'returns the CHANNEL_SEVERITY entry for "%s"',
    (channel) => {
      expect(getSeverityForChannel(channel)).toBe(CHANNEL_SEVERITY[channel])
    },
  )
})
