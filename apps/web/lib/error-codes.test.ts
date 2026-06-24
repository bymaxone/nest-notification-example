/**
 * @fileoverview Unit tests for the error-code localization map.
 *
 * Verifies that every one of the 22 `NOTIFICATION_ERROR_CODES` keys has a
 * non-empty human-readable message in `NOTIFICATION_ERROR_MESSAGES`, and that
 * `localizeNotificationError` returns the mapped message for each known code and
 * a safe fallback for an unknown one.
 *
 * @module lib/error-codes.test
 */
import { describe, expect, it } from 'vitest'

import { NOTIFICATION_ERROR_CODES } from '@bymax-one/nest-notification/shared'
import { NOTIFICATION_ERROR_MESSAGES, localizeNotificationError } from './error-codes'

/** All 22 wire values from the shared catalog. */
const ALL_CODES = Object.values(NOTIFICATION_ERROR_CODES)

/** The message map widened to a string lookup for the per-code assertions. */
const MESSAGES: Record<string, string> = NOTIFICATION_ERROR_MESSAGES

describe('NOTIFICATION_ERROR_MESSAGES', () => {
  /** Every catalog code must have a non-empty string in the map. */
  it.each(ALL_CODES)('has a non-empty message for "%s"', (code) => {
    const message = MESSAGES[code]
    expect(typeof message).toBe('string')
    expect(message?.length ?? 0).toBeGreaterThan(0)
  })

  /** The map must cover exactly all 22 codes (no surplus, no missing). */
  it('covers all 22 codes', () => {
    expect(Object.keys(NOTIFICATION_ERROR_MESSAGES).length).toBe(22)
  })
})

describe('localizeNotificationError', () => {
  /** Returns the mapped message (by wire value) for every known code. */
  it.each(ALL_CODES)('returns the localized message for "%s"', (code) => {
    expect(localizeNotificationError(code)).toBe(MESSAGES[code])
  })

  /** Returns the generic fallback for an unrecognized code (the fallback branch). */
  it('returns a safe fallback for an unknown code', () => {
    const result = localizeNotificationError('notification.unknown_code')
    expect(result).toBe('An unexpected error occurred. Please try again.')
  })
})
