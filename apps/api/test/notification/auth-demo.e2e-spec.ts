/**
 * End-to-end proof of the optional nest-auth password-reset seam (the auth-demo journey).
 *
 * Boots the real AppModule with a capturing email transport and an in-memory Prisma fake,
 * then drives POST /auth-demo/password-reset and asserts:
 *   - response is { status: 'sent' } with no OTP echoed;
 *   - a 'sent' audit row is written for the email channel with the recipient masked;
 *   - no OTP was generated through nest-notification's OtpService (OTP storage is empty
 *     and no 'generated' audit row is present), proving the no-duplication rule.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'

import {
  createTestApp,
  setupTestEnv,
  teardownTestEnv,
  type TestAppHandle,
} from '../test-app.factory.js'

const request = (await import('supertest')).default

const TENANT = 'demo'
const RECIPIENT = 'user@example.com'

describe('Auth-demo password-reset seam (e2e)', () => {
  let handle: TestAppHandle
  const http = (): ReturnType<typeof request> => request(handle.app.getHttpServer())

  beforeAll(async () => {
    setupTestEnv()
    handle = await createTestApp()
  })
  beforeEach(() => handle.reset())
  afterAll(async () => {
    await handle.close()
    teardownTestEnv()
  })

  it('returns { status: "sent" } and does not echo any OTP code', async () => {
    /**
     * The OTP is minted internally; the response must not contain any 6-or-more-digit
     * numeric sequence that would indicate the code was leaked to the caller.
     */
    const res = await http()
      .post('/auth-demo/password-reset')
      .set('x-tenant-id', TENANT)
      .send({ to: RECIPIENT })
      .expect(201)

    expect(res.body).toEqual({ status: 'sent' })
    expect(JSON.stringify(res.body)).not.toMatch(/\d{6,}/)
  })

  it('writes a "sent" audit row for the email channel with the recipient masked', async () => {
    /**
     * The send flows through EmailService.sendTemplate which writes a delivery-audit row.
     * The recipient is masked by the audit configuration; the raw address must not appear.
     */
    await http()
      .post('/auth-demo/password-reset')
      .set('x-tenant-id', TENANT)
      .send({ to: RECIPIENT })
      .expect(201)

    const sentRow = handle.auditRows.find((r) => r['verb'] === 'sent' && r['channel'] === 'email')
    expect(sentRow).toBeDefined()
    // Recipient must be masked — first character + *** + domain.
    expect(sentRow?.['recipient']).toMatch(/^u\*\*\*@/)
    // The raw recipient address must not appear in any field of the persisted row.
    expect(JSON.stringify(sentRow)).not.toContain(RECIPIENT)
  })

  it('does not invoke nest-notification OtpService — no generated row and OTP storage is empty', async () => {
    /**
     * The stand-in OTP represents what nest-auth's OtpService would emit; this adapter
     * only renders and sends an already-generated code. Verified by the absence of a
     * 'generated' audit row and by the in-memory OTP storage remaining empty.
     */
    await http()
      .post('/auth-demo/password-reset')
      .set('x-tenant-id', TENANT)
      .send({ to: RECIPIENT })
      .expect(201)

    // No OTP was generated through nest-notification's OtpService.
    const generatedRow = handle.auditRows.find((r) => r['verb'] === 'generated')
    expect(generatedRow).toBeUndefined()

    // The in-memory OTP storage is reset in beforeEach and must remain empty after the call.
    const storageSize = handle.storage.size()
    expect(storageSize.otps).toBe(0)
  })
})
