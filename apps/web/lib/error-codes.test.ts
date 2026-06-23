/**
 * @fileoverview Unit tests for the error-code localization map.
 *
 * Verifies that every one of the 22 `NOTIFICATION_ERROR_CODES` keys has a
 * non-empty human-readable message in `ERROR_CODE_MESSAGES`, and that
 * `localizeErrorCode` returns the correct message for each.
 *
 * @module lib/error-codes.test
 */
import { describe, expect, it } from 'vitest'

import { NOTIFICATION_ERROR_CODES } from '@bymax-one/nest-notification/shared'
import { ERROR_CODE_MESSAGES, localizeErrorCode } from './error-codes'
import type { NotificationErrorCode } from '@bymax-one/nest-notification/shared'

/** All 22 wire values from the shared catalog. */
const ALL_CODES = Object.values(NOTIFICATION_ERROR_CODES) as NotificationErrorCode[]

describe('ERROR_CODE_MESSAGES', () => {
  /** Every catalog code must have a non-empty string in the map. */
  it.each(ALL_CODES)('has a non-empty message for "%s"', (code) => {
    const message = ERROR_CODE_MESSAGES[code]
    expect(typeof message).toBe('string')
    expect(message.length).toBeGreaterThan(0)
  })

  /** The map must cover exactly all 22 codes (no surplus, no missing). */
  it('covers all 22 codes', () => {
    const mapCodes = Object.keys(ERROR_CODE_MESSAGES)
    expect(mapCodes.length).toBe(22)
  })
})

describe('localizeErrorCode', () => {
  /** Returns the message from the map for every known code. */
  it.each(ALL_CODES)('returns the localized message for "%s"', (code) => {
    const result = localizeErrorCode(code)
    expect(result).toBe(ERROR_CODE_MESSAGES[code])
  })

  /** Returns the raw code string for an unknown code (fallback branch). */
  it('returns the raw code string for an unknown code', () => {
    const unknown = 'notification.unknown_code' as NotificationErrorCode
    expect(localizeErrorCode(unknown)).toBe('notification.unknown_code')
  })
})
