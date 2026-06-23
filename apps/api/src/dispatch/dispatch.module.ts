/**
 * @fileoverview Dispatch feature module.
 * @layer app/dispatch
 *
 * Registers the {@link DispatchController}. Its dependencies — `NotificationService` and
 * the resolved-options/provider/storage/renderer tokens — are provided by the globally
 * registered `BymaxNotificationModule` (wired via `forRootAsync` in the root module), so
 * no providers are declared here.
 *
 * @module
 */
import { Module } from '@nestjs/common'

import { DispatchController } from './dispatch.controller.js'

/** Exposes the dispatch façade, channel discovery, and config-introspection routes. */
@Module({ controllers: [DispatchController] })
export class DispatchModule {}
