/**
 * @fileoverview Typed OTP client for the `apps/api` `/otp/*` routes.
 *
 * Wraps `generate` / `verify` / `resend` / `consume` / `status` over the shared
 * transport. The hooks that drive the segmented box are state/UX only — these
 * helpers are the app's job of actually issuing the request. The plaintext code
 * travels ONLY in the `verify` request body; `getOtpStatus` sends just the
 * recipient + purpose (never the code) and the verify response never echoes it.
 *
 * The verify endpoint returns a discriminated body (`{ valid }` / `{ reason }`),
 * not the `NotificationErrorResponse` envelope, so {@link verifyOtp} maps each
 * `reason` to the matching `OTP_*` code the panel localizes; the cooldown on
 * generate/resend DOES use the envelope (surfacing `Retry-After`).
 *
 * @module lib/api/otp
 */

import { NOTIFICATION_ERROR_CODES, type OtpPurpose } from '@bymax-one/nest-notification/shared'

import { API_BASE, postForResult, tenantHeaders, type ApiResult } from './http'

/** Result of a successful `POST /otp/generate` (or `resend`). */
export interface OtpGenerateData {
  /** Expiry as a Unix epoch in milliseconds (drives `useOtpCountdown`). */
  expiresAt: number
  /** Resend cooldown length in seconds. */
  cooldownSeconds: number
}

/** Code-free `GET /otp/status` snapshot. */
export interface OtpStatusData {
  /** Whether an active OTP exists for the recipient + purpose. */
  exists: boolean
  /** Expiry epoch (ms), when an entry exists. */
  expiresAt?: number
  /** Attempts made so far, when an entry exists. */
  attempts?: number
  /** Attempt ceiling, when an entry exists. */
  maxAttempts?: number
  /** Active resend cooldown in seconds. */
  cooldownSeconds: number
  /** Whether the entry has been validated (not yet consumed). */
  validated?: boolean
}

/** The outcome of a verify attempt (never carries the plaintext code). */
export type OtpVerifyOutcome =
  | { ok: true }
  | { ok: false; code: string; remainingAttempts: number | null }

/** Shared identity of an OTP flow — the recipient + its purpose. */
export interface OtpReference {
  /** The recipient address the OTP was issued to. */
  recipient: string
  /** The OTP purpose label (drives length / type / TTL). */
  purpose: OtpPurpose
}

/** Input for {@link generateOtp} / {@link resendOtp}. */
export interface OtpGenerateInput extends OtpReference {
  /** The active tenant (trusted `x-tenant-id` header). */
  tenantId: string
  /** Delivery mode — `email` sends to the inbox; `manual` hands off out-of-band. */
  deliverVia: 'email' | 'manual'
}

/** Input for {@link verifyOtp}. */
export interface OtpVerifyInput extends OtpReference {
  /** The active tenant. */
  tenantId: string
  /** The guessed code (lives only in this request body). */
  code: string
}

/** Map a verify `reason` discriminant to the matching catalog code. */
const REASON_TO_CODE = {
  invalid_code: NOTIFICATION_ERROR_CODES.OTP_INVALID_CODE,
  not_found: NOTIFICATION_ERROR_CODES.OTP_NOT_FOUND,
  max_attempts: NOTIFICATION_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED,
} satisfies Record<string, string>

/** Read a string `reason` from a parsed verify body via `in`-narrowing. */
function readReason(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('reason' in body)) return null
  const { reason } = body
  return typeof reason === 'string' ? reason : null
}

/** Read a numeric `remainingAttempts` from a parsed verify body. */
function readRemainingAttempts(body: unknown): number | null {
  if (typeof body !== 'object' || body === null || !('remainingAttempts' in body)) return null
  const { remainingAttempts } = body
  return typeof remainingAttempts === 'number' ? remainingAttempts : null
}

/** Resolve a verify `reason` to its catalog code, falling back to invalid-code. */
function codeForReason(reason: string | null): string {
  if (reason === 'not_found') return REASON_TO_CODE.not_found
  if (reason === 'max_attempts') return REASON_TO_CODE.max_attempts
  return REASON_TO_CODE.invalid_code
}

/**
 * Generate (and deliver) an OTP for a recipient + purpose.
 *
 * @param input - Tenant, recipient, purpose, and delivery mode.
 * @returns The expiry + cooldown on success, or the cooldown failure on a 429.
 */
export function generateOtp(input: OtpGenerateInput): Promise<ApiResult<OtpGenerateData>> {
  const { tenantId, recipient, purpose, deliverVia } = input
  return postForResult<OtpGenerateData>(
    '/otp/generate',
    { recipient, purpose, deliverVia },
    tenantId,
  )
}

/**
 * Resend an OTP — a generate that shares the cooldown lock.
 *
 * @param input - Tenant, recipient, purpose, and delivery mode.
 * @returns The expiry + cooldown on success, or the cooldown failure on a 429.
 */
export function resendOtp(input: OtpGenerateInput): Promise<ApiResult<OtpGenerateData>> {
  const { tenantId, recipient, purpose, deliverVia } = input
  return postForResult<OtpGenerateData>('/otp/resend', { recipient, purpose, deliverVia }, tenantId)
}

/**
 * Verify a guessed code against the backend.
 *
 * The endpoint returns 200 `{ valid:true }` or a non-2xx `{ reason }` body (never
 * the envelope), so the reason is mapped to the matching `OTP_*` code and the
 * `remainingAttempts` echoed on a wrong code.
 *
 * @param input - Tenant, recipient, purpose, and the guessed code.
 * @returns The discriminated verify outcome (never the code).
 */
export async function verifyOtp(input: OtpVerifyInput): Promise<OtpVerifyOutcome> {
  const { tenantId, recipient, purpose, code } = input
  const res = await fetch(`${API_BASE}/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...tenantHeaders(tenantId) },
    body: JSON.stringify({ recipient, purpose, code }),
  })
  if (res.ok) return { ok: true }
  const body: unknown = await res.json().catch(() => null)
  const reason = readReason(body)
  return {
    ok: false,
    code: codeForReason(reason),
    remainingAttempts: readRemainingAttempts(body),
  }
}

/**
 * Consume (invalidate) an OTP after a successful verify.
 *
 * @param input - Tenant + the recipient/purpose reference.
 * @returns The discriminated result (a 204 yields `undefined` data).
 */
export function consumeOtp(input: OtpReference & { tenantId: string }): Promise<ApiResult<void>> {
  const { tenantId, recipient, purpose } = input
  return postForResult<void>('/otp/consume', { recipient, purpose }, tenantId)
}

/**
 * Read the current OTP status — never the plaintext code.
 *
 * @param input - Tenant + the recipient/purpose reference.
 * @returns The code-free status snapshot.
 */
export async function getOtpStatus(
  input: OtpReference & { tenantId: string },
): Promise<OtpStatusData> {
  const { tenantId, recipient, purpose } = input
  const params = new URLSearchParams({ recipient, purpose })
  const res = await fetch(`${API_BASE}/otp/status?${params.toString()}`, {
    headers: { Accept: 'application/json', ...tenantHeaders(tenantId) },
  })
  return res.json() as Promise<OtpStatusData>
}
