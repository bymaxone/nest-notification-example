/**
 * Unit tests for {@link notificationConfig} and its helpers.
 *
 * Proves the env-driven wiring branches: the Redis-vs-in-memory storage choice, the
 * `AUDIT_MASK_RECIPIENT` masker-vs-identity toggle, the optional `defaultFromName`,
 * the fixed `redisNamespace`/audit defaults, and the array-safe trusted-header tenant
 * resolution (with the `'default'` fallback).
 */
import { describe, expect, it } from '@jest/globals'
import type { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import {
  DefaultTemplateRenderer,
  InMemoryOtpStorage,
  RedisOtpStorage,
} from '@bymax-one/nest-notification'

import type { PrismaService } from '../prisma/prisma.service.js'
import {
  maskRecipient,
  notificationConfig,
  resolveOtpStorage,
  resolveTenantId,
} from './notification.config.js'

/** A stand-in Prisma client — the config never calls it, only constructs the repository. */
const prisma = {} as unknown as PrismaService

/** A stand-in ioredis client — the config never calls it, only constructs the store. */
const fakeRedis = {} as unknown as Redis

/** Build a minimal `ConfigService` over a plain record, honoring the 2-arg default form. */
function fakeConfig(env: Record<string, unknown>): ConfigService {
  return {
    get: (key: string, defaultValue?: unknown): unknown => env[key] ?? defaultValue,
    getOrThrow: (key: string): unknown => {
      const value = env[key]
      if (value === undefined) {
        throw new Error(`missing ${key}`)
      }
      return value
    },
  } as unknown as ConfigService
}

describe('resolveTenantId', () => {
  it('reads a string x-tenant-id header', () => {
    /** A plain header value is the trusted tenant id. */
    expect(resolveTenantId({ headers: { 'x-tenant-id': 'acme' } })).toBe('acme')
  })

  it('reads the first element of an array x-tenant-id header', () => {
    /** A duplicated header arrives as an array; the first element wins. */
    expect(resolveTenantId({ headers: { 'x-tenant-id': ['globex', 'spoof'] } })).toBe('globex')
  })

  it('trims surrounding whitespace from the header value', () => {
    /** Padding must not become part of the tenant id — it is trimmed away. */
    expect(resolveTenantId({ headers: { 'x-tenant-id': '  acme  ' } })).toBe('acme')
  })

  it('falls back to "default" for an empty array header', () => {
    /** An array with no elements resolves to the default tenant. */
    expect(resolveTenantId({ headers: { 'x-tenant-id': [] } })).toBe('default')
  })

  it('falls back to "default" for a blank (whitespace-only) header', () => {
    /** A whitespace-only header is treated as absent, never propagated. */
    expect(resolveTenantId({ headers: { 'x-tenant-id': '   ' } })).toBe('default')
  })

  it('falls back to "default" when the array first element is blank', () => {
    /** A blank first entry is treated as absent even when later entries exist. */
    expect(resolveTenantId({ headers: { 'x-tenant-id': ['  ', 'spoof'] } })).toBe('default')
  })

  it('falls back to "default" when the header is absent', () => {
    /** No header means no trusted tenant — the default tenant is used. */
    expect(resolveTenantId({ headers: {} })).toBe('default')
  })
})

describe('maskRecipient', () => {
  it('minimizes an email to its first character and domain', () => {
    /** `jane@acme.com` → `j***@acme.com`, the PII-minimized form persisted in audit. */
    expect(maskRecipient('jane@acme.com')).toBe('j***@acme.com')
  })
})

describe('resolveOtpStorage', () => {
  it('selects the in-memory store when no Redis client is present', () => {
    /** A `null` client (REDIS_URL unset) resolves to the process-local store. */
    expect(resolveOtpStorage(null)).toBeInstanceOf(InMemoryOtpStorage)
  })

  it('selects the Redis store when a client is present', () => {
    /** A present client resolves to the multi-instance Redis-backed store. */
    expect(resolveOtpStorage(fakeRedis)).toBeInstanceOf(RedisOtpStorage)
  })
})

describe('notificationConfig', () => {
  it('wires in-memory storage, a masker, and defaultFromName when configured', () => {
    /** REDIS null + masking on + a from-name exercises the in-memory/mask/from-name paths. */
    const options = notificationConfig(
      fakeConfig({ MAIL_FROM: 'no-reply@notification.local', MAIL_FROM_NAME: 'Bymax' }),
      null,
      prisma,
    )

    expect(options.global?.redisNamespace).toBe('notification')
    expect(options.global?.tenantIdResolver).toBe(resolveTenantId)
    expect(options.otp?.storage).toBeInstanceOf(InMemoryOtpStorage)
    expect(options.otp?.defaultLength).toBe(6)
    expect(options.otp?.perPurpose?.['password_reset']).toEqual({
      length: 8,
      codeType: 'alphanumeric',
      ttlSeconds: 900,
    })
    expect(options.email?.defaultFrom).toBe('no-reply@notification.local')
    expect(options.email?.defaultFromName).toBe('Bymax')
    expect(options.email?.maxAttachmentBytes).toBe(10 * 1024 * 1024)
    expect(options.email?.templateRenderer).toBeInstanceOf(DefaultTemplateRenderer)
    expect(options.email?.provider).toBeDefined()
    expect(options.audit?.swallowErrors).toBe(true)
    expect(options.audit?.maskRecipient?.('jane@acme.com')).toBe('j***@acme.com')
  })

  it('wires Redis storage, the identity masker, and omits an absent defaultFromName', () => {
    /** REDIS present + masking off + no from-name exercises the Redis/identity/omit paths. */
    const options = notificationConfig(
      fakeConfig({ MAIL_FROM: 'no-reply@notification.local', AUDIT_MASK_RECIPIENT: false }),
      fakeRedis,
      prisma,
    )

    expect(options.otp?.storage).toBeInstanceOf(RedisOtpStorage)
    expect(options.email?.defaultFromName).toBeUndefined()
    expect(options.audit?.maskRecipient?.('jane@acme.com')).toBe('jane@acme.com')
  })
})
