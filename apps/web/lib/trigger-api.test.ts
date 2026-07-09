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

/**
 * Assert an OTP fire's method/headers/path and body, matching the per-fire unique recipient by
 * pattern while pinning every other route/body literal exactly (so the `POST` verb, purpose, and
 * `deliverVia`/`code` are all mutation-covered). Returns the fire's recipient for cross-call checks.
 */
function expectOtpFire(
  spy: ReturnType<typeof vi.spyOn>,
  call: number,
  pathSuffix: string,
  tenant: string,
  bodyRest: Record<string, unknown>,
): string {
  expect(String(spy.mock.calls[call]![0])).toContain(pathSuffix)
  const opts = spy.mock.calls[call]![1]!
  expect(opts.method).toBe('POST')
  expect(opts.headers).toEqual({ 'content-type': 'application/json', 'x-tenant-id': tenant })
  const { recipient, ...rest } = JSON.parse(opts.body as string) as Record<string, unknown>
  expect(recipient).toMatch(/^demo-.+@example\.com$/)
  expect(rest).toEqual(bodyRest)
  return recipient as string
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

  /** generateOtp fires /otp/generate against a fresh, self-contained recipient. */
  it('generateOtp fires /otp/generate', async () => {
    const spy = stubFetch()
    const result = await triggerApi.generateOtp('acme')
    // A per-fire unique recipient isolates OTP state, but its leading `d` keeps the masked pivot.
    expectOtpFire(spy, 0, '/otp/generate', 'acme', { purpose: 'login', deliverVia: 'manual' })
    expect(result).toMatchObject({
      channel: 'otp',
      verb: 'generated',
      purpose: 'login',
      recipient: 'd***@example.com',
    })
  })

  /** verifyWrong fires /otp/verify with a wrong code and reports a failed verb + ok=false. */
  it('verifyWrong fires /otp/verify and reports not-ok on 4xx', async () => {
    const spy = stubFetch(400)
    const result = await triggerApi.verifyWrong('acme')
    expectOtpFire(spy, 0, '/otp/verify', 'acme', { purpose: 'login', code: '000000' })
    expect(result).toMatchObject({
      status: 400,
      ok: false,
      channel: 'otp',
      verb: 'failed',
      recipient: 'd***@example.com',
    })
  })

  /** tripCooldown generates then resends (two calls) against ONE shared fresh recipient. */
  it('tripCooldown chains generate then resend', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
    const result = await triggerApi.tripCooldown('acme')
    expect(spy).toHaveBeenCalledTimes(2)
    const gen = expectOtpFire(spy, 0, '/otp/generate', 'acme', {
      purpose: 'login',
      deliverVia: 'manual',
    })
    const resend = expectOtpFire(spy, 1, '/otp/resend', 'acme', {
      purpose: 'login',
      deliverVia: 'manual',
    })
    // The generate + resend must share the SAME recipient, or the resend would not trip a cooldown.
    expect(resend).toBe(gen)
    expect(result).toMatchObject({
      status: 429,
      ok: false,
      channel: 'otp',
      verb: 'cooldown_blocked',
      recipient: 'd***@example.com',
    })
  })

  /** forceMaxAttempts generates then verifies repeatedly against ONE shared fresh recipient. */
  it('forceMaxAttempts chains generate + repeated verify', async () => {
    const spy = stubFetch(429)
    const result = await triggerApi.forceMaxAttempts('acme')
    expect(spy).toHaveBeenCalledTimes(7) // 1 generate + 6 verifies
    const gen = expectOtpFire(spy, 0, '/otp/generate', 'acme', {
      purpose: 'login',
      deliverVia: 'manual',
    })
    // Every verify must target the code the generate created — the same recipient across all calls.
    const verify = expectOtpFire(spy, 1, '/otp/verify', 'acme', {
      purpose: 'login',
      code: '000000',
    })
    expect(verify).toBe(gen)
    expect(result).toMatchObject({
      status: 429,
      channel: 'otp',
      verb: 'max_attempts_exceeded',
      recipient: 'd***@example.com',
    })
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
    expect(spy.mock.calls[0]![1]!.method).toBe('POST')
    expect(String(spy.mock.calls[0]![0])).toContain('/dispatch')
    const body = bodyOf(spy)
    expect(body.channel).toBe('otp')
    expect(body.tenantId).toBe('globex') // forged body tenant, ignored by the resolver
    const payload = body.payload as Record<string, unknown>
    expect(payload.recipient).toMatch(/^demo-.+@example\.com$/)
    expect(payload).toMatchObject({ purpose: 'login', deliverVia: 'manual' })
    expect(result).toMatchObject({
      channel: 'otp',
      verb: 'sent',
      purpose: 'login',
      recipient: 'd***@example.com',
    })
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
