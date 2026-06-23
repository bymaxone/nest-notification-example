/**
 * @fileoverview Email feature module.
 * @layer app/email
 *
 * Registers the {@link EmailController}. The `EmailService` it depends on is provided by
 * the globally-registered `BymaxNotificationModule` (wired via `forRootAsync` in the root
 * module), so no providers are declared here.
 *
 * @module
 */
import { Module } from '@nestjs/common'

import { EmailController } from './email.controller.js'

/** Exposes the raw + template email send HTTP routes. */
@Module({ controllers: [EmailController] })
export class EmailModule {}
