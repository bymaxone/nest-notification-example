/**
 * End-to-end verification of the application chassis.
 *
 * Boots the real `AppModule` (with `ioredis` mocked and `PrismaService` stubbed so no
 * live Redis/Postgres is needed) and proves:
 *   - `GET /health` returns 200 `{ status: 'ok' }`;
 *   - the app boots WITHOUT `REDIS_URL` (the `REDIS` token resolves to `null`);
 *   - the app boots WITH `REDIS_URL` set (the `REDIS` token resolves to a client).
 *
 * `ioredis` is mocked via `jest.unstable_mockModule` before any import that pulls it
 * in, so the with-Redis case constructs a fake client rather than opening a socket.
 *
 * `ConfigModule.forRoot` validates `process.env` when it is CALLED, so `DATABASE_URL`
 * is set before importing `AppModule`, and the with/without-Redis cases each call
 * `ConfigModule.forRoot` fresh inside the test with `REDIS_URL` toggled beforehand.
 */
import type { INestApplication } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals'

const mockRedisInstance = { quit: jest.fn<() => Promise<'OK'>>().mockResolvedValue('OK') }
const mockRedisConstructor = jest.fn(() => mockRedisInstance)

jest.unstable_mockModule('ioredis', () => ({
  Redis: mockRedisConstructor,
}))

// DATABASE_URL is mandatory and is validated when ConfigModule.forRoot is called —
// set it before importing AppModule (whose @Module metadata calls forRoot at import).
process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/app'
delete process.env['REDIS_URL']

const request = (await import('supertest')).default
const { Module } = await import('@nestjs/common')
const { ConfigModule } = await import('@nestjs/config')
const { Test } = await import('@nestjs/testing')
const { AppModule } = await import('../src/app.module.js')
const { PrismaService } = await import('../src/prisma/prisma.service.js')
const { RedisModule, REDIS } = await import('../src/redis/redis.module.js')
const { validateEnv } = await import('../src/config/env.schema.js')

/** A `PrismaService` stub whose lifecycle hooks resolve without touching a database. */
const prismaStub = {
  onModuleInit: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  onApplicationShutdown: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}

/** Build a fresh, isolated ConfigModule whose validation runs against the current env. */
function freshConfigModule(): ReturnType<typeof ConfigModule.forRoot> {
  return ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })
}

/** Compile a minimal module wiring ConfigModule + RedisModule and return the app. */
async function bootRedisHarness(redisUrl: string | undefined): Promise<INestApplication> {
  if (redisUrl === undefined) {
    delete process.env['REDIS_URL']
  } else {
    process.env['REDIS_URL'] = redisUrl
  }

  @Module({ imports: [freshConfigModule(), RedisModule] })
  class RedisHarnessModule {}

  const moduleRef = await Test.createTestingModule({ imports: [RedisHarnessModule] }).compile()
  const app = moduleRef.createNestApplication()
  await app.init()
  return app
}

describe('Application chassis (e2e)', () => {
  let app: INestApplication | undefined
  let healthApp: INestApplication

  beforeAll(async () => {
    // The full AppModule wires the exception filter, health route, Redis and Prisma;
    // PrismaService is overridden so no live database is required.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile()
    healthApp = moduleRef.createNestApplication()
    await healthApp.init()
  })

  afterEach(async () => {
    if (app) {
      await app.close()
      app = undefined
    }
    jest.clearAllMocks()
  })

  it('answers GET /health with 200 { status: ok } on the full AppModule', async () => {
    /** The liveness route on the real chassis must return the constant payload with 200. */
    const response = await request(healthApp.getHttpServer()).get('/health').expect(200)

    expect(response.body).toEqual({ status: 'ok' })
  })

  it('boots without REDIS_URL — the REDIS token resolves to null', async () => {
    /**
     * The OTP wiring branches on a `null` Redis client, so an unset `REDIS_URL` must
     * resolve the token to `null` (not throw) and the module must still boot.
     */
    app = await bootRedisHarness(undefined)

    expect(app.get<unknown>(REDIS)).toBeNull()
    expect(mockRedisConstructor).not.toHaveBeenCalled()
  })

  it('boots with REDIS_URL set — the REDIS token resolves to a client', async () => {
    /**
     * With `REDIS_URL` configured the token must resolve to the ioredis client built
     * from that URL (the constructor is mocked, so no real socket is opened).
     */
    app = await bootRedisHarness('redis://localhost:6379')

    expect(app.get<unknown>(REDIS)).toBe(mockRedisInstance)
    expect(mockRedisConstructor).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({ lazyConnect: true }),
    )
  })

  afterAll(async () => {
    await healthApp.close()
  })
})
