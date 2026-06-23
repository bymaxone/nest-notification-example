/**
 * Unit tests for the {@link redisProvider} factory and its retry strategy.
 *
 * Covers both branches: `REDIS_URL` set (constructs a client with the required
 * options) and `REDIS_URL` unset (returns `null`, never throws). `ioredis` is mocked
 * so no real TCP connection is opened.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockRedisConstructor = jest.fn()

jest.unstable_mockModule('ioredis', () => ({
  Redis: mockRedisConstructor,
}))

const { redisProvider, redisRetryStrategy, RETRY_BACKOFF_CAP_MS } =
  await import('./redis.provider.js')

/** Minimal ConfigService stub whose `get('REDIS_URL', …)` returns the supplied value. */
function makeConfig(url: string | undefined): { get: jest.Mock } {
  return { get: jest.fn().mockReturnValue(url) }
}

/** Invoke the provider's `useFactory` with the given config stub. */
function runFactory(config: { get: jest.Mock }): unknown {
  const factory = (redisProvider as { useFactory: (c: typeof config) => unknown }).useFactory
  return factory(config)
}

describe('redisProvider.useFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRedisConstructor.mockReturnValue({ _isMockRedis: true })
  })

  it('reads REDIS_URL through ConfigService.get with type inference', () => {
    /** The factory must source the URL from `get('REDIS_URL', { infer: true })`. */
    const config = makeConfig('redis://localhost:6379')

    runFactory(config)

    expect(config.get).toHaveBeenCalledWith('REDIS_URL', { infer: true })
  })

  it('constructs an ioredis client with the required options when REDIS_URL is set', () => {
    /**
     * With a URL present, the factory must build a client with `lazyConnect: true` and
     * `maxRetriesPerRequest: null` (the blocking-command requirement).
     */
    const config = makeConfig('redis://localhost:6379')

    const result = runFactory(config)

    expect(mockRedisConstructor).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({ lazyConnect: true, maxRetriesPerRequest: null }),
    )
    expect(result).toEqual({ _isMockRedis: true })
  })

  it('returns null and never constructs a client when REDIS_URL is unset', () => {
    /**
     * The critical branch: an absent `REDIS_URL` must resolve to `null` (the value the
     * OTP wiring branches on), not throw and not construct a client.
     */
    const config = makeConfig(undefined)

    const result = runFactory(config)

    expect(result).toBeNull()
    expect(mockRedisConstructor).not.toHaveBeenCalled()
  })

  it('returns null for an empty-string REDIS_URL', () => {
    /** An empty string is falsy and must also resolve to the in-memory (null) path. */
    const config = makeConfig('')

    expect(runFactory(config)).toBeNull()
    expect(mockRedisConstructor).not.toHaveBeenCalled()
  })
})

describe('redisRetryStrategy', () => {
  it('backs off linearly by the step for small attempt counts', () => {
    /** Early retries grow by the 200ms step so transient blips recover quickly. */
    expect(redisRetryStrategy(1)).toBe(200)
    expect(redisRetryStrategy(5)).toBe(1_000)
  })

  it('caps the delay at the documented maximum', () => {
    /** High attempt counts must not produce an unbounded delay. */
    expect(redisRetryStrategy(20)).toBe(RETRY_BACKOFF_CAP_MS)
    expect(redisRetryStrategy(100)).toBe(RETRY_BACKOFF_CAP_MS)
  })
})
