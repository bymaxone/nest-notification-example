/**
 * End-to-end proof of the dispatch façade + introspection reads over HTTP.
 *
 * Drives the controllers with supertest. Proves: `/dispatch` routes an email and an otp
 * payload through `NotificationService`; `GET /channels` → `['email','otp']`;
 * `GET /config/status` returns the resolved-config snapshot (adapter names + flags, no
 * secrets); an email payload with neither a template nor subject+html → `EMAIL_MISSING_BODY`
 * (400); and a dispatch to a channel whose service is absent → `CHANNEL_DISABLED` (501).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'

import {
  createTestApp,
  lib,
  setupTestEnv,
  teardownTestEnv,
  type TestAppHandle,
} from './test-app.factory.js'

const request = (await import('supertest')).default

const TENANT = 'acme'

describe('Dispatch façade (e2e)', () => {
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

  it('dispatches an email payload and returns the email result', async () => {
    /** /dispatch email → NotificationService.dispatch → { channel: 'email', messageId }. */
    const res = await http()
      .post('/dispatch')
      .set('x-tenant-id', TENANT)
      .send({
        channel: 'email',
        payload: { to: 'jane@acme.com', subject: 'Hi', html: '<p>Hi</p>' },
      })
      .expect(201)

    expect(res.body).toEqual({ channel: 'email', messageId: expect.any(String) })
    expect(handle.sentEmails).toHaveLength(1)
  })

  it('dispatches an otp generate payload and returns the otp result', async () => {
    /** /dispatch otp (action generate) → { channel: 'otp', result: { expiresAt, cooldownSeconds } }. */
    const res = await http()
      .post('/dispatch')
      .set('x-tenant-id', TENANT)
      .send({
        channel: 'otp',
        payload: {
          recipient: 'jane@acme.com',
          purpose: 'login',
          action: 'generate',
          deliverVia: 'manual',
        },
      })
      .expect(201)

    expect(res.body.channel).toBe('otp')
    expect(res.body.result).toEqual({
      expiresAt: expect.any(Number),
      cooldownSeconds: expect.any(Number),
    })
  })

  it('records a masked, code-free __interceptor__ audit row for the HTTP boundary', async () => {
    /**
     * The whole reason the handler takes a prebuilt `DispatchInput`: the library's audit
     * interceptor now narrows on it and writes one `sent` row stamped `providerName:
     * '__interceptor__'` — the source the Explorer's interceptor facet reads. The row is masked
     * (never the raw recipient) and carries no dispatched payload (so no OTP code can leak).
     */
    await http()
      .post('/dispatch')
      .set('x-tenant-id', TENANT)
      .send({
        channel: 'otp',
        payload: {
          recipient: 'jane@acme.com',
          purpose: 'login',
          action: 'generate',
          deliverVia: 'manual',
        },
      })
      .expect(201)

    const interceptorRows = handle.auditRows.filter((r) => r['providerName'] === '__interceptor__')
    expect(interceptorRows.length).toBeGreaterThan(0)
    const row = interceptorRows[0] as Record<string, unknown>
    expect(row['verb']).toBe('sent')
    expect(row['channel']).toBe('otp')
    expect(row['recipient']).not.toBe('jane@acme.com') // masked at the write seam
    expect(row).not.toHaveProperty('code') // the audit log has no code column, ever
  })

  it('never logs a supplied OTP code in the interceptor audit row', async () => {
    /**
     * A verify dispatch carries a guessed `code`; even when it fails (no active OTP) the
     * interceptor records a masked `failed` boundary row — and that row must never contain the
     * supplied code (`JSON.stringify(row).includes(code) === false`).
     */
    const SECRET_CODE = '987654'
    await http()
      .post('/dispatch')
      .set('x-tenant-id', TENANT)
      .send({
        channel: 'otp',
        payload: {
          recipient: 'jane@acme.com',
          purpose: 'login',
          action: 'verify',
          code: SECRET_CODE,
        },
      })

    const interceptorRows = handle.auditRows.filter((r) => r['providerName'] === '__interceptor__')
    expect(interceptorRows.length).toBeGreaterThan(0)
    expect(JSON.stringify(interceptorRows)).not.toContain(SECRET_CODE)
  })

  it('lists the enabled channels', async () => {
    /** GET /channels reports exactly the configured channels. */
    const res = await http().get('/channels').set('x-tenant-id', TENANT).expect(200)

    expect(res.body).toEqual(['email', 'otp'])
  })

  it('reports the resolved config snapshot with no secrets', async () => {
    /**
     * GET /config/status exposes adapter names + flags read from the resolved options +
     * tokens — masking is active, consumeOnVerify defaults to false — and never a secret.
     */
    const res = await http().get('/config/status').set('x-tenant-id', TENANT).expect(200)

    expect(res.body).toEqual({
      channels: ['email', 'otp'],
      provider: 'capture',
      storage: 'memory',
      renderer: 'default-interpolation',
      consumeOnVerify: false,
      swallowErrors: true,
      maskRecipient: true,
      defaultLocale: 'en',
    })
    expect(JSON.stringify(res.body)).not.toMatch(/apikey|password|secret|token/i)
  })

  it('maps an email payload with no body source to EMAIL_MISSING_BODY (400)', async () => {
    /** Neither a template nor subject+html → the library throws → catalog 400. */
    const res = await http()
      .post('/dispatch')
      .set('x-tenant-id', TENANT)
      .send({ channel: 'email', payload: { to: 'jane@acme.com' } })
      .expect(400)

    expect(res.body.error.code).toBe('notification.email_missing_body')
  })

  it('maps a dispatch to a disabled channel to CHANNEL_DISABLED (501)', async () => {
    /**
     * With the otp channel absent from the façade, dispatching otp throws CHANNEL_DISABLED,
     * which the filter maps to 501 — proving the channel-gating path end to end.
     */
    const disabled = await createTestApp((builder) =>
      builder.overrideProvider(lib.NotificationService).useValue(new lib.NotificationService()),
    )
    try {
      const res = await request(disabled.app.getHttpServer())
        .post('/dispatch')
        .set('x-tenant-id', TENANT)
        .send({ channel: 'otp', payload: { recipient: 'jane@acme.com', purpose: 'login' } })
        .expect(501)

      expect(res.body.error.code).toBe('notification.channel_disabled')
    } finally {
      await disabled.close()
    }
  })
})
