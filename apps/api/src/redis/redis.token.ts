/**
 * DI token for the shared Redis client.
 *
 * Layer: app/redis. Defined in its own module so both `redis.module.ts` and
 * `redis.provider.ts` can import it without forming an import cycle (the module
 * imports the provider, so the token cannot live in the module). The token is
 * re-exported from `redis.module.ts` for ergonomic consumption.
 *
 * @module
 */

/** DI token for the shared ioredis client — resolves to a client OR `null` when `REDIS_URL` is unset. */
export const REDIS = Symbol('REDIS')
