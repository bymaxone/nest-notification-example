/**
 * @fileoverview OTP feature module.
 * @layer app/otp
 *
 * Registers the {@link OtpController}. The `OtpService` it depends on is provided by the
 * globally-registered `BymaxNotificationModule` (wired via `forRootAsync` in the root
 * module), so no providers are declared here.
 *
 * @module
 */
import { Module } from '@nestjs/common'

import { OtpController } from './otp.controller.js'

/** Exposes the OTP lifecycle HTTP routes. */
@Module({ controllers: [OtpController] })
export class OtpModule {}
