/**
 * End-to-end proof of the email send surface over HTTP.
 *
 * Drives the controllers with supertest against a capturing transport (so the rendered
 * message is assertable). Proves: `/email/send` and `/email/send-template` return
 * `{ messageId }`; an oversize attachment trips the library guard → 413
 * `EMAIL_ATTACHMENTS_TOO_LARGE`; an XSS payload is escaped in the HTML body only (the text
 * body stays raw); a `pt-BR` request with only `en` registered falls back to `en`; and a
 * template that exists in no locale → `TEMPLATE_NOT_FOUND`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'

import { createTestApp, type TestAppHandle } from './test-app.factory.js'

const request = (await import('supertest')).default

const TENANT = 'acme'

/** One byte over the configured 10 MiB attachment budget. */
const OVERSIZE_BYTES = 10 * 1024 * 1024 + 1

describe('Email sends (e2e)', () => {
  let handle: TestAppHandle

  const http = (): ReturnType<typeof request> => request(handle.app.getHttpServer())

  beforeAll(async () => {
    handle = await createTestApp()
  })
  beforeEach(() => handle.reset())
  afterAll(() => handle.close())

  it('sends a raw email returning { messageId }', async () => {
    /** /email/send hands the rendered body to the provider and returns its message id. */
    const res = await http()
      .post('/email/send')
      .set('x-tenant-id', TENANT)
      .send({ to: 'jane@acme.com', subject: 'Hello', html: '<p>Hello</p>' })
      .expect(201)

    expect(res.body).toEqual({ messageId: expect.any(String) })
    expect(handle.sentEmails).toHaveLength(1)
    expect(String(handle.sentEmails[0]?.['subject'])).toBe('Hello')
  })

  it('sends a template email returning { messageId } and renders the data', async () => {
    /** /email/send-template renders via the registry then sends; the data reaches the body. */
    const res = await http()
      .post('/email/send-template')
      .set('x-tenant-id', TENANT)
      .send({
        to: 'jane@acme.com',
        template: 'welcome',
        locale: 'en',
        data: { name: 'Jane', appName: 'Bymax', appUrl: 'http://localhost:3003' },
      })
      .expect(201)

    expect(res.body).toEqual({ messageId: expect.any(String) })
    expect(String(handle.sentEmails[0]?.['html'])).toContain('Jane')
  })

  it('rejects an oversize attachment with 413 EMAIL_ATTACHMENTS_TOO_LARGE', async () => {
    /** The library sums attachment bytes and throws past the 10 MiB budget → catalog 413. */
    const res = await http()
      .post('/email/send')
      .set('x-tenant-id', TENANT)
      .send({
        to: 'jane@acme.com',
        subject: 'Big',
        html: '<p>Big</p>',
        attachments: [{ filename: 'big.bin', content: 'A'.repeat(OVERSIZE_BYTES) }],
      })
      .expect(413)

    expect(res.body.error.code).toBe('notification.email_attachments_too_large')
    expect(handle.sentEmails).toHaveLength(0)
  })

  it('escapes an XSS payload in the html body only (text body stays raw)', async () => {
    /**
     * The default renderer HTML-escapes interpolated values in the html body but never in
     * the text body (not an HTML context). Protects against stored XSS through a name field.
     */
    await http()
      .post('/email/send-template')
      .set('x-tenant-id', TENANT)
      .send({
        to: 'jane@acme.com',
        template: 'welcome',
        locale: 'en',
        data: { name: '<script>alert(1)</script>', appName: 'Bymax', appUrl: 'http://x' },
      })
      .expect(201)

    const captured = handle.sentEmails[0] ?? {}
    expect(String(captured['html'])).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(String(captured['html'])).not.toContain('<script>')
    expect(String(captured['text'])).toContain('<script>alert(1)</script>')
  })

  it('falls back to en when the requested locale is unregistered', async () => {
    /** Only `welcome::en` is registered; a pt-BR request renders the en template. */
    await http()
      .post('/email/send-template')
      .set('x-tenant-id', TENANT)
      .send({
        to: 'jane@acme.com',
        template: 'welcome',
        locale: 'pt-BR',
        data: { name: 'Jane', appName: 'Bymax', appUrl: 'http://x' },
      })
      .expect(201)

    expect(String(handle.sentEmails[0]?.['subject'])).toBe('Welcome to Bymax')
  })

  it('returns TEMPLATE_NOT_FOUND when no locale of the template exists', async () => {
    /** A template registered in no locale (nor the en fallback) → catalog TEMPLATE_NOT_FOUND. */
    const res = await http()
      .post('/email/send-template')
      .set('x-tenant-id', TENANT)
      .send({ to: 'jane@acme.com', template: 'unregistered_template', locale: 'pt-BR', data: {} })
      .expect(500)

    expect(res.body.error.code).toBe('notification.template_not_found')
  })
})
