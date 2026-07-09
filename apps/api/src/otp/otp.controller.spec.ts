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
import type { ConfigService } from '@nestjs/config'
import type { Response } from 'express'

import type { Env } from '../config/env.schema.js'
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

/**
 * Build an `OtpController` backed by a mock `OtpService`.
 *
 * @param appName - The value `ConfigService.get('MAIL_FROM_NAME')` returns; `undefined` (the
 *   default) exercises the controller's `DEFAULT_APP_NAME` ('Bymax') fallback.
 */
function buildController(appName: string | undefined = undefined): {
  controller: OtpController
  service: MockOtpService
} {
  const service: MockOtpService = {
    generate: jest.fn(),
    resend: jest.fn(),
    verify: jest.fn(),
    consume: jest.fn(),
    getStatus: jest.fn(),
  }
  const config = { get: jest.fn(() => appName) } as unknown as ConfigService<Env, true>
  const controller = new OtpController(service as unknown as OtpService, config)
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
     * Contract: the controller adds the trusted tenant and forwards each optional — covers the
     * "present" arm of every exactOptional-safe conditional spread. Caller-supplied `emailData`
     * wins over the injected presentation defaults (the explicit `name: 'Jane'` survives).
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
      emailData: { appName: 'Bymax', name: 'Jane' },
      locale: 'pt-BR',
    })
    expect(result).toEqual({ expiresAt: 10, cooldownSeconds: 60 })
  })

  it('injects presentation defaults so a delivered OTP email never renders empty variables', async () => {
    /**
     * Scenario: a minimal generate body (only recipient + purpose).
     * Contract: no other optional keys are added (the "absent" arm of every conditional spread),
     * but `emailData` always carries a non-empty `appName` (the fallback) and a `name` derived
     * from the recipient local-part — so the OTP email subject/body never collapse to
     * `Your  verification code` / `Hi , …`.
     */
    ctx.service.generate.mockReturnValue(Promise.resolve({ expiresAt: 1, cooldownSeconds: 60 }))

    await ctx.controller.generate(TENANT, { recipient: 'jane@acme.com', purpose: 'login' })

    expect(ctx.service.generate).toHaveBeenCalledWith({
      tenantId: TENANT,
      recipient: 'jane@acme.com',
      purpose: 'login',
      emailData: { appName: 'Bymax', name: 'jane' },
    })
  })

  it('fills {{appName}} from the configured MAIL_FROM_NAME when set', async () => {
    /**
     * Scenario: MAIL_FROM_NAME is configured (the sender display name).
     * Contract: `appName()` returns the configured value rather than the DEFAULT_APP_NAME
     * fallback, so the OTP email carries the real product name — covers the non-fallback arm.
     */
    const ctxWithName = buildController('Acme Notifications')
    ctxWithName.service.generate.mockReturnValue(
      Promise.resolve({ expiresAt: 3, cooldownSeconds: 60 }),
    )

    await ctxWithName.controller.generate(TENANT, { recipient: 'jane@acme.com', purpose: 'login' })

    expect(ctxWithName.service.generate).toHaveBeenCalledWith({
      tenantId: TENANT,
      recipient: 'jane@acme.com',
      purpose: 'login',
      emailData: { appName: 'Acme Notifications', name: 'jane' },
    })
  })

  it('treats a blank/whitespace MAIL_FROM_NAME as unset and falls back to the default', async () => {
    /**
     * Scenario: MAIL_FROM_NAME is present but whitespace-only (an env var set to "" or spaces).
     * Contract: `appName()` trims and length-checks the value, so a blank configured name
     * resolves to DEFAULT_APP_NAME rather than injecting an empty `{{appName}}` into the OTP
     * email — covers the trim/length-guard branch that a plain `?? fallback` would miss.
     */
    const ctxBlank = buildController('   ')
    ctxBlank.service.generate.mockReturnValue(
      Promise.resolve({ expiresAt: 4, cooldownSeconds: 60 }),
    )

    await ctxBlank.controller.generate(TENANT, { recipient: 'jane@acme.com', purpose: 'login' })

    expect(ctxBlank.service.generate).toHaveBeenCalledWith({
      tenantId: TENANT,
      recipient: 'jane@acme.com',
      purpose: 'login',
      emailData: { appName: 'Bymax', name: 'jane' },
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
      emailData: { appName: 'Bymax', name: 'jane' },
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
