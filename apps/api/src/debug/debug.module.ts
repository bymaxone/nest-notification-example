/**
 * @fileoverview Debug feature module.
 * @layer app/debug
 *
 * Registers the {@link DebugController}. It depends only on the pure `hashTenantRecipient`
 * helper (no DI), so no providers are declared here.
 *
 * @module
 */
import { Module } from '@nestjs/common'

import { DebugController } from './debug.controller.js'

/** Exposes the dev-only hashed-storage-key inspection route. */
@Module({ controllers: [DebugController] })
export class DebugModule {}
