/**
 * Root application module for `apps/api`.
 *
 * Layer: app/root. Validates the process environment with the Zod schema at boot
 * (fail-fast on a bad variable), mounts the liveness route, and wires the
 * `@bymax-one/nest-notification` library via `forRootAsync` against the real adapters
 * (the env-selected email provider, Redis-or-in-memory OTP storage, the default
 * renderer over the app's template registry, and the Prisma audit repository). The
 * library's `NotificationAuditInterceptor` is registered globally so every intercepted
 * `/dispatch` emits a `sent`/`failed` audit row (`providerName: '__interceptor__'`),
 * alongside the lifecycle verbs the services emit.
 *
 * @module
 */
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { BymaxNotificationModule, NotificationAuditInterceptor } from '@bymax-one/nest-notification'

import { NotificationExceptionFilter } from './common/notification-exception.filter.js'
import { validateEnv } from './config/env.schema.js'
import { HealthModule } from './health/health.module.js'
import { applyNotificationServiceMetadata } from './notification/notification-metadata.js'
import { DispatchModule } from './dispatch/dispatch.module.js'
import { EmailModule } from './email/email.module.js'
import { notificationConfig } from './notification/notification.config.js'
import { OtpModule } from './otp/otp.module.js'
import { PrismaModule } from './prisma/prisma.module.js'
import { PrismaService } from './prisma/prisma.service.js'
import { RedisModule, REDIS } from './redis/redis.module.js'

// Restore the DI metadata the library's compiled bundle drops, before Nest
// instantiates NotificationService — see notification/notification-metadata.ts.
applyNotificationServiceMetadata()

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
    RedisModule,
    PrismaModule,
    // Resolve the library options at runtime through DI: the factory reads the
    // validated config and receives the REDIS token (an ioredis client or null) and
    // PrismaService, so the wired graph matches a production deployment.
    BymaxNotificationModule.forRootAsync({
      imports: [ConfigModule, RedisModule, PrismaModule],
      inject: [ConfigService, REDIS, PrismaService],
      useFactory: notificationConfig,
    }),
    OtpModule,
    EmailModule,
    DispatchModule,
  ],
  providers: [
    // Map every library NotificationException to its catalog HTTP response globally.
    { provide: APP_FILTER, useClass: NotificationExceptionFilter },
    // Record a sent/failed audit row per intercepted NotificationService.dispatch call.
    { provide: APP_INTERCEPTOR, useClass: NotificationAuditInterceptor },
  ],
})
export class AppModule {}
