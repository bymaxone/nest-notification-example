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
import { Injectable, Module } from '@nestjs/common'
import type { DynamicModule, OnModuleDestroy } from '@nestjs/common'
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

  it('closes the throwaway container after the probe so it does not leak', async () => {
    /**
     * Scenario: a successful (non-rejecting) probe whose module owns a destroy-tracking provider.
     * Contract: the `finally` block tears the throwaway container down — the provider's
     * `onModuleDestroy` fires, proving `moduleRef.close()` ran rather than being skipped.
     */
    let destroyed = false

    @Injectable()
    class DestroyTracker implements OnModuleDestroy {
      onModuleDestroy(): void {
        destroyed = true
      }
    }

    const tracked: DynamicModule = { module: StubModule, providers: [DestroyTracker] }
    await attemptConfigure('push', () => tracked)

    expect(destroyed).toBe(true)
  })

  it('imports the built module so an init failure surfaces as a rejection', async () => {
    /**
     * Scenario: a module whose provider factory throws while the container initializes.
     * Contract: the probe actually imports the supplied module, so the init failure is captured as
     * `rejected: true` — an empty imports list would compile a bare host module and wrongly report
     * `rejected: false`.
     */
    const failing: DynamicModule = {
      module: StubModule,
      providers: [
        {
          provide: 'BOOM',
          useFactory: (): never => {
            throw new Error('provider init failed')
          },
        },
      ],
    }

    const result = await attemptConfigure('async-useclass', () => failing)

    expect(result.rejected).toBe(true)
    expect(result.errorMessage).toContain('provider init failed')
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
