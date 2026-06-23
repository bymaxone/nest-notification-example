/**
 * @fileoverview Unit tests for the shared data-layer types module.
 *
 * The module is mostly type-only; the runtime surface is the {@link ApiError}
 * class and the {@link INTERCEPTOR_PROVIDER} marker, both verified here.
 *
 * @module lib/types.test
 */
import { describe, expect, it } from 'vitest'

import { ApiError, INTERCEPTOR_PROVIDER } from './types'

describe('ApiError', () => {
  /** Carries the status and reads as a named Error. */
  it('is an Error carrying the status and name', () => {
    const err = new ApiError(410, 'Gone')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ApiError')
    expect(err.status).toBe(410)
    expect(err.message).toBe('Gone')
  })
})

describe('INTERCEPTOR_PROVIDER', () => {
  /** The marker matches the library's reserved provider name. */
  it('is the reserved __interceptor__ provider name', () => {
    expect(INTERCEPTOR_PROVIDER).toBe('__interceptor__')
  })
})
