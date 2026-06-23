/**
 * Health module — wires the `/health` liveness route into `AppModule`.
 *
 * Layer: app/health. Declares no providers so liveness stays self-contained and
 * available regardless of the feature-module wiring state.
 *
 * @module
 */
import { Module } from '@nestjs/common'

import { HealthController } from './health.controller.js'

/** Registers {@link HealthController}. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
