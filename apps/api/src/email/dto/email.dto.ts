/**
 * @fileoverview Request body schemas for the `email/` routes.
 * @layer app/dto
 *
 * Validates the raw and template email send payloads with Zod, parsed inside the
 * controller. The trusted `tenantId` is NEVER part of a body schema — the controller
 * derives it from the `x-tenant-id` header.
 *
 * @module
 */
import { z } from 'zod'

/** One or more recipient email addresses. */
const recipients = z.union([z.email(), z.array(z.email()).min(1)])

/** A provider tracking tag pair. */
const tag = z.object({ name: z.string().min(1), value: z.string() })

/** A single email attachment (`content` is a base64 or plaintext string). */
const attachment = z.object({ filename: z.string().min(1), content: z.string() })

/** Schema for `POST /email/send` — the caller supplies the rendered subject + html body. */
export const emailSendSchema = z.object({
  to: recipients,
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
  from: z.email().optional(),
  fromName: z.string().min(1).optional(),
  replyTo: z.email().optional(),
  cc: recipients.optional(),
  bcc: recipients.optional(),
  tags: z.array(tag).optional(),
  attachments: z.array(attachment).optional(),
})

/** Parsed body of `POST /email/send`. */
export type EmailSendDto = z.infer<typeof emailSendSchema>

/** Schema for `POST /email/send-template` — the renderer produces the body from `template` + `data`. */
export const emailSendTemplateSchema = z.object({
  to: recipients,
  template: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  locale: z.string().min(2).optional(),
  from: z.email().optional(),
  fromName: z.string().min(1).optional(),
  replyTo: z.email().optional(),
  tags: z.array(tag).optional(),
})

/** Parsed body of `POST /email/send-template`. */
export type EmailSendTemplateDto = z.infer<typeof emailSendTemplateSchema>
