/**
 * Unit tests for the isolated module probe helper.
 *
 * Verifies that `attemptConfigure` returns the verbatim library rejection message when
 * the library throws at module construction (the throwing branch), correctly returns
 * `rejected: false` when compilation succeeds (the non-throwing branch), and normalizes
 * a non-Error caught value to an Error instance (the catch-block normalizer branch).
 */
import 'reflect-metadata'
import { describe, expect, it } from '@jest/globals'
import { Module } from '@nestjs/common'
import type { DynamicModule } from '@nestjs/common'
import { BymaxNotificationModule } from '@bymax-one/nest-notification'
import type { SmsChannelOptions } from '@bymax-one/nest-notification'

import { attemptConfigure } from './roadmap-rejection.probe.js'

/** Minimal host class used to prove the non-rejecting compilation path. */
@Module({})
class StubModule {}

/** DynamicModule that compiles and inits without errors — used for the non-rejecting branch. */
const cleanModule: DynamicModule = { module: StubModule, providers: [], exports: [] }

describe('attemptConfigure', () => {
  it('returns rejected: true with the verbatim error when the library throws', async () => {
    /** The throwing branch: the sms key triggers an instant startup rejection. */
    const smsOptions = {} as unknown as SmsChannelOptions
    const result = await attemptConfigure('sms', () =>
      BymaxNotificationModule.forRoot({ sms: smsOptions }),
    )
    expect(result.attempt).toBe('sms')
    expect(result.rejected).toBe(true)
    expect(result.errorName).toBe('Error')
    expect(result.errorMessage).toBe(
      "[BymaxNotificationModule] SMS channel is not yet implemented (planned for v0.2). Remove 'sms' from options.",
    )
  })

  it('returns rejected: false when the module compiles and inits without error', async () => {
    /** The non-rejecting branch: a clean module returns the no-error result shape. */
    const result = await attemptConfigure('push', () => cleanModule)
    expect(result).toEqual({
      attempt: 'push',
      rejected: false,
      errorName: '',
      errorMessage: '',
    })
  })

  it('returns rejected: true with a coerced message when a non-Error value is thrown', async () => {
    /** The catch-block normalizer: a non-Error throw is wrapped in a new Error before reporting. */
    const thrownValue: unknown = 'non-error-thrown'
    const result = await attemptConfigure('async-useclass', () => {
      throw thrownValue
    })
    expect(result.attempt).toBe('async-useclass')
    expect(result.rejected).toBe(true)
    expect(result.errorMessage).toBe('non-error-thrown')
  })
})
