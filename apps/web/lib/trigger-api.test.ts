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
    expect(String(spy.mock.calls[0]![0])).toContain('/email/send')
    expect(headersOf(spy)['x-tenant-id']).toBe('acme')
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
    expect(String(spy.mock.calls[0]![0])).toContain('/otp/generate')
    expect(result).toMatchObject({ channel: 'otp', verb: 'generated', purpose: 'login' })
  })

  /** verifyWrong fires /otp/verify with a wrong code and reports a failed verb + ok=false. */
  it('verifyWrong fires /otp/verify and reports not-ok on 4xx', async () => {
    const spy = stubFetch(400)
    const result = await triggerApi.verifyWrong('acme')
    expect(String(spy.mock.calls[0]![0])).toContain('/otp/verify')
    expect(bodyOf(spy).code).toBe('000000')
    expect(result).toMatchObject({ status: 400, ok: false, verb: 'failed' })
  })

  /** tripCooldown generates then resends (two calls), returning the resend status. */
  it('tripCooldown chains generate then resend', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
    const result = await triggerApi.tripCooldown('acme')
    expect(spy).toHaveBeenCalledTimes(2)
    expect(String(spy.mock.calls[0]![0])).toContain('/otp/generate')
    expect(String(spy.mock.calls[1]![0])).toContain('/otp/resend')
    expect(result).toMatchObject({ status: 429, ok: false, verb: 'cooldown_blocked' })
  })

  /** forceMaxAttempts generates then verifies repeatedly, returning the final status. */
  it('forceMaxAttempts chains generate + repeated verify', async () => {
    const spy = stubFetch(429)
    const result = await triggerApi.forceMaxAttempts('acme')
    expect(spy).toHaveBeenCalledTimes(7) // 1 generate + 6 verifies
    expect(result).toMatchObject({ status: 429, verb: 'max_attempts_exceeded' })
  })

  /** oversizeAttachment fires /email/send-template with a large attachment. */
  it('oversizeAttachment fires /email/send-template with an attachment', async () => {
    const spy = stubFetch(413)
    const result = await triggerApi.oversizeAttachment('acme')
    expect(String(spy.mock.calls[0]![0])).toContain('/email/send-template')
    const attachments = bodyOf(spy).attachments as Array<{ content: string }>
    expect(attachments[0]!.content.length).toBeGreaterThan(10 * 1024 * 1024)
    expect(result).toMatchObject({ status: 413, ok: false })
  })

  /** spoofTenant forges the body tenantId but keeps the trusted header tenant. */
  it('spoofTenant forges only the body tenantId', async () => {
    const spy = stubFetch(201)
    await triggerApi.spoofTenant('acme', 'globex')
    expect(headersOf(spy)['x-tenant-id']).toBe('acme') // trusted header unchanged
    expect(bodyOf(spy).tenantId).toBe('globex') // forged body tenant
  })

  /** dispatch fires /dispatch through the façade. */
  it('dispatch fires /dispatch', async () => {
    const spy = stubFetch(201)
    const result = await triggerApi.dispatch('acme')
    expect(String(spy.mock.calls[0]![0])).toContain('/dispatch')
    expect(bodyOf(spy).channel).toBe('email')
    expect(result).toMatchObject({ channel: 'email', verb: 'sent', ok: true })
  })
})
