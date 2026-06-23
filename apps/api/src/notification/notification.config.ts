/**
 * @fileoverview The single source of truth for how the library is configured.
 * @layer application
 *
 * Builds `BymaxNotificationModuleOptions` from the validated environment — the factory
 * wired into `BymaxNotificationModule.forRootAsync({ useFactory })`. Because that
 * factory is typed `(...args: never[]) => …`, every injected parameter is explicitly
 * annotated, in the same order as the module's `inject` array
 * (`[ConfigService, REDIS, PrismaService]`).
 *
 * Wiring decisions made here:
 * - `redisNamespace: 'notification'` isolates OTP keys from a co-resident `nest-auth`
 *   (`'auth'`) instance so a shared Redis never collides.
 * - the tenant id is resolved from the trusted `x-tenant-id` header, never the body.
 * - DI-dependent adapters (`PrismaNotificationLogRepository`, `RedisOtpStorage`) are
 *   passed as ready INSTANCES; the in-memory OTP fallback is used when Redis is absent.
 * - audit `swallowErrors` defaults to `true` so an audit-sink failure never breaks the
 *   delivery path, and `maskRecipient` minimizes the recipient before persistence.
 *
 * @module
 */
import type { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import {
  DefaultTemplateRenderer,
  InMemoryOtpStorage,
  RedisOtpStorage,
  type BymaxNotificationModuleOptions,
  type IOtpStorage,
  type NotificationRequest,
  type RedisLike,
} from '@bymax-one/nest-notification'

import { AuditEventBus } from '../audit/audit-event.bus.js'
import { resolveTenantId as resolveTrustedTenantId } from '../common/tenant-id.decorator.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { resolveEmailProvider } from './providers/email-provider.resolver.js'
import { PrismaNotificationLogRepository } from './providers/prisma-notification-log.repository.js'
import { TEMPLATES } from './templates.js'

/** Maximum total attachment size accepted by the email channel (10 MiB). */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** Default OTP code length when a purpose does not override it. */
const DEFAULT_OTP_LENGTH = 6

/** Default OTP TTL (seconds) when the env does not specify one. */
const DEFAULT_OTP_TTL_SECONDS = 600

/** Default OTP resend cooldown (seconds) when the env does not specify one. */
const DEFAULT_OTP_COOLDOWN_SECONDS = 60

/**
 * Minimizes a recipient for audit persistence: `jane@acme.com` → `j***@acme.com`.
 *
 * @param recipient - The raw recipient address.
 * @returns The masked recipient (first character + `***` + the domain).
 */
export function maskRecipient(recipient: string): string {
  return recipient.replace(/^(.).*(@.*)$/, '$1***$2')
}

/**
 * Selects the OTP storage backend: Redis when a client is present, else in-memory.
 *
 * `ioredis`'s `Redis` is runtime-compatible with the library's structural `RedisLike`
 * surface but not nominally assignable (its overloaded `set` is wider), so the client
 * is bridged with a cast — the same reason the library forward-declares `RedisLike`
 * instead of importing the optional `ioredis` types.
 *
 * @param redis - The shared `ioredis` client, or `null` when `REDIS_URL` is unset.
 * @returns A Redis-backed store when a client exists, otherwise the in-memory store.
 */
export function resolveOtpStorage(redis: Redis | null): IOtpStorage {
  return redis
    ? new RedisOtpStorage({ redisClient: redis as unknown as RedisLike })
    : new InMemoryOtpStorage()
}

/**
 * Resolves the trusted tenant id from the request headers, never the body.
 *
 * Reads the gateway-verified `x-tenant-id` header and delegates to the shared
 * trusted-header resolver so the library applies exactly the same rule as the
 * `@TenantId` decorator elsewhere in the API: the candidate (first entry of a
 * multi-value header) is trimmed, and an absent, empty-array, blank, or
 * whitespace-only value falls back to the default tenant — a blank tenant id is
 * never propagated, closing the tenant-spoofing vector.
 *
 * @param req - The framework-agnostic notification request.
 * @returns The resolved tenant id.
 */
export function resolveTenantId(req: NotificationRequest): string {
  return resolveTrustedTenantId(req.headers['x-tenant-id'])
}

/**
 * Builds the library options from the validated env.
 *
 * @param config - The schema-typed configuration service.
 * @param redis - The shared `ioredis` client, or `null` when `REDIS_URL` is unset.
 * @param prisma - The application's Prisma client (the audit write side).
 * @param bus - The audit live-tail bus; the repository broadcasts each persisted row through it.
 * @returns The fully-wired `BymaxNotificationModuleOptions`.
 */
export function notificationConfig(
  config: ConfigService,
  redis: Redis | null,
  prisma: PrismaService,
  bus: AuditEventBus,
): BymaxNotificationModuleOptions {
  const shouldMask = config.get<boolean>('AUDIT_MASK_RECIPIENT', true) !== false
  const fromName = config.get<string>('MAIL_FROM_NAME')
  return {
    global: {
      redisNamespace: 'notification',
      defaultLocale: config.get<string>('DEFAULT_LOCALE', 'en'),
      tenantIdResolver: resolveTenantId,
    },
    email: {
      provider: resolveEmailProvider(config),
      defaultFrom: config.getOrThrow<string>('MAIL_FROM'),
      templateRenderer: new DefaultTemplateRenderer({ templates: TEMPLATES }),
      maxAttachmentBytes: MAX_ATTACHMENT_BYTES,
      ...(fromName !== undefined ? { defaultFromName: fromName } : {}),
    },
    otp: {
      storage: resolveOtpStorage(redis),
      defaultLength: DEFAULT_OTP_LENGTH,
      defaultTtlSeconds: config.get<number>('OTP_DEFAULT_TTL_SECONDS', DEFAULT_OTP_TTL_SECONDS),
      resendCooldownSeconds: config.get<number>(
        'OTP_RESEND_COOLDOWN_SECONDS',
        DEFAULT_OTP_COOLDOWN_SECONDS,
      ),
      perPurpose: {
        password_reset: { length: 8, codeType: 'alphanumeric', ttlSeconds: 900 },
        email_verification: { ttlSeconds: 3600 },
      },
    },
    audit: {
      repository: new PrismaNotificationLogRepository(prisma, bus),
      swallowErrors: true,
      maskRecipient: shouldMask ? maskRecipient : (recipient: string): string => recipient,
    },
  }
}
