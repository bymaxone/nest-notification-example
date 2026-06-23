/**
 * Unit tests for {@link PrismaService}.
 *
 * Covers the lifecycle contract bridging Prisma to the NestJS app: the constructor
 * sources `DATABASE_URL` through `ConfigService.getOrThrow`, `onModuleInit` connects
 * the pool, and `onApplicationShutdown` disconnects it. `$connect`/`$disconnect` are
 * stubbed on the instance so no real database connection is opened.
 */
import type { ConfigService } from '@nestjs/config'
import { describe, expect, it, jest } from '@jest/globals'

import type { Env } from '../config/env.schema.js'
import { PrismaService } from './prisma.service.js'

/** Build a `ConfigService` double whose `getOrThrow` returns the supplied URL for DATABASE_URL. */
function buildConfig(url: string): {
  config: ConfigService<Env, true>
  getOrThrow: jest.Mock
} {
  const getOrThrow = jest.fn((key: unknown) => {
    if (key === 'DATABASE_URL') return url
    throw new Error(`unexpected key: ${String(key)}`)
  })
  return { config: { getOrThrow } as unknown as ConfigService<Env, true>, getOrThrow }
}

const TEST_URL = 'postgresql://stub-user:stub-pass@db.internal:5432/stub-db'

describe('PrismaService', () => {
  it('reads DATABASE_URL through ConfigService.getOrThrow to wire the adapter', () => {
    /**
     * The constructor must source the connection string from
     * `ConfigService.getOrThrow('DATABASE_URL')` so a missing URL fails fast at boot.
     */
    const { config, getOrThrow } = buildConfig(TEST_URL)

    const service = new PrismaService(config)

    expect(service.constructor.name).toBe('PrismaService')
    expect(getOrThrow).toHaveBeenCalledTimes(1)
    expect(getOrThrow).toHaveBeenCalledWith('DATABASE_URL')
  })

  it('connects the pool on onModuleInit', async () => {
    /** `onModuleInit` must open the connection by delegating to the inherited `$connect`. */
    const { config } = buildConfig(TEST_URL)
    const service = new PrismaService(config)
    const connect = jest.spyOn(service, '$connect').mockImplementation(() => Promise.resolve())

    await service.onModuleInit()

    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('disconnects the pool on onApplicationShutdown', async () => {
    /** `onApplicationShutdown` must release the pool by delegating to `$disconnect`. */
    const { config } = buildConfig(TEST_URL)
    const service = new PrismaService(config)
    const disconnect = jest
      .spyOn(service, '$disconnect')
      .mockImplementation(() => Promise.resolve())

    await service.onApplicationShutdown()

    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
