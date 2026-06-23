/**
 * Module-compile integration check for the wired `AppModule`.
 *
 * Boots the real `AppModule` (with `PrismaService` stubbed and `REDIS_URL` unset so the
 * OTP storage resolves to the in-memory branch) and proves the P4 wiring DoD without
 * any HTTP surface: the `BymaxNotificationModule.forRootAsync` graph compiles, the
 * `NotificationService` resolves, and `getEnabledChannels()` reports `['email', 'otp']`.
 *
 * `ConfigModule.forRoot` validates `process.env` when CALLED, so `DATABASE_URL` is set
 * before importing `AppModule` (whose `@Module` metadata invokes `forRoot` at import).
 * The value is a non-secret stub: `PrismaService` is overridden so no connection opens.
 */
import type { TestingModule } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals'

// Snapshot the env keys this suite mutates, restoring them in afterAll so no mutation
// leaks into other e2e suites. `undefined` records a key that was originally unset.
const originalEnv: Record<string, string | undefined> = {
  DATABASE_URL: process.env['DATABASE_URL'],
  REDIS_URL: process.env['REDIS_URL'],
}

process.env['DATABASE_URL'] = 'postgresql://stub-user:stub-pass@localhost:5432/stub-db'
delete process.env['REDIS_URL']

const { Test } = await import('@nestjs/testing')
const { AppModule } = await import('../src/app.module.js')
const { PrismaService } = await import('../src/prisma/prisma.service.js')
const { NotificationService } = await import('@bymax-one/nest-notification')

/** A `PrismaService` stub whose lifecycle hooks resolve without touching a database. */
const prismaStub = {
  onModuleInit: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  onApplicationShutdown: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}

describe('AppModule wiring (e2e)', () => {
  let moduleRef: TestingModule

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile()
  })

  afterAll(async () => {
    await moduleRef.close()
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('compiles the forRootAsync graph and resolves NotificationService', () => {
    /** A resolvable NotificationService proves the async module graph wired cleanly. */
    expect(moduleRef.get(NotificationService)).toBeDefined()
  })

  it('reports email and otp as the enabled channels', () => {
    /** Both channels are configured by the factory, so the module enables exactly these. */
    expect(moduleRef.get(NotificationService).getEnabledChannels()).toEqual(['email', 'otp'])
  })
})
