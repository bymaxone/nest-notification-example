/**
 * End-to-end proof of the OTP lifecycle over HTTP.
 *
 * Drives the real controller surface with supertest against in-memory OTP storage + a
 * mocked transport. Proves: generate returns `{ expiresAt, cooldownSeconds }` and never
 * the code; a wrong code → 401 with a decreasing `remainingAttempts`; the
 * `(defaultMaxAttempts + 1)`th wrong attempt → 429 `max_attempts` with NO `Retry-After`
 * (verify carries no cooldown); a second generate inside the cooldown window → 429 WITH
 * `Retry-After` (the only Retry-After path); consume is idempotent (204); status returns
 * state without the code; a correct code → 200; an unknown/expired code → 404.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import type { ResolvedNotificationOptions } from '@bymax-one/nest-notification'

import {
  createTestApp,
  lib,
  setupTestEnv,
  teardownTestEnv,
  type TestAppHandle,
} from './test-app.factory.js'

const request = (await import('supertest')).default

const TENANT = 'acme'
const PURPOSE = 'login'

describe('OTP lifecycle (e2e)', () => {
  let handle: TestAppHandle
  let maxAttempts: number

  /** Issue a request against the booted app with the trusted tenant header set. */
  const http = (): ReturnType<typeof request> => request(handle.app.getHttpServer())

  /** Read the (never-exposed) stored code for assertions. */
  const storedCode = async (recipient: string): Promise<string> =>
    (await handle.storage.get(TENANT, recipient, PURPOSE))?.code ?? ''

  beforeAll(async () => {
    setupTestEnv()
    handle = await createTestApp()
    const options = handle.app.get<ResolvedNotificationOptions>(lib.BYMAX_NOTIFICATION_OPTIONS)
    if (!options.otp) {
      throw new Error('OTP channel must be configured for this suite')
    }
    maxAttempts = options.otp.resolveForPurpose(PURPOSE).maxAttempts
  })

  beforeEach(() => handle.reset())
  afterAll(async () => {
    await handle.close()
    teardownTestEnv()
  })

  it('generates an OTP returning { expiresAt, cooldownSeconds } without the code', async () => {
    /** generate persists a code and returns only its expiry + cooldown — never the code. */
    const recipient = 'gen@acme.com'

    const res = await http()
      .post('/otp/generate')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE, deliverVia: 'manual' })
      .expect(201)

    expect(res.body).toEqual({
      expiresAt: expect.any(Number),
      cooldownSeconds: expect.any(Number),
    })
    expect(JSON.stringify(res.body)).not.toContain(await storedCode(recipient))
  })

  it('rejects wrong codes with 401 + decreasing remainingAttempts, then 429 max_attempts (no Retry-After)', async () => {
    /**
     * The atomic attempt counter must surface as 401 (invalid_code) with a decreasing
     * `remainingAttempts` for the first `defaultMaxAttempts` wrong guesses, then lock out
     * on the `(defaultMaxAttempts + 1)`th with 429 `max_attempts` and NO Retry-After —
     * verify has no cooldown, so it never sets one. Protects against brute force.
     */
    const recipient = 'lockout@acme.com'
    await http()
      .post('/otp/generate')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE, deliverVia: 'manual' })
      .expect(201)
    const realCode = await storedCode(recipient)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await http()
        .post('/otp/verify')
        .set('x-tenant-id', TENANT)
        .send({ recipient, purpose: PURPOSE, code: 'wrong-guess' })
        .expect(401)
      expect(res.body).toEqual({
        valid: false,
        reason: 'invalid_code',
        remainingAttempts: maxAttempts - attempt,
      })
      expect(JSON.stringify(res.body)).not.toContain(realCode)
    }

    const locked = await http()
      .post('/otp/verify')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE, code: 'wrong-guess' })
      .expect(429)
    expect(locked.body).toEqual({ valid: false, reason: 'max_attempts' })
    expect(locked.headers['retry-after']).toBeUndefined()
  })

  it('blocks a second generate inside the cooldown with 429 + Retry-After (the only Retry-After path)', async () => {
    /**
     * The first generate claims the resend cooldown; a second within the window throws
     * `OTP_COOLDOWN_ACTIVE`, which the filter maps to 429 and surfaces as a `Retry-After`
     * header derived from the cooldown helper — the sole Retry-After path in the surface.
     */
    const recipient = 'cooldown@acme.com'
    await http()
      .post('/otp/generate')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE, deliverVia: 'manual' })
      .expect(201)

    const blocked = await http()
      .post('/otp/generate')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE, deliverVia: 'manual' })
      .expect(429)

    expect(blocked.body.error.code).toBe('notification.otp_cooldown_active')
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('consumes an OTP idempotently (204 both times)', async () => {
    /** consume deletes the OTP + clears its cooldown; a repeat call is a no-op 204. */
    const recipient = 'consume@acme.com'
    await http()
      .post('/otp/generate')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE, deliverVia: 'manual' })
      .expect(201)

    await http()
      .post('/otp/consume')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE })
      .expect(204)
    await http()
      .post('/otp/consume')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE })
      .expect(204)
  })

  it('reports status without ever exposing the code', async () => {
    /** status returns existence + counters + cooldown, but the plaintext code is never in it. */
    const recipient = 'status@acme.com'
    await http()
      .post('/otp/generate')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE, deliverVia: 'manual' })
      .expect(201)
    const realCode = await storedCode(recipient)

    const res = await http()
      .get('/otp/status')
      .query({ recipient, purpose: PURPOSE })
      .set('x-tenant-id', TENANT)
      .expect(200)

    expect(res.body.exists).toBe(true)
    expect(res.body).toHaveProperty('cooldownSeconds')
    expect(JSON.stringify(res.body)).not.toContain(realCode)
  })

  it('verifies a correct code with 200 { valid: true }', async () => {
    /** A correct guess returns 200 with the minimal success body. */
    const recipient = 'correct@acme.com'
    await http()
      .post('/otp/generate')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE, deliverVia: 'manual' })
      .expect(201)
    const realCode = await storedCode(recipient)

    const res = await http()
      .post('/otp/verify')
      .set('x-tenant-id', TENANT)
      .send({ recipient, purpose: PURPOSE, code: realCode })
      .expect(200)

    expect(res.body).toEqual({ valid: true })
  })

  it('maps an unknown/expired code to 404 not_found', async () => {
    /** No entry (or an expired one) is indistinguishable → 404, never 410. */
    const res = await http()
      .post('/otp/verify')
      .set('x-tenant-id', TENANT)
      .send({ recipient: 'nobody@acme.com', purpose: PURPOSE, code: '000000' })
      .expect(404)

    expect(res.body).toEqual({ valid: false, reason: 'not_found' })
  })
})
