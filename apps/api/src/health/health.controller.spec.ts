/**
 * Unit tests for {@link HealthController}.
 *
 * Proves the liveness probe returns the constant `{ status: 'ok' }` payload that
 * the HTTP 200 contract depends on.
 */
import { describe, expect, it } from '@jest/globals'

import { HealthController } from './health.controller.js'

describe('HealthController', () => {
  it('returns { status: ok } from the liveness probe', () => {
    /**
     * The probe must return exactly `{ status: 'ok' }` so the `/health` route
     * answers a stable liveness payload with HTTP 200.
     */
    const controller = new HealthController()

    expect(controller.health()).toEqual({ status: 'ok' })
  })
})
