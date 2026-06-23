/**
 * End-to-end proof of `GET /debug/key` over HTTP.
 *
 * Proves the route returns the opaque `sha256(tenantId:recipient)` storage key (a 64-hex
 * digest) for the trusted tenant + recipient — never the plaintext recipient and never a
 * code — matching the library's `hashTenantRecipient`.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import { hashTenantRecipient } from '@bymax-one/nest-notification'

import { createTestApp, type TestAppHandle } from './test-app.factory.js'

const request = (await import('supertest')).default

const TENANT = 'acme'
const RECIPIENT = 'jane@acme.com'

describe('Debug key (e2e)', () => {
  let handle: TestAppHandle

  beforeAll(async () => {
    handle = await createTestApp()
  })
  afterAll(() => handle.close())

  it('returns the 64-hex hashTenantRecipient key, never the plaintext recipient', async () => {
    /** The Inspect-OTP panel reads only the opaque hashed key for `(tenant, recipient)`. */
    const res = await request(handle.app.getHttpServer())
      .get('/debug/key')
      .query({ recipient: RECIPIENT })
      .set('x-tenant-id', TENANT)
      .expect(200)

    expect(res.body).toEqual({ key: hashTenantRecipient(TENANT, RECIPIENT) })
    expect(String(res.body.key)).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(res.body)).not.toContain(RECIPIENT)
  })
})
