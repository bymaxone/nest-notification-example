/**
 * @fileoverview Unit tests for the Trigger Center demo client.
 *
 * Stubs global `fetch` and asserts each wrapper fires the right route(s) with the
 * trusted `x-tenant-id` header, returns a masked, code-free {@link TriggerResult}
 * with the correct pivot key, chains the multi-step fires (cooldown,
 * max-attempts), forges only the body tenant on a spoof, and maps status → ok.
 *
 * @module lib/trigger-api.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { maskRecipient, triggerApi } from './trigger-api'

/** Parse the JSON body of the Nth fetch call. */
function bodyOf(spy: ReturnType<typeof vi.spyOn>, call = 0): Record<string, unknown> {
  return JSON.parse(spy.mock.calls[call]![1]!.body as string) as Record<string, unknown>
}

/** Read the headers of the Nth fetch call. */
function headersOf(spy: ReturnType<typeof vi.spyOn>, call = 0): Record<string, string> {
  return spy.mock.calls[call]![1]!.headers as Record<string, string>
}

/**
 * Assert the Nth fetch call carried the exact POST envelope — path suffix, JSON content-type +
 * trusted tenant header, and the verbatim JSON body. Pins every route/body literal a fire sends.
 */
function expectFire(
  spy: ReturnType<typeof vi.spyOn>,
  call: number,
  pathSuffix: string,
  tenant: string,
  body: unknown,
): void {
  expect(String(spy.mock.calls[call]![0])).toContain(pathSuffix)
  expect(spy.mock.calls[call]![1]).toEqual({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenant },
    body: JSON.stringify(body),
  })
}

/** Stub fetch to resolve every call with the given status. */
function stubFetch(status = 201): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('maskRecipient', () => {
  /** Masks to first char + *** + domain. */
  it('masks the local part', () => {
    expect(maskRecipient('demo@example.com')).toBe('d***@example.com')
  })
})

describe('triggerApi', () => {
  /** sendEmail fires /email/send with the trusted header and a masked, sent result. */
  it('sendEmail fires /email/send', async () => {
    const spy = stubFetch(201)
    const result = await triggerApi.sendEmail('acme')
    expectFire(spy, 0, '/email/send', 'acme', {
      to: 'demo@example.com',
      subject: 'Hello from the console',
      html: '<p>Hi there</p>',
    })
    expect(result).toMatchObject({
      status: 201,
      ok: true,
      channel: 'email',
      verb: 'sent',
      recipient: 'd***@example.com',
      purpose: null,
    })
  })

  /** A blank tenant falls back to acme in the header. */
  it('defaults a blank tenant to acme', async () => {
    const spy = stubFetch()
    await triggerApi.sendEmail('')
    expect(headersOf(spy)['x-tenant-id']).toBe('acme')
  })

  /** generateOtp fires /otp/generate with the otp purpose. */
  it('generateOtp fires /otp/generate', async () => {
    const spy = stubFetch()
    const result = await triggerApi.generateOtp('acme')
    expectFire(spy, 0, '/otp/generate', 'acme', {
      recipient: 'demo@example.com',
      purpose: 'login',
      deliverVia: 'manual',
    })
    expect(result).toMatchObject({ channel: 'otp', verb: 'generated', purpose: 'login' })
  })

  /** verifyWrong fires /otp/verify with a wrong code and reports a failed verb + ok=false. */
  it('verifyWrong fires /otp/verify and reports not-ok on 4xx', async () => {
    const spy = stubFetch(400)
    const result = await triggerApi.verifyWrong('acme')
    expectFire(spy, 0, '/otp/verify', 'acme', {
      recipient: 'demo@example.com',
      purpose: 'login',
      code: '000000',
    })
    expect(result).toMatchObject({ status: 400, ok: false, channel: 'otp', verb: 'failed' })
  })

  /** tripCooldown generates then resends (two calls), returning the resend status. */
  it('tripCooldown chains generate then resend', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
    const result = await triggerApi.tripCooldown('acme')
    expect(spy).toHaveBeenCalledTimes(2)
    expectFire(spy, 0, '/otp/generate', 'acme', {
      recipient: 'demo@example.com',
      purpose: 'login',
      deliverVia: 'manual',
    })
    expectFire(spy, 1, '/otp/resend', 'acme', {
      recipient: 'demo@example.com',
      purpose: 'login',
      deliverVia: 'manual',
    })
    expect(result).toMatchObject({
      status: 429,
      ok: false,
      channel: 'otp',
      verb: 'cooldown_blocked',
    })
  })

  /** forceMaxAttempts generates then verifies repeatedly, returning the final status. */
  it('forceMaxAttempts chains generate + repeated verify', async () => {
    const spy = stubFetch(429)
    const result = await triggerApi.forceMaxAttempts('acme')
    expect(spy).toHaveBeenCalledTimes(7) // 1 generate + 6 verifies
    expectFire(spy, 0, '/otp/generate', 'acme', {
      recipient: 'demo@example.com',
      purpose: 'login',
      deliverVia: 'manual',
    })
    expectFire(spy, 1, '/otp/verify', 'acme', {
      recipient: 'demo@example.com',
      purpose: 'login',
      code: '000000',
    })
    expect(result).toMatchObject({ status: 429, channel: 'otp', verb: 'max_attempts_exceeded' })
  })

  /** oversizeAttachment fires /email/send-template with a large attachment. */
  it('oversizeAttachment fires /email/send-template with an attachment', async () => {
    const spy = stubFetch(413)
    const result = await triggerApi.oversizeAttachment('acme')
    expect(String(spy.mock.calls[0]![0])).toContain('/email/send-template')
    expect(headersOf(spy)).toEqual({ 'content-type': 'application/json', 'x-tenant-id': 'acme' })
    expect(spy.mock.calls[0]![1]!.method).toBe('POST')
    const body = bodyOf(spy)
    expect(body.to).toBe('demo@example.com')
    expect(body.template).toBe('welcome')
    expect(body.data).toEqual({ name: 'Demo' })
    const attachments = body.attachments as Array<{ filename: string; content: string }>
    expect(attachments[0]!.filename).toBe('huge.bin')
    expect(attachments[0]!.content.length).toBeGreaterThan(10 * 1024 * 1024)
    expect(result).toMatchObject({ status: 413, ok: false, channel: 'email', verb: 'failed' })
  })

  /** spoofTenant forges the body tenantId but keeps the trusted header tenant. */
  it('spoofTenant forges only the body tenantId', async () => {
    const spy = stubFetch(201)
    const result = await triggerApi.spoofTenant('acme', 'globex')
    expect(headersOf(spy)['x-tenant-id']).toBe('acme') // trusted header unchanged
    expectFire(spy, 0, '/dispatch', 'acme', {
      channel: 'otp',
      tenantId: 'globex', // forged body tenant, ignored by the resolver
      payload: { recipient: 'demo@example.com', purpose: 'login', deliverVia: 'manual' },
    })
    expect(result).toMatchObject({ channel: 'otp', verb: 'sent', purpose: 'login' })
  })

  /** dispatch fires /dispatch through the façade. */
  it('dispatch fires /dispatch', async () => {
    const spy = stubFetch(201)
    const result = await triggerApi.dispatch('acme')
    expectFire(spy, 0, '/dispatch', 'acme', {
      channel: 'email',
      payload: { to: 'demo@example.com', subject: 'Dispatched', html: '<p>Via façade</p>' },
    })
    expect(result).toMatchObject({ channel: 'email', verb: 'sent', ok: true })
  })
})
