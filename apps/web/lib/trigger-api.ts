/**
 * @fileoverview Typed client for the `apps/api` demo endpoints fired by the Trigger Center.
 *
 * Each wrapper fires one (or a short chain of) demo route(s) to exercise a feature
 * and returns a typed {@link TriggerResult} carrying the audit pivot key (the
 * masked recipient / channel / purpose / expected verb) so the card can deep-link
 * the result into the Explorer. It only **fires** — it never reads or aggregates
 * audit data (that is the Explorer/Overview's job), and it NEVER surfaces an OTP
 * code (`OVERVIEW.md §10`/§13). The trusted tenant always travels as the
 * `x-tenant-id` header; a spoof fire additionally forges a body `tenantId` to
 * prove the resolver override (`OVERVIEW.md §13`).
 *
 * @module lib/trigger-api
 */

import type { NotificationVerb } from './types'

/** API base URL — the demo + read API. Defaults to the local `apps/api` port. */
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/** The demo recipient the stateless email fires target (a valid, non-PII address). */
const DEMO_RECIPIENT = 'demo@example.com'

/** The demo OTP purpose. */
const DEMO_PURPOSE = 'login'

/**
 * A per-fire unique recipient for the OTP cards.
 *
 * Every OTP card generates its own address so the resend cooldown and max-attempts counters
 * (keyed on `tenant:recipient`) never leak between cards or across rapid re-fires — each fire is
 * self-contained, so a card's outcome always matches its label regardless of firing order. The
 * local part keeps its leading `d`, so the masked audit pivot stays `d***@example.com` (the same
 * value the Explorer deep-link filters on); only the full address — the OTP storage key — varies.
 *
 * @returns A fresh `demo-<uuid>@example.com` address.
 */
function freshOtpRecipient(): string {
  return `demo-${crypto.randomUUID()}@example.com`
}

/** Attachment size that trips the library's 10 MiB attachment guard (→ 413). */
const OVERSIZE_BYTES = 11 * 1024 * 1024

/** Wrong-code attempts that trip the max-attempts lockout. */
const MAX_ATTEMPT_TRIES = 6

/** The outcome of firing one trigger — the audit pivot key, never an OTP code. */
export interface TriggerResult {
  /** HTTP status of the (final) fired request. */
  status: number
  /** `true` when the status is < 400. */
  ok: boolean
  /** The masked recipient as the audit log stores it (the pivot key). */
  recipient: string
  /** The channel the fire exercised. */
  channel: 'email' | 'otp'
  /** The OTP purpose, when applicable. */
  purpose: string | null
  /** The verb the resulting audit row is expected to carry (informational). */
  verb: NotificationVerb
}

/**
 * Minimize a recipient exactly as the audit log does (`jane@acme.com` → `j***@acme.com`),
 * so a pivot filters on the value the row actually stores.
 *
 * @param recipient - The raw recipient address.
 * @returns The masked recipient.
 */
export function maskRecipient(recipient: string): string {
  // Stryker disable next-line Regex: the `^`/`$` anchors are redundant — `String.replace` evaluates
  // from the start and the greedy `.*` always reaches the end, so dropping either anchor yields the
  // identical masked output for every address.
  return recipient.replace(/^(.).*(@.*)$/, '$1***$2')
}

/** Fire a single demo request and return its status. */
async function call(
  method: 'POST',
  path: string,
  body: unknown,
  tenantId: string,
): Promise<number> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId || 'acme' },
    body: JSON.stringify(body),
  })
  return res.status
}

/** Build a result from a status + the pivot key (the masked recipient the audit row stores). */
function result(
  status: number,
  channel: 'email' | 'otp',
  verb: NotificationVerb,
  purpose: string | null,
  recipient: string,
): TriggerResult {
  return {
    status,
    ok: status < 400,
    recipient: maskRecipient(recipient),
    channel,
    purpose,
    verb,
  }
}

/** The Trigger Center fire actions — one per demonstrable backend feature. */
export const triggerApi = {
  /**
   * Send a raw email (`POST /email/send`).
   *
   * @param tenantId - The active tenant (trusted header).
   * @returns The fire outcome (channel email, verb sent).
   */
  async sendEmail(tenantId: string): Promise<TriggerResult> {
    const status = await call(
      'POST',
      '/email/send',
      { to: DEMO_RECIPIENT, subject: 'Hello from the console', html: '<p>Hi there</p>' },
      tenantId,
    )
    return result(status, 'email', 'sent', null, DEMO_RECIPIENT)
  },

  /**
   * Generate an OTP (`POST /otp/generate`, manual delivery).
   *
   * @param tenantId - The active tenant.
   * @returns The fire outcome (channel otp, verb generated).
   */
  async generateOtp(tenantId: string): Promise<TriggerResult> {
    const recipient = freshOtpRecipient()
    const status = await call(
      'POST',
      '/otp/generate',
      { recipient, purpose: DEMO_PURPOSE, deliverVia: 'manual' },
      tenantId,
    )
    return result(status, 'otp', 'generated', DEMO_PURPOSE, recipient)
  },

  /**
   * Verify an OTP with a deliberately wrong code (`POST /otp/verify`) — the failed-verify path.
   *
   * @param tenantId - The active tenant.
   * @returns The fire outcome (channel otp, verb failed). Never carries the code.
   */
  async verifyWrong(tenantId: string): Promise<TriggerResult> {
    const recipient = freshOtpRecipient()
    const status = await call(
      'POST',
      '/otp/verify',
      { recipient, purpose: DEMO_PURPOSE, code: '000000' },
      tenantId,
    )
    return result(status, 'otp', 'failed', DEMO_PURPOSE, recipient)
  },

  /**
   * Trip the resend cooldown: generate, then immediately resend (`POST /otp/resend` → 429).
   *
   * @param tenantId - The active tenant.
   * @returns The (expected-429) fire outcome.
   */
  async tripCooldown(tenantId: string): Promise<TriggerResult> {
    const recipient = freshOtpRecipient()
    await call(
      'POST',
      '/otp/generate',
      { recipient, purpose: DEMO_PURPOSE, deliverVia: 'manual' },
      tenantId,
    )
    const status = await call(
      'POST',
      '/otp/resend',
      { recipient, purpose: DEMO_PURPOSE, deliverVia: 'manual' },
      tenantId,
    )
    return result(status, 'otp', 'cooldown_blocked', DEMO_PURPOSE, recipient)
  },

  /**
   * Force the max-attempts lockout: generate, then verify wrong codes until 429.
   *
   * @param tenantId - The active tenant.
   * @returns The (expected-429) fire outcome.
   */
  async forceMaxAttempts(tenantId: string): Promise<TriggerResult> {
    const recipient = freshOtpRecipient()
    await call(
      'POST',
      '/otp/generate',
      { recipient, purpose: DEMO_PURPOSE, deliverVia: 'manual' },
      tenantId,
    )
    let status = 0
    for (let i = 0; i < MAX_ATTEMPT_TRIES; i += 1) {
      status = await call(
        'POST',
        '/otp/verify',
        { recipient, purpose: DEMO_PURPOSE, code: '000000' },
        tenantId,
      )
    }
    return result(status, 'otp', 'max_attempts_exceeded', DEMO_PURPOSE, recipient)
  },

  /**
   * Send a template email with an oversize attachment (`POST /email/send-template` → 413).
   *
   * @param tenantId - The active tenant.
   * @returns The (expected-413) fire outcome.
   */
  async oversizeAttachment(tenantId: string): Promise<TriggerResult> {
    const status = await call(
      'POST',
      '/email/send-template',
      {
        to: DEMO_RECIPIENT,
        template: 'welcome',
        data: { name: 'Demo' },
        attachments: [{ filename: 'huge.bin', content: 'A'.repeat(OVERSIZE_BYTES) }],
      },
      tenantId,
    )
    return result(status, 'email', 'failed', null, DEMO_RECIPIENT)
  },

  /**
   * Spoof the tenant: dispatch with a forged body `tenantId` alongside the trusted header
   * (`POST /dispatch`). The resolver overrides the forged id, so the audit row carries the
   * trusted tenant — proving the anti-spoof.
   *
   * @param tenantId - The trusted (active) tenant sent as the header.
   * @param forgedTenantId - The tenant a caller forges in the body (ignored by the resolver).
   * @returns The fire outcome (channel otp, verb sent).
   */
  async spoofTenant(tenantId: string, forgedTenantId: string): Promise<TriggerResult> {
    const recipient = freshOtpRecipient()
    const status = await call(
      'POST',
      '/dispatch',
      {
        channel: 'otp',
        tenantId: forgedTenantId,
        payload: { recipient, purpose: DEMO_PURPOSE, deliverVia: 'manual' },
      },
      tenantId,
    )
    return result(status, 'otp', 'sent', DEMO_PURPOSE, recipient)
  },

  /**
   * Dispatch an email through the unified façade (`POST /dispatch`).
   *
   * @param tenantId - The active tenant.
   * @returns The fire outcome (channel email, verb sent).
   */
  async dispatch(tenantId: string): Promise<TriggerResult> {
    const status = await call(
      'POST',
      '/dispatch',
      {
        channel: 'email',
        payload: { to: DEMO_RECIPIENT, subject: 'Dispatched', html: '<p>Via façade</p>' },
      },
      tenantId,
    )
    return result(status, 'email', 'sent', null, DEMO_RECIPIENT)
  },
}
