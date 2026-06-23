/**
 * @fileoverview Request body/query schemas for the `otp/` routes.
 * @layer app/dto
 *
 * Each schema validates one OTP endpoint's payload with Zod and is parsed inside the
 * controller (the sibling parse-in-controller pattern). The trusted `tenantId` is NEVER
 * part of a body schema — the controller derives it from the `x-tenant-id` header — so a
 * caller can never spoof another tenant through the request body.
 *
 * @module
 */
import { z } from 'zod'

/** A recipient identifier — validated as an email address. */
const recipient = z.email()

/** An OTP purpose label (e.g. `email_verification`) — a non-empty string. */
const purpose = z.string().min(1)

/**
 * Schema for `POST /otp/generate`. `tenantId` is header-derived, never in the body.
 * `deliverVia` selects email delivery (default when the email channel is configured)
 * or manual hand-off; the remaining fields tune the rendered OTP email.
 */
export const otpGenerateSchema = z.object({
  recipient,
  purpose,
  deliverVia: z.enum(['email', 'manual']).optional(),
  emailTemplate: z.string().min(1).optional(),
  emailData: z.record(z.string(), z.unknown()).optional(),
  locale: z.string().min(2).optional(),
})

/** Parsed body of `POST /otp/generate`. */
export type OtpGenerateDto = z.infer<typeof otpGenerateSchema>

/** Schema for `POST /otp/verify` — the guessed `code` is required. */
export const otpVerifySchema = z.object({
  recipient,
  purpose,
  code: z.string().min(1),
})

/** Parsed body of `POST /otp/verify`. */
export type OtpVerifyDto = z.infer<typeof otpVerifySchema>

/** Schema for `POST /otp/resend` — a functional alias of generate, same input shape. */
export const otpResendSchema = otpGenerateSchema

/** Parsed body of `POST /otp/resend`. */
export type OtpResendDto = z.infer<typeof otpResendSchema>

/** Schema for `POST /otp/consume` — only the recipient + purpose reference. */
export const otpConsumeSchema = z.object({ recipient, purpose })

/** Parsed body of `POST /otp/consume`. */
export type OtpConsumeDto = z.infer<typeof otpConsumeSchema>

/** Schema for `GET /otp/status` — also usable as a query schema. */
export const otpStatusSchema = z.object({ recipient, purpose })

/** Parsed query of `GET /otp/status`. */
export type OtpStatusDto = z.infer<typeof otpStatusSchema>
