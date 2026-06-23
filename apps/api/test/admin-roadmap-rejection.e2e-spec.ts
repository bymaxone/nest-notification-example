/**
 * End-to-end proof of the admin roadmap-rejection endpoints over HTTP.
 *
 * Boots an isolated NestJS application containing only `AdminModule` and drives the
 * three endpoints with supertest. Asserts that each returns the library's verbatim
 * startup-rejection message with `rejected: true`. `AdminModule` has no external
 * infrastructure dependencies — no Prisma, Redis, or ConfigModule is needed.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'

import { AdminModule } from '../src/admin/admin.module.js'

const request = (await import('supertest')).default

/**
 * Verbatim messages copied from the library source — must match byte-for-byte.
 * Gold sources:
 *   - src/server/config/validate-options.ts (sms, push)
 *   - src/server/bymax-notification.module.ts (assertUseFactory → useClass)
 */
const SMS_REJECTION =
  "[BymaxNotificationModule] SMS channel is not yet implemented (planned for v0.2). Remove 'sms' from options."
const PUSH_REJECTION =
  "[BymaxNotificationModule] Push channel is not yet implemented (planned for v0.2). Remove 'push' from options."
const USECLASS_REJECTION =
  '[BymaxNotificationModule] forRootAsync supports only `useFactory` in v0.1; `useClass` / `useExisting` are not yet implemented (planned for v0.2).'

describe('Admin roadmap-rejection endpoints (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AdminModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /admin/try-configure-sms returns the verbatim SMS rejection', async () => {
    /** Proves the library rejects the sms channel at startup with the exact error string. */
    const res = await request(app.getHttpServer()).post('/admin/try-configure-sms').expect(200)
    expect(res.body).toMatchObject({
      attempt: 'sms',
      rejected: true,
      errorName: 'Error',
      errorMessage: SMS_REJECTION,
    })
  })

  it('POST /admin/try-configure-push returns the verbatim Push rejection', async () => {
    /** Proves the library rejects the push channel at startup with the exact error string. */
    const res = await request(app.getHttpServer()).post('/admin/try-configure-push').expect(200)
    expect(res.body).toMatchObject({
      attempt: 'push',
      rejected: true,
      errorName: 'Error',
      errorMessage: PUSH_REJECTION,
    })
  })

  it('POST /admin/try-configure-async-useclass returns the verbatim useClass rejection', async () => {
    /** Proves the library rejects forRootAsync({ useClass }) with the exact error string. */
    const res = await request(app.getHttpServer())
      .post('/admin/try-configure-async-useclass')
      .expect(200)
    expect(res.body).toMatchObject({
      attempt: 'async-useclass',
      rejected: true,
      errorName: 'Error',
      errorMessage: USECLASS_REJECTION,
    })
  })
})
