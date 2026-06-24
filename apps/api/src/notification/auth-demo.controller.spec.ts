/**
 * Unit tests for {@link AuthDemoController}.
 *
 * The NotificationAuthEmailProvider is a plain mock; the controller is constructed
 * directly without NestJS DI. Covers the single `passwordReset` handler: proves the
 * response is always `{ status: 'sent' }`; the OTP is never echoed; the adapter receives
 * the correct `to` and `locale`; the default locale is `'en'` when the body omits it;
 * and the stand-in OTP is a 6-digit numeric string.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals'

import { AuthDemoController, mintStandInOtp } from './auth-demo.controller.js'
import type { NotificationAuthEmailProvider } from './auth-email.provider.js'

/** Mocked surface of NotificationAuthEmailProvider the controller touches. */
interface MockAuthEmail {
  sendPasswordResetOtp: ReturnType<typeof jest.fn>
}

/** Build an AuthDemoController backed by a mock provider. */
function build(): { controller: AuthDemoController; authEmail: MockAuthEmail } {
  const authEmail: MockAuthEmail = {
    sendPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
  }
  const controller = new AuthDemoController(authEmail as unknown as NotificationAuthEmailProvider)
  return { controller, authEmail }
}

describe('AuthDemoController.passwordReset', () => {
  let ctx: ReturnType<typeof build>
  beforeEach(() => {
    ctx = build()
  })

  it('returns { status: "sent" } and never echoes the OTP', async () => {
    /**
     * The response must be exactly { status: 'sent' } — the OTP is generated internally
     * and must not appear in any field of the response object.
     */
    const result = await ctx.controller.passwordReset({ to: 'user@example.com', locale: 'en' })
    expect(result).toEqual({ status: 'sent' })
    // No 6-or-more-digit numeric sequence in the serialised response.
    expect(JSON.stringify(result)).not.toMatch(/\d{6,}/)
  })

  it('calls sendPasswordResetOtp once with the supplied to and locale', async () => {
    /**
     * The controller forwards to and locale to the adapter; the internally-generated OTP
     * is the second argument and must be a valid 6-digit string.
     */
    await ctx.controller.passwordReset({ to: 'alice@example.com', locale: 'pt-BR' })
    expect(ctx.authEmail.sendPasswordResetOtp).toHaveBeenCalledTimes(1)
    const args = ctx.authEmail.sendPasswordResetOtp.mock.calls[0] as [string, string, string]
    expect(args[0]).toBe('alice@example.com')
    expect(args[2]).toBe('pt-BR')
  })

  it("uses locale 'en' when the body omits the locale field", async () => {
    /**
     * The Zod schema applies a default of 'en'; the controller passes the defaulted value
     * directly to sendPasswordResetOtp.
     */
    await ctx.controller.passwordReset({ to: 'bob@example.com' })
    const args = ctx.authEmail.sendPasswordResetOtp.mock.calls[0] as [string, string, string]
    expect(args[2]).toBe('en')
  })

  it('generates a 6-digit numeric stand-in OTP that is never echoed', async () => {
    /**
     * The stand-in OTP must be in the range [100000, 999999] — the 6-digit format that
     * represents what nest-auth's OtpService would emit.
     */
    await ctx.controller.passwordReset({ to: 'carol@example.com', locale: 'en' })
    const args = ctx.authEmail.sendPasswordResetOtp.mock.calls[0] as [string, string, string]
    const otp = args[1]
    expect(otp).toMatch(/^\d{6}$/)
    expect(Number(otp)).toBeGreaterThanOrEqual(100000)
    expect(Number(otp)).toBeLessThanOrEqual(999999)
  })
})

describe('mintStandInOtp', () => {
  it('produces a 6-digit numeric string in [100000, 999999]', () => {
    /**
     * Repeated calls must always produce a 6-digit result within the expected range.
     */
    for (let i = 0; i < 20; i++) {
      const otp = mintStandInOtp()
      expect(otp).toMatch(/^\d{6}$/)
      expect(Number(otp)).toBeGreaterThanOrEqual(100000)
      expect(Number(otp)).toBeLessThanOrEqual(999999)
    }
  })
})
