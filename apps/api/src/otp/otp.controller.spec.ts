/**
 * Unit tests for {@link OtpController}.
 *
 * The `OtpService` is a plain mock; the controller is constructed directly without DI.
 * Covers every route plus the four verify status-mapping branches (200/401/404/429),
 * asserting the verify `max_attempts` → 429 sets the status with NO header side effect
 * (verify carries no cooldown), and that an absent vs supplied set of generate optionals
 * both produce the right service input (exactOptionalPropertyTypes-safe builder).
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import type { Response } from 'express'

import { OtpController } from './otp.controller.js'
import type { OtpService } from '@bymax-one/nest-notification'

/** Mocked surface of `OtpService` the controller touches. */
interface MockOtpService {
  generate: ReturnType<typeof jest.fn>
  resend: ReturnType<typeof jest.fn>
  verify: ReturnType<typeof jest.fn>
  consume: ReturnType<typeof jest.fn>
  getStatus: ReturnType<typeof jest.fn>
}

/** Build an `OtpController` backed by a mock `OtpService`. */
function buildController(): { controller: OtpController; service: MockOtpService } {
  const service: MockOtpService = {
    generate: jest.fn(),
    resend: jest.fn(),
    verify: jest.fn(),
    consume: jest.fn(),
    getStatus: jest.fn(),
  }
  const controller = new OtpController(service as unknown as OtpService)
  return { controller, service }
}

/** Minimal Express `Response` double capturing the status set via passthrough. */
function buildRes(): { res: Response; statusSpy: ReturnType<typeof jest.fn> } {
  const statusSpy = jest.fn()
  const res = { status: statusSpy } as unknown as Response
  return { res, statusSpy }
}

const TENANT = 'acme'

describe('OtpController.generate / resend', () => {
  let ctx: ReturnType<typeof buildController>

  beforeEach(() => {
    ctx = buildController()
  })

  it('forwards every supplied optional field to OtpService.generate', async () => {
    /**
     * Scenario: a full generate body with all optionals set.
     * Contract: the controller adds the trusted tenant and forwards each optional —
     * covers the "present" arm of every exactOptional-safe conditional spread.
     */
    ctx.service.generate.mockReturnValue(Promise.resolve({ expiresAt: 10, cooldownSeconds: 60 }))

    const result = await ctx.controller.generate(TENANT, {
      recipient: 'jane@acme.com',
      purpose: 'login',
      deliverVia: 'manual',
      emailTemplate: 'otp_code',
      emailData: { name: 'Jane' },
      locale: 'pt-BR',
    })

    expect(ctx.service.generate).toHaveBeenCalledWith({
      tenantId: TENANT,
      recipient: 'jane@acme.com',
      purpose: 'login',
      deliverVia: 'manual',
      emailTemplate: 'otp_code',
      emailData: { name: 'Jane' },
      locale: 'pt-BR',
    })
    expect(result).toEqual({ expiresAt: 10, cooldownSeconds: 60 })
  })

  it('omits absent optionals so the input stays exactOptional-safe', async () => {
    /**
     * Scenario: a minimal generate body (only recipient + purpose).
     * Contract: no optional keys are added — covers the "absent" arm of every spread, so
     * the service never receives an explicit `key: undefined`.
     */
    ctx.service.generate.mockReturnValue(Promise.resolve({ expiresAt: 1, cooldownSeconds: 60 }))

    await ctx.controller.generate(TENANT, { recipient: 'jane@acme.com', purpose: 'login' })

    expect(ctx.service.generate).toHaveBeenCalledWith({
      tenantId: TENANT,
      recipient: 'jane@acme.com',
      purpose: 'login',
    })
  })

  it('delegates resend to OtpService.resend with the same builder', async () => {
    /**
     * Scenario: a resend body.
     * Contract: resend reuses the trusted-tenant builder and forwards to the resend verb.
     */
    ctx.service.resend.mockReturnValue(Promise.resolve({ expiresAt: 2, cooldownSeconds: 60 }))

    const result = await ctx.controller.resend(TENANT, {
      recipient: 'jane@acme.com',
      purpose: 'login',
    })

    expect(ctx.service.resend).toHaveBeenCalledWith({
      tenantId: TENANT,
      recipient: 'jane@acme.com',
      purpose: 'login',
    })
    expect(result).toEqual({ expiresAt: 2, cooldownSeconds: 60 })
  })

  it('propagates a thrown OTP_COOLDOWN_ACTIVE so the filter sets the 429 + Retry-After', async () => {
    /**
     * Scenario: a generate inside an active cooldown — the service throws.
     * Contract: the controller does NOT swallow it; the global exception filter maps it
     * to 429 and attaches Retry-After. The controller stays thin.
     */
    ctx.service.generate.mockReturnValue(Promise.reject(new Error('cooldown')))

    await expect(
      ctx.controller.generate(TENANT, { recipient: 'jane@acme.com', purpose: 'login' }),
    ).rejects.toThrow('cooldown')
  })
})

describe('OtpController.verify', () => {
  let ctx: ReturnType<typeof buildController>

  beforeEach(() => {
    ctx = buildController()
  })

  it('sets 200 and returns { valid: true } on a correct code', async () => {
    /** Scenario: correct code. Contract: 200 status set on passthrough, success body. */
    ctx.service.verify.mockReturnValue(Promise.resolve({ valid: true }))
    const { res, statusSpy } = buildRes()

    const body = await ctx.controller.verify(
      TENANT,
      { recipient: 'jane@acme.com', purpose: 'login', code: '123456' },
      res,
    )

    expect(ctx.service.verify).toHaveBeenCalledWith({
      tenantId: TENANT,
      recipient: 'jane@acme.com',
      purpose: 'login',
      code: '123456',
    })
    expect(statusSpy).toHaveBeenCalledWith(200)
    expect(body).toEqual({ valid: true })
  })

  it('sets 401 with remainingAttempts on a wrong code (never the code)', async () => {
    /** Scenario: wrong code below the ceiling. Contract: 401 + counter, no code echoed. */
    ctx.service.verify.mockReturnValue(
      Promise.resolve({ valid: false, reason: 'invalid_code', remainingAttempts: 2 }),
    )
    const { res, statusSpy } = buildRes()

    const body = await ctx.controller.verify(
      TENANT,
      { recipient: 'jane@acme.com', purpose: 'login', code: '000000' },
      res,
    )

    expect(statusSpy).toHaveBeenCalledWith(401)
    expect(body).toEqual({ valid: false, reason: 'invalid_code', remainingAttempts: 2 })
  })

  it('sets 404 on a missing/expired entry', async () => {
    /** Scenario: no entry (or expired). Contract: 404 (expiry-as-not-found choice). */
    ctx.service.verify.mockReturnValue(Promise.resolve({ valid: false, reason: 'not_found' }))
    const { res, statusSpy } = buildRes()

    const body = await ctx.controller.verify(
      TENANT,
      { recipient: 'jane@acme.com', purpose: 'login', code: '000000' },
      res,
    )

    expect(statusSpy).toHaveBeenCalledWith(404)
    expect(body).toEqual({ valid: false, reason: 'not_found' })
  })

  it('sets 429 with NO Retry-After on max_attempts', async () => {
    /**
     * Scenario: the attempt ceiling was reached.
     * Contract: 429 set via passthrough, but the controller touches NO header — the res
     * double has only `status`, so any Retry-After write would throw. Verify has no cooldown.
     */
    ctx.service.verify.mockReturnValue(Promise.resolve({ valid: false, reason: 'max_attempts' }))
    const { res, statusSpy } = buildRes()

    const body = await ctx.controller.verify(
      TENANT,
      { recipient: 'jane@acme.com', purpose: 'login', code: '000000' },
      res,
    )

    expect(statusSpy).toHaveBeenCalledWith(429)
    expect(body).toEqual({ valid: false, reason: 'max_attempts' })
  })
})

describe('OtpController.consume / status', () => {
  let ctx: ReturnType<typeof buildController>

  beforeEach(() => {
    ctx = buildController()
  })

  it('delegates consume to OtpService.consume and resolves void', async () => {
    /** Scenario: consume an OTP. Contract: forward the trusted-tenant reference; 204 body. */
    ctx.service.consume.mockReturnValue(Promise.resolve(undefined))

    const result = await ctx.controller.consume(TENANT, {
      recipient: 'jane@acme.com',
      purpose: 'login',
    })

    expect(ctx.service.consume).toHaveBeenCalledWith({
      tenantId: TENANT,
      recipient: 'jane@acme.com',
      purpose: 'login',
    })
    expect(result).toBeUndefined()
  })

  it('returns the OtpStatusResult verbatim and never a code', async () => {
    /** Scenario: read status. Contract: forward query as the reference; return the code-free status. */
    const status = { exists: true, attempts: 1, maxAttempts: 5, cooldownSeconds: 0 }
    ctx.service.getStatus.mockReturnValue(Promise.resolve(status))

    const result = await ctx.controller.status(TENANT, {
      recipient: 'jane@acme.com',
      purpose: 'login',
    })

    expect(ctx.service.getStatus).toHaveBeenCalledWith({
      tenantId: TENANT,
      recipient: 'jane@acme.com',
      purpose: 'login',
    })
    expect(result).toBe(status)
    expect(JSON.stringify(result)).not.toContain('code')
  })
})
