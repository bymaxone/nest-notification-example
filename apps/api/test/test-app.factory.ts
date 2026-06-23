/**
 * Shared e2e bootstrap for the OTP/email/dispatch/debug HTTP surface.
 *
 * Boots the real `AppModule` and overrides only the two external boundaries so the suite
 * is deterministic and needs no live stack (per the test runbook):
 *   - the email provider token is replaced by a CAPTURING provider (the "Mailpit" seam)
 *     that records every rendered message so XSS-escape + render output are assertable;
 *   - `PrismaService` is replaced by a fake whose `notificationLog.create` records the
 *     audit row the repository would persist.
 *
 * `REDIS_URL` is unset so the OTP storage resolves to the in-memory branch; `DATABASE_URL`
 * is a non-secret, credential-free stub (PrismaService is overridden, so no connection
 * opens). Env is set at module load — before `AppModule` is imported — because
 * `ConfigModule.forRoot` validates `process.env` during initialization.
 */
import type { INestApplication } from '@nestjs/common'
import type { TestingModuleBuilder } from '@nestjs/testing'

process.env['DATABASE_URL'] ??= 'postgresql://localhost:5432/stub-db'
delete process.env['REDIS_URL']

const { Test } = await import('@nestjs/testing')
const { AppModule } = await import('../src/app.module.js')
const { PrismaService } = await import('../src/prisma/prisma.service.js')
const lib = await import('@bymax-one/nest-notification')
const express = (await import('express')).default

/**
 * JSON body limit for the e2e app. Raised above Nest's 100 KB default so an attachment
 * large enough to trip the library's 10 MiB attachment guard reaches the controller (and
 * yields the catalog 413) rather than being rejected by the body parser first.
 */
const E2E_BODY_LIMIT = '15mb'

/** A captured outbound message, as handed to the email provider. */
export type CapturedEmail = Record<string, unknown>

/** Handle over a booted test app plus its in-process capture seams. */
export interface TestAppHandle {
  app: INestApplication
  storage: InstanceType<typeof lib.InMemoryOtpStorage>
  sentEmails: CapturedEmail[]
  auditRows: Array<Record<string, unknown>>
  reset: () => void
  close: () => Promise<void>
}

/**
 * Boot the full app with the capturing provider + fake Prisma audit sink.
 *
 * @param customize - Optional hook to add further provider overrides (e.g. to disable a
 *   channel) before the module compiles.
 * @returns A handle exposing the app, the in-memory OTP storage, the captured emails and
 *   audit rows, plus `reset`/`close` lifecycle helpers.
 */
export async function createTestApp(
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<TestAppHandle> {
  const sentEmails: CapturedEmail[] = []
  const auditRows: Array<Record<string, unknown>> = []

  const captureProvider = {
    name: 'capture',
    isConfigured: (): boolean => true,
    send: (options: Record<string, unknown>): Promise<{ messageId: string }> => {
      sentEmails.push(options)
      return Promise.resolve({ messageId: `captured-${sentEmails.length}` })
    },
  }

  const fakePrisma = {
    notificationLog: {
      create: (args: { data: Record<string, unknown> }): Promise<unknown> => {
        auditRows.push(args.data)
        return Promise.resolve({})
      },
    },
    onModuleInit: (): Promise<void> => Promise.resolve(),
    onApplicationShutdown: (): Promise<void> => Promise.resolve(),
  }

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(fakePrisma)
    .overrideProvider(lib.BYMAX_NOTIFICATION_EMAIL_PROVIDER)
    .useValue(captureProvider)
  if (customize) {
    builder = customize(builder)
  }

  const moduleRef = await builder.compile()
  // Disable Nest's default body parser and install a higher-limit JSON parser so the
  // oversize-attachment path exercises the library guard rather than a 100 KB body limit.
  const app = moduleRef.createNestApplication({ bodyParser: false })
  app.use(express.json({ limit: E2E_BODY_LIMIT }))
  await app.init()
  const storage = moduleRef.get(lib.BYMAX_NOTIFICATION_OTP_STORAGE)

  const reset = (): void => {
    sentEmails.length = 0
    auditRows.length = 0
    storage.clear()
  }
  const close = (): Promise<void> => app.close()

  return { app, storage, sentEmails, auditRows, reset, close }
}

/** Re-export the library handle so specs can reach DI tokens without re-importing. */
export { lib }
