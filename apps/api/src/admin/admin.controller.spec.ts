/**
 * Unit tests for {@link AdminController}.
 *
 * Proves each rejection endpoint captures the library's real startup-rejection message
 * for the sms channel, push channel, and `forRootAsync({ useClass })` async form. The
 * controller is constructed directly; the library throws before any DI container is
 * compiled, so no NestJS testing infrastructure is needed.
 */
import { describe, expect, it } from '@jest/globals'

import { AdminController, RejectedOptionsFactory } from './admin.controller.js'

describe('RejectedOptionsFactory', () => {
  it('createNotificationOptions returns an empty options object', () => {
    /** Covers the factory method body — it exists only to satisfy the interface. */
    const factory = new RejectedOptionsFactory()
    expect(factory.createNotificationOptions()).toEqual({})
  })
})

describe('AdminController', () => {
  const controller = new AdminController()

  it('tryConfigureSms returns the verbatim SMS rejection message', async () => {
    /** The library rejects the sms key at validateOptions before any module compiles. */
    const result = await controller.tryConfigureSms()
    expect(result.attempt).toBe('sms')
    expect(result.rejected).toBe(true)
    expect(result.errorName).toBe('Error')
    expect(result.errorMessage).toBe(
      "[BymaxNotificationModule] SMS channel is not yet implemented (planned for v0.2). Remove 'sms' from options.",
    )
  })

  it('tryConfigurePush returns the verbatim Push rejection message', async () => {
    /** The library rejects the push key at validateOptions before any module compiles. */
    const result = await controller.tryConfigurePush()
    expect(result.attempt).toBe('push')
    expect(result.rejected).toBe(true)
    expect(result.errorName).toBe('Error')
    expect(result.errorMessage).toBe(
      "[BymaxNotificationModule] Push channel is not yet implemented (planned for v0.2). Remove 'push' from options.",
    )
  })

  it('tryConfigureAsyncUseClass returns the verbatim useClass rejection message', async () => {
    /** The library rejects useClass synchronously in assertUseFactory before any factory runs. */
    const result = await controller.tryConfigureAsyncUseClass()
    expect(result.attempt).toBe('async-useclass')
    expect(result.rejected).toBe(true)
    expect(result.errorName).toBe('Error')
    expect(result.errorMessage).toBe(
      '[BymaxNotificationModule] forRootAsync supports only `useFactory` in v0.1; `useClass` / `useExisting` are not yet implemented (planned for v0.2).',
    )
  })
})
