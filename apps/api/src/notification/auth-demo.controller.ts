/**
 * @fileoverview Dev-only seam controller for the optional nest-auth password-reset journey.
 * @layer app/notification
 *
 * Demonstrates the composition boundary: @bymax-one/nest-auth owns OTP generation and
 * @bymax-one/nest-notification owns rendering, delivery, and audit. A stand-in OTP is
 * minted locally with node:crypto to represent the code nest-auth's OtpService would emit;
 * the adapter then renders, sends, and audits it — without invoking nest-notification's
 * OtpService. The OTP is never returned, logged, or echoed in any response.
 *
 * @module
 */
import { Body, Controller, Post } from '@nestjs/common'
import { randomInt } from 'node:crypto'
import { z } from 'zod'

import { NotificationAuthEmailProvider } from './auth-email.provider.js'

/** Zod schema for the password-reset seam request body. */
const pwResetSchema = z.object({
  to: z.string().email(),
  locale: z.string().optional().default('en'),
})

/** Inferred type of the validated request body. */
type PwResetDto = z.infer<typeof pwResetSchema>

/**
 * Mint a 6-digit stand-in OTP using the Node.js cryptographic random number generator.
 *
 * This represents the code that @bymax-one/nest-auth's OtpService would emit in a real
 * integration. It is generated locally so the demo does not require a full auth stack.
 * The returned code is passed to the adapter and must never be echoed in a response.
 *
 * @returns A 6-digit numeric string in the range `['100000', '999999']`.
 */
export function mintStandInOtp(): string {
  return randomInt(100000, 1000000).toString()
}

/**
 * Dev-only HTTP seam for the optional nest-auth password-reset integration.
 *
 * Exposes `POST /auth-demo/password-reset` which mints a stand-in OTP, delegates
 * rendering, delivery, and audit logging to {@link NotificationAuthEmailProvider}, and
 * returns `{ status: 'sent' }`. The OTP is never echoed. Real applications would not
 * expose this controller; its purpose is to prove the integration boundary end-to-end.
 */
@Controller('auth-demo')
export class AuthDemoController {
  constructor(private readonly authEmail: NotificationAuthEmailProvider) {}

  /**
   * Send a nest-auth-style password-reset OTP through the notification pipeline.
   *
   * Mints a local stand-in OTP (representing what nest-auth's OtpService would generate),
   * then delegates rendering, delivery, and audit logging to the adapter. The OTP is
   * never included in the response — the caller receives only `{ status: 'sent' }`.
   *
   * @param body - Raw body validated against the Zod schema (`{ to, locale? }`).
   * @returns `{ status: 'sent' }` — the OTP is never echoed.
   */
  @Post('password-reset')
  async passwordReset(@Body() body: unknown): Promise<{ status: 'sent' }> {
    const dto: PwResetDto = pwResetSchema.parse(body)
    const otp = mintStandInOtp()
    await this.authEmail.sendPasswordResetOtp(dto.to, otp, dto.locale)
    return { status: 'sent' }
  }
}
