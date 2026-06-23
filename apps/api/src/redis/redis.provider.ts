/**
 * Factory provider for the shared `ioredis` client.
 *
 * Layer: app/redis. Reads the OPTIONAL `REDIS_URL` from `ConfigService` and returns a
 * connected-on-demand `ioredis` client when it is set, or `null` when it is unset —
 * it NEVER throws on a missing URL, because the OTP storage selection treats `null` as
 * "use the in-memory store". The client uses a lazy connection so a transient Redis
 * outage does not block startup.
 *
 * @module
 */
import type { Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'

import type { Env } from '../config/env.schema.js'
import { REDIS } from './redis.token.js'

/** Linear back-off increment (ms) per reconnect attempt. */
export const RETRY_BACKOFF_STEP_MS = 200

/** Upper bound (ms) on the reconnect back-off delay. */
export const RETRY_BACKOFF_CAP_MS = 2_000

/**
 * Exponential-ish back-off capped at {@link RETRY_BACKOFF_CAP_MS}: early retries grow
 * linearly so transient blips recover quickly without hammering Redis.
 *
 * @param times - The reconnect attempt count (1-based).
 * @returns The delay in milliseconds before the next reconnect attempt.
 */
export function redisRetryStrategy(times: number): number {
  return Math.min(times * RETRY_BACKOFF_STEP_MS, RETRY_BACKOFF_CAP_MS)
}

/**
 * Provider that creates the shared `ioredis` client under the {@link REDIS} token, or
 * resolves to `null` when `REDIS_URL` is unset.
 */
export const redisProvider: Provider = {
  provide: REDIS,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): Redis | null => {
    const url = config.get('REDIS_URL', { infer: true }) // OPTIONAL — unset ⇒ in-memory OTP
    if (!url) {
      return null
    }
    return new Redis(url, {
      lazyConnect: true,
      // Required for blocking-command consumers (BL* family); without this, ioredis
      // queues commands indefinitely instead of failing fast on disconnect.
      maxRetriesPerRequest: null,
      retryStrategy: redisRetryStrategy,
    })
  },
}
