/**
 * Unit tests for {@link RedisModule}'s shutdown lifecycle.
 *
 * Covers both injected-client branches of `onApplicationShutdown`: a non-null client
 * is quit, while a `null` client (the `REDIS_URL`-unset path) is a safe no-op that
 * never throws.
 */
import type { Redis } from 'ioredis'
import { describe, expect, it, jest } from '@jest/globals'

import { REDIS, RedisModule } from './redis.module.js'

describe('RedisModule', () => {
  it('exposes REDIS as a Symbol DI token', () => {
    /** The token must be a `Symbol` so the OTP wiring can inject it unambiguously. */
    expect(typeof REDIS).toBe('symbol')
  })

  it('quits the client on shutdown when a client was created', async () => {
    /**
     * When `REDIS_URL` was set the injected client is non-null; shutdown must call
     * `quit()` once so in-flight commands flush and the socket closes cleanly.
     */
    const quit = jest.fn<() => Promise<'OK'>>().mockResolvedValue('OK')
    const client = { quit } as unknown as Redis
    const module = new RedisModule(client)

    await module.onApplicationShutdown()

    expect(quit).toHaveBeenCalledTimes(1)
  })

  it('is a no-op on shutdown when the client is null', async () => {
    /**
     * The `REDIS_URL`-unset path injects `null`; shutdown must resolve without throwing
     * and without attempting to quit a non-existent client.
     */
    const module = new RedisModule(null)

    await expect(module.onApplicationShutdown()).resolves.toBeUndefined()
  })
})
