/**
 * @fileoverview Request body schema for the `POST /dispatch` façade route.
 * @layer app/dto
 *
 * A discriminated-union Zod schema mirroring the library's `DispatchInput` — one variant
 * per channel — WITHOUT `tenantId` (the controller adds the header-derived tenant before
 * calling the service). Parsed inside the controller.
 *
 * @module
 */
import { z } from 'zod'

/** One or more recipient email addresses. */
const recipients = z.union([z.email(), z.array(z.email()).min(1)])

/** A provider tracking tag pair. */
const tag = z.object({ name: z.string().min(1), value: z.string() })

/** Email dispatch payload — either a `template` (+ `data`) or a raw `subject` + `html`. */
export const emailDispatchPayloadSchema = z.object({
  to: recipients,
  template: z.string().min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  locale: z.string().min(2).optional(),
  subject: z.string().min(1).optional(),
  html: z.string().min(1).optional(),
  text: z.string().optional(),
  from: z.email().optional(),
  fromName: z.string().min(1).optional(),
  replyTo: z.email().optional(),
  tags: z.array(tag).optional(),
})

/** Parsed email dispatch payload. */
export type EmailDispatchPayloadDto = z.infer<typeof emailDispatchPayloadSchema>

/** OTP dispatch payload — `action` selects generate (default) / verify / consume. */
export const otpDispatchPayloadSchema = z.object({
  recipient: z.email(),
  purpose: z.string().min(1),
  action: z.enum(['generate', 'verify', 'consume']).optional(),
  code: z.string().min(1).optional(),
  deliverVia: z.enum(['email', 'manual']).optional(),
  emailTemplate: z.string().min(1).optional(),
  emailData: z.record(z.string(), z.unknown()).optional(),
  locale: z.string().min(2).optional(),
})

/** Parsed OTP dispatch payload. */
export type OtpDispatchPayloadDto = z.infer<typeof otpDispatchPayloadSchema>

/** Discriminated dispatch body, one variant per channel (no `tenantId`). */
export const dispatchSchema = z.discriminatedUnion('channel', [
  z.object({ channel: z.literal('email'), payload: emailDispatchPayloadSchema }),
  z.object({ channel: z.literal('otp'), payload: otpDispatchPayloadSchema }),
])

/** Parsed body of `POST /dispatch`. */
export type DispatchDto = z.infer<typeof dispatchSchema>
