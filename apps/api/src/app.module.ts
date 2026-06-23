/**
 * Root application module for `apps/api`.
 *
 * Layer: app/root. Validates the process environment with the Zod schema at boot
 * (fail-fast on a bad variable) and mounts the liveness route. Feature modules are
 * imported here as the chassis grows.
 *
 * @module
 */
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { validateEnv } from './config/env.schema.js'
import { HealthModule } from './health/health.module.js'

/** Composes the application's global configuration and feature modules. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Validate process.env against the Zod schema so a misconfigured deploy
      // exits non-zero at boot instead of failing later at runtime.
      validate: validateEnv,
    }),
    HealthModule,
  ],
})
export class AppModule {}
