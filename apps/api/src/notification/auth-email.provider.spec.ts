/**
 * Unit tests for {@link NotificationAuthEmailProvider}.
 *
 * The EmailService, ConfigService, and Express Request are plain mocks; the provider is
 * constructed directly without NestJS DI. Covers all 7 port methods: each is asserted to call
 * EmailService.sendTemplate with the correct template, tenantId, to, locale (including
 * the `'en'` default branch), and data payload. Proves no code, token, or raw recipient
 * is passed outside the sendTemplate data object.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import type { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import type { EmailService } from '@bymax-one/nest-notification'

import { NotificationAuthEmailProvider } from './auth-email.provider.js'
import type { Env } from '../config/env.schema.js'
import type { InviteData, SessionInfo } from './auth-email.types.js'

const TENANT = 'acme'
const TO = 'user@acme.com'
/** Test console origin returned by the mock ConfigService for action-link base URLs. */
const BASE_URL = 'https://console.example.test'

/** Minimal Express Request double providing the x-tenant-id header. */
const makeMockRequest = (tenantId: string): Request =>
  ({ headers: { 'x-tenant-id': tenantId } }) as unknown as Request

/** Mocked surface of EmailService the provider touches. */
interface MockEmailService {
  sendTemplate: ReturnType<
    typeof jest.fn<(input: Record<string, unknown>) => Promise<{ messageId: string }>>
  >
}

/** Mocked surface of ConfigService the provider touches (resolves WEB_ORIGIN). */
interface MockConfigService {
  get: ReturnType<typeof jest.fn>
}

/** Build a NotificationAuthEmailProvider backed by plain mocks. */
function build(tenantId = TENANT): {
  provider: NotificationAuthEmailProvider
  email: MockEmailService
} {
  const email: MockEmailService = {
    sendTemplate: jest
      .fn<(input: Record<string, unknown>) => Promise<{ messageId: string }>>()
      .mockResolvedValue({ messageId: 'mock-id' }),
  }
  const config: MockConfigService = {
    get: jest.fn().mockReturnValue(BASE_URL),
  }
  const provider = new NotificationAuthEmailProvider(
    email as unknown as EmailService,
    config as unknown as ConfigService<Env, true>,
    makeMockRequest(tenantId),
  )
  return { provider, email }
}

describe('NotificationAuthEmailProvider.sendEmailVerificationOtp', () => {
  let ctx: ReturnType<typeof build>
  beforeEach(() => {
    ctx = build()
  })

  it('calls sendTemplate with otp_code template, correct tenantId, to, locale, and code in data', async () => {
    /**
     * The method maps to the canonical otp_code template; the OTP code lives in the
     * data payload so rendering can reference it — it is never passed outside the data.
     */
    await ctx.provider.sendEmailVerificationOtp(TO, '123456', 'pt-BR')
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith({
      tenantId: TENANT,
      to: TO,
      template: 'otp_code',
      locale: 'pt-BR',
      data: { code: '123456', purpose: 'email_verification', appName: 'Bymax' },
    })
  })

  it("defaults locale to 'en' when omitted", async () => {
    /**
     * Default locale branch: omitting the locale argument resolves to 'en'.
     */
    await ctx.provider.sendEmailVerificationOtp(TO, '123456')
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }))
  })
})

describe('NotificationAuthEmailProvider.sendPasswordResetOtp', () => {
  let ctx: ReturnType<typeof build>
  beforeEach(() => {
    ctx = build()
  })

  it('calls sendTemplate with otp_password_reset template and password_reset purpose in data', async () => {
    /**
     * Maps to otp_password_reset; the code is provided by nest-auth, not re-generated here.
     */
    await ctx.provider.sendPasswordResetOtp(TO, 'ABCD1234', 'en')
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith({
      tenantId: TENANT,
      to: TO,
      template: 'otp_password_reset',
      locale: 'en',
      data: { code: 'ABCD1234', purpose: 'password_reset', appName: 'Bymax' },
    })
  })

  it("defaults locale to 'en' when omitted", async () => {
    /**
     * Default locale branch.
     */
    await ctx.provider.sendPasswordResetOtp(TO, 'ABCD1234')
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }))
  })
})

describe('NotificationAuthEmailProvider.sendPasswordResetToken', () => {
  let ctx: ReturnType<typeof build>
  beforeEach(() => {
    ctx = build()
  })

  it('calls sendTemplate with password_reset_link template and embeds the token in a resetUrl', async () => {
    /**
     * The token must appear only inside the resetUrl data field, never as a top-level
     * argument or standalone key — this is the masking contract for the link flow.
     */
    await ctx.provider.sendPasswordResetToken(TO, 'secret-token-xyz', 'en')
    const arg = ctx.email.sendTemplate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(arg['template']).toBe('password_reset_link')
    expect(arg['tenantId']).toBe(TENANT)
    expect(arg['to']).toBe(TO)
    expect(arg['locale']).toBe('en')
    const data = arg['data'] as Record<string, unknown>
    expect(typeof data['resetUrl']).toBe('string')
    expect(String(data['resetUrl'])).toContain('secret-token-xyz')
    // The raw token must appear only inside the URL — not as an independent field.
    expect(data).not.toHaveProperty('token')
  })

  it("defaults locale to 'en' when omitted", async () => {
    /**
     * Default locale branch.
     */
    await ctx.provider.sendPasswordResetToken(TO, 'secret-token')
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }))
  })

  it('percent-encodes reserved characters in the token and uses the configured base URL', async () => {
    /**
     * Reserved URL characters (+, /, =) in the token must be percent-encoded so the
     * reset link survives query-string parsing intact, and the link base must come from
     * the Zod-validated WEB_ORIGIN (via ConfigService), not a raw process.env read.
     */
    await ctx.provider.sendPasswordResetToken(TO, 'a+b/c=d', 'en')
    const arg = ctx.email.sendTemplate.mock.calls[0]?.[0] as Record<string, unknown>
    const resetUrl = String((arg['data'] as Record<string, unknown>)['resetUrl'])
    expect(resetUrl).toBe(`${BASE_URL}/reset-password?token=a%2Bb%2Fc%3Dd`)
    // The raw, unencoded reserved characters must not leak into the URL.
    expect(resetUrl).not.toContain('a+b/c=d')
  })
})

describe('NotificationAuthEmailProvider.sendMfaEnabledNotification', () => {
  let ctx: ReturnType<typeof build>
  beforeEach(() => {
    ctx = build()
  })

  it('calls sendTemplate with mfa_enabled template and no code or token in data', async () => {
    /**
     * A pure security notice — no code or token is involved, only the appName.
     */
    await ctx.provider.sendMfaEnabledNotification(TO, 'en')
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith({
      tenantId: TENANT,
      to: TO,
      template: 'mfa_enabled',
      locale: 'en',
      data: { appName: 'Bymax' },
    })
  })

  it("defaults locale to 'en' when omitted", async () => {
    /**
     * Default locale branch.
     */
    await ctx.provider.sendMfaEnabledNotification(TO)
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }))
  })
})

describe('NotificationAuthEmailProvider.sendMfaDisabledNotification', () => {
  let ctx: ReturnType<typeof build>
  beforeEach(() => {
    ctx = build()
  })

  it('calls sendTemplate with mfa_disabled template and no code or token in data', async () => {
    /**
     * Security notice for MFA being turned off — no code or token in the payload.
     */
    await ctx.provider.sendMfaDisabledNotification(TO, 'pt-BR')
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith({
      tenantId: TENANT,
      to: TO,
      template: 'mfa_disabled',
      locale: 'pt-BR',
      data: { appName: 'Bymax' },
    })
  })

  it("defaults locale to 'en' when omitted", async () => {
    /**
     * Default locale branch.
     */
    await ctx.provider.sendMfaDisabledNotification(TO)
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }))
  })
})

describe('NotificationAuthEmailProvider.sendNewSessionAlert', () => {
  let ctx: ReturnType<typeof build>
  beforeEach(() => {
    ctx = build()
  })

  const sessionInfo: SessionInfo = {
    device: 'Chrome on macOS',
    ip: '203.0.113.x',
    sessionHash: 'a1b2c3d4',
  }

  it('calls sendTemplate with new_login_alert template and session fields in data', async () => {
    /**
     * SessionInfo fields are spread into the data payload; sessionHash is the display-safe
     * truncated form — the raw session token must never appear.
     */
    await ctx.provider.sendNewSessionAlert(TO, sessionInfo, 'en')
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith({
      tenantId: TENANT,
      to: TO,
      template: 'new_login_alert',
      locale: 'en',
      data: {
        device: 'Chrome on macOS',
        ip: '203.0.113.x',
        sessionHash: 'a1b2c3d4',
        appName: 'Bymax',
      },
    })
  })

  it("defaults locale to 'en' when omitted", async () => {
    /**
     * Default locale branch.
     */
    await ctx.provider.sendNewSessionAlert(TO, sessionInfo)
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }))
  })
})

describe('NotificationAuthEmailProvider.sendInvitation', () => {
  let ctx: ReturnType<typeof build>
  beforeEach(() => {
    ctx = build()
  })

  const inviteData: InviteData = {
    inviterName: 'Alice',
    tenantName: 'Acme Corp',
    inviteToken: 'invite-secret-tok',
    expiresAt: new Date('2026-12-31T23:59:59Z'),
  }

  it('calls sendTemplate with invitation template and embeds the token in an acceptUrl', async () => {
    /**
     * The invite token must appear only inside the acceptUrl — not as a top-level field.
     * The expiresAt Date is serialised to an ISO string for the template renderer.
     */
    await ctx.provider.sendInvitation(TO, inviteData, 'en')
    const arg = ctx.email.sendTemplate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(arg['template']).toBe('invitation')
    expect(arg['tenantId']).toBe(TENANT)
    expect(arg['to']).toBe(TO)
    expect(arg['locale']).toBe('en')
    const data = arg['data'] as Record<string, unknown>
    expect(data['inviterName']).toBe('Alice')
    expect(data['tenantName']).toBe('Acme Corp')
    expect(typeof data['acceptUrl']).toBe('string')
    expect(String(data['acceptUrl'])).toContain('invite-secret-tok')
    expect(typeof data['expiresAt']).toBe('string')
    // The raw token must appear only inside the URL, not as a standalone key.
    expect(data).not.toHaveProperty('inviteToken')
  })

  it("defaults locale to 'en' when omitted", async () => {
    /**
     * Default locale branch.
     */
    await ctx.provider.sendInvitation(TO, inviteData)
    expect(ctx.email.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }))
  })

  it('percent-encodes reserved characters in the invite token and uses the configured base URL', async () => {
    /**
     * Reserved characters in the invite token must be percent-encoded so the accept link
     * survives query-string parsing, and the base must come from the validated WEB_ORIGIN.
     */
    await ctx.provider.sendInvitation(TO, { ...inviteData, inviteToken: 'x+y/z=1' }, 'en')
    const arg = ctx.email.sendTemplate.mock.calls[0]?.[0] as Record<string, unknown>
    const acceptUrl = String((arg['data'] as Record<string, unknown>)['acceptUrl'])
    expect(acceptUrl).toBe(`${BASE_URL}/accept-invite?token=x%2By%2Fz%3D1`)
    expect(acceptUrl).not.toContain('x+y/z=1')
  })
})
