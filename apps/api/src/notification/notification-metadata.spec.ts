/**
 * Unit tests for {@link applyNotificationServiceMetadata}.
 *
 * Proves the shim re-declares the constructor `design:paramtypes` the library source
 * intends, so Nest can resolve `NotificationService`'s `@Optional()` channel
 * dependencies by type against the metadata-stripped published bundle.
 */
import 'reflect-metadata'
import { describe, expect, it } from '@jest/globals'
import { EmailService, NotificationService, OtpService } from '@bymax-one/nest-notification'

import { applyNotificationServiceMetadata } from './notification-metadata.js'

describe('applyNotificationServiceMetadata', () => {
  it('declares NotificationService design:paramtypes as [EmailService, OtpService]', () => {
    /** After the shim runs, the reflected param types match the source constructor. */
    applyNotificationServiceMetadata()

    const paramTypes = Reflect.getMetadata('design:paramtypes', NotificationService) as unknown[]
    expect(paramTypes).toEqual([EmailService, OtpService])
  })
})
