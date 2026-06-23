/**
 * Global Redis module for `apps/api`.
 *
 * Layer: app/redis. Provides the `REDIS` DI token, which resolves to a shared
 * `ioredis` client when `REDIS_URL` is configured and to `null` when it is not — the
 * OTP wiring branches on this value (`redis ? RedisOtpStorage : InMemoryOtpStorage`),
 * so the absence of Redis is a value, never a thrown error. The connection is closed
 * on shutdown only when a client was actually created.
 *
 * @module
 */
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'

import { redisProvider } from './redis.provider.js'
import { REDIS } from './redis.token.js'

export { REDIS } from './redis.token.js'

/** Provides and exports the {@link REDIS} token globally, closing the client on shutdown. */
@Global()
@Module({ providers: [redisProvider], exports: [REDIS] })
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  /**
   * Close the Redis connection on application shutdown — only when a client exists.
   *
   * `quit()` flushes in-flight commands before closing the socket. When `REDIS_URL`
   * was unset the injected client is `null`, so this is a no-op.
   *
   * @returns A promise that resolves once the client is closed (or immediately when null).
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
    }
  }
}
