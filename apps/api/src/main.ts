/**
 * Application entrypoint for `apps/api`.
 *
 * Layer: app/main. Boots NestJS, installs the baseline security headers (Helmet) and
 * the cross-origin contract the console depends on, then listens on the validated
 * `PORT`. A single coordinated SIGTERM/SIGINT owner drains the app via `app.close()`
 * — which fires every `OnApplicationShutdown` hook — before exiting.
 *
 * @module
 */
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'

import { AppModule } from './app.module.js'
import type { Env } from './config/env.schema.js'

/**
 * Boot the NestJS application and start listening.
 *
 * Installs a SINGLE idempotent shutdown owner for SIGTERM (orchestrator stop) and
 * SIGINT (Ctrl-C): `app.close()` runs the NestJS shutdown lifecycle (firing
 * `OnApplicationShutdown`, where Redis/Prisma release their connections) and then the
 * process exits. `enableShutdownHooks()` is deliberately not used: in NestJS 11 it
 * re-raises the received signal after the hooks complete, which would terminate the
 * process before this owner's ordered exit can run. `app.close()` fires the lifecycle
 * hooks on its own, so this manual handler is the sole, correct owner.
 *
 * @returns A promise that resolves once the HTTP server is listening.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false })

  // Read validated, coerced config from ConfigService rather than raw process.env —
  // the Zod schema is the single source of truth for configuration.
  const config = app.get<ConfigService<Env, true>>(ConfigService)

  // Secure default response headers (nosniff, frameguard, no-referrer, etc.) before
  // CORS so every response — the JSON API serves no HTML — carries the baseline.
  app.use(helmet())

  // Allow the console (a separate origin in dev, locked to WEB_ORIGIN) to call the API
  // with the trusted `x-tenant-id` header, and expose `Retry-After` so the browser can
  // read the OTP resend cooldown surfaced on a 429.
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    allowedHeaders: ['Content-Type', 'Accept', 'x-tenant-id', 'x-role'],
    exposedHeaders: ['Retry-After'],
  })

  let isShuttingDown = false
  const shutdown = (): void => {
    if (isShuttingDown) return // idempotent: if both signals arrive, run the sequence once
    isShuttingDown = true
    void app.close().finally(() => process.exit(0))
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)

  await app.listen(config.get('PORT', { infer: true }))
}

void bootstrap()
