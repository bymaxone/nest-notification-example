/**
 * @fileoverview Shared filter DTO for every `/audit/*` read endpoint.
 * @layer app/audit/dto
 *
 * A single Zod schema (`auditQuerySchema`) and its inferred type (`AuditQueryDto`) are
 * consumed by `GET /audit/logs`, `GET /audit/stream`, and `GET /audit/aggregate` so the
 * three endpoints filter the delivery audit log identically.
 *
 * The `channel`/`verb`/`purpose` enums are built from LOCAL const arrays and pinned to the
 * library's exported TYPES with compile-time parity guards, so a drift between this app and
 * `@bymax-one/nest-notification` breaks the build rather than silently mis-filtering. The
 * `./shared` subpath exports the channel/purpose unions as TYPES only (no runtime array),
 * so the arrays are declared here and guarded — never imported.
 *
 * The `source` facet is first-class: rows written by the library's `NotificationAuditInterceptor`
 * carry `providerName === '__interceptor__'` (the HTTP-boundary `sent`/`failed` view), whereas
 * the services emit lifecycle verbs with the real provider name (the "what the service did"
 * view). `source` lets a reader keep the two apart.
 *
 * @module
 */
import { z } from 'zod'
import type { NotificationChannel, OtpPurpose } from '@bymax-one/nest-notification/shared'
import type { NotificationLogVerb } from '@bymax-one/nest-notification'

/**
 * Delivery channels, mirroring the library `NotificationChannel` union.
 * Pinned bidirectionally below: adding/removing a library channel breaks the build.
 */
const CHANNELS = ['email', 'otp', 'sms', 'push'] as const

/**
 * Audit verbs, mirroring the library `NotificationLogVerb` union (service lifecycle verbs
 * plus the interceptor's `sent`/`failed`). Pinned bidirectionally below.
 */
const VERBS = [
  'sent',
  'generated',
  'verified',
  'failed',
  'cooldown_blocked',
  'max_attempts_exceeded',
] as const

/**
 * Known OTP purposes, a subset of the library's open `OtpPurpose` union (`string & {}`).
 * Pinned one-directionally below — every literal must remain a valid `OtpPurpose`.
 */
const PURPOSES = [
  'email_verification',
  'password_reset',
  'mfa_oob',
  'phone_verification',
  'magic_link',
] as const satisfies readonly OtpPurpose[]

/** Zod enum of delivery channels. */
const channelSchema = z.enum(CHANNELS)
/** Zod enum of audit verbs. */
const verbSchema = z.enum(VERBS)
/** Zod enum of known OTP purposes. */
const purposeSchema = z.enum(PURPOSES)

// Compile-time parity: the closed channel/verb unions must equal their Zod enums in BOTH
// directions, so a library that adds OR removes a member fails to compile here.
type _ChannelParity =
  z.infer<typeof channelSchema> extends NotificationChannel
    ? NotificationChannel extends z.infer<typeof channelSchema>
      ? true
      : never
    : never
const _channelParity: _ChannelParity = true
void _channelParity

type _VerbParity =
  z.infer<typeof verbSchema> extends NotificationLogVerb
    ? NotificationLogVerb extends z.infer<typeof verbSchema>
      ? true
      : never
    : never
const _verbParity: _VerbParity = true
void _verbParity

/**
 * Filter DTO shared by every `/audit/*` read endpoint.
 *
 * `limit` is coerced from its string query value, clamped to 1–100 and defaults to 50; the
 * service applies a `now-1h`..`now` window when `from`/`to` are absent. The `cursor` is the
 * opaque base64url keyset cursor returned by a previous page.
 */
export const auditQuerySchema = z.object({
  /** Tenant slug; a server-side restriction overrides it and it can never widen scope. */
  tenantId: z.string().max(128).optional(),
  /** Exact channel match. */
  channel: channelSchema.optional(),
  /** Exact verb match. */
  verb: verbSchema.optional(),
  /** Exact purpose match. */
  purpose: purposeSchema.optional(),
  /** Exact (already-masked) recipient match. */
  recipient: z.string().max(320).optional(),
  /** Exact provider-name match (e.g. `nodemailer`, `__interceptor__`). */
  provider: z.string().max(64).optional(),
  /** Source facet: `interceptor` ⇒ only `__interceptor__` rows; `service` ⇒ exclude them; omitted ⇒ both. */
  source: z.enum(['service', 'interceptor']).optional(),
  /** Free-text, case-insensitive `contains` over the audit `errorMessage` column. */
  q: z.string().max(1024).optional(),
  /** ISO-8601 window start; defaults to `now-1h` in the service layer. */
  from: z.iso.datetime().optional(),
  /** ISO-8601 window end; defaults to `now` in the service layer. */
  to: z.iso.datetime().optional(),
  /** Opaque base64url keyset cursor `{ timestamp, id }` from a previous page. */
  cursor: z.string().optional(),
  /** Page size; coerced, clamped to 1–100, default 50. */
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/** Parsed, fully-defaulted audit filter inferred from {@link auditQuerySchema}. */
export type AuditQueryDto = z.infer<typeof auditQuerySchema>
