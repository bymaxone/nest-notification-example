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

import { createTestApp, lib, type TestAppHandle } from './test-app.factory.js'

const request = (await import('supertest')).default

const TENANT = 'acme'

describe('Dispatch façade (e2e)', () => {
  let handle: TestAppHandle

  const http = (): ReturnType<typeof request> => request(handle.app.getHttpServer())

  beforeAll(async () => {
    handle = await createTestApp()
  })
  beforeEach(() => handle.reset())
  afterAll(() => handle.close())

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
