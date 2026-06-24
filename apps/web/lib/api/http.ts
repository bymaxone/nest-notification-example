/**
 * @fileoverview Shared transport for the P10 notification API clients.
 *
 * Centralizes the API base URL, the trusted `x-tenant-id` header, JSON GETs, and
 * a `POST → discriminated result` helper that parses the library's
 * `NotificationErrorResponse` envelope (matching on `error.code`, never the HTTP
 * status) and surfaces the `Retry-After` cooldown on a 429. The OTP, config, and
 * roadmap clients build on these primitives so error handling stays consistent.
 *
 * @module lib/api/http
 */

import { ApiError } from '../types'

/** API base URL — the `apps/api` notification service. Defaults to the local port. */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/** A successful API call carrying the parsed payload. */
export interface ApiSuccess<T> {
  /** Discriminant — the call returned a 2xx. */
  ok: true
  /** The parsed response payload. */
  data: T
}

/** A failed API call parsed from the `NotificationErrorResponse` envelope. */
export interface ApiFailure {
  /** Discriminant — the call returned a non-2xx. */
  ok: false
  /** The stable `notification.*` error code (matched on, never the status). */
  code: string
  /** The backend's English default message (verbatim). */
  message: string
  /** Seconds to wait before retrying (from `Retry-After`), or `null` when absent. */
  retryAfterSeconds: number | null
}

/** The outcome of an API call that maps its errors to the shared envelope. */
export type ApiResult<T> = ApiSuccess<T> | ApiFailure

/**
 * Build the trusted-tenant request headers.
 *
 * A blank tenant omits the header so the API resolves its configured default; a
 * concrete tenant scopes the request via `x-tenant-id`.
 *
 * @param tenantId - The active tenant (empty string means "API default").
 * @returns A headers record with `x-tenant-id` when a tenant is set.
 */
export function tenantHeaders(tenantId: string): Record<string, string> {
  return tenantId === '' ? {} : { 'x-tenant-id': tenantId }
}

/**
 * GET a JSON resource, throwing {@link ApiError} on any non-2xx response.
 *
 * @typeParam T - The expected JSON payload type.
 * @param path - Path relative to {@link API_BASE} (e.g. `/config/status`).
 * @param tenantId - The active tenant sent as `x-tenant-id`.
 * @returns The parsed JSON payload.
 * @throws {ApiError} When the response status is not 2xx.
 */
export async function getJson<T>(path: string, tenantId: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', ...tenantHeaders(tenantId) },
  })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/** The fields the console reads from a {@link NotificationErrorResponse} body. */
interface ParsedErrorEnvelope {
  /** The stable `notification.*` error code. */
  code: string
  /** The backend's English default message. */
  message: string
  /** The cooldown remainder from `details.remainingSeconds`, when present. */
  remainingSeconds: number | null
}

/** Extract `details.remainingSeconds` from an error object via `in`-narrowing (no casts). */
function readRemainingSeconds(error: object): number | null {
  // Stryker disable next-line ConditionalExpression: the `in`-narrowing is required for TypeScript to
  // type `details`; dropping the early return is behaviourally equivalent because the
  // `typeof details !== 'object'` check below returns null for the same no-`details` case.
  if (!('details' in error)) return null
  const { details } = error
  if (typeof details !== 'object' || details === null || !('remainingSeconds' in details)) {
    return null
  }
  const { remainingSeconds } = details
  return typeof remainingSeconds === 'number' ? remainingSeconds : null
}

/** Read the `error` envelope from a parsed body without unsafe casts. */
function readErrorEnvelope(body: unknown): ParsedErrorEnvelope | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null
  const { error } = body
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const { code } = error
  if (typeof code !== 'string') return null
  // Stryker disable next-line ConditionalExpression: the `'message' in error` narrowing is required
  // for TypeScript to read `error.message`; forcing it true is equivalent because the
  // `typeof error.message === 'string'` check then yields `''` for the same absent-message case.
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return { code, message, remainingSeconds: readRemainingSeconds(error) }
}

/** Resolve the retry-after seconds from the header, then the cooldown detail. */
function resolveRetryAfter(header: string | null, remainingSeconds: number | null): number | null {
  // Stryker disable next-line ConditionalExpression: forcing this guard true is equivalent — when
  // `header` is null, `Number.parseInt(null)` is `NaN`, which fails the `isFinite` check and falls
  // through to `remainingSeconds`, exactly as skipping the block would.
  if (header !== null) {
    const parsed = Number.parseInt(header, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return remainingSeconds
}

/**
 * POST a JSON body and map the response to a discriminated {@link ApiResult}.
 *
 * A 2xx resolves to `{ ok: true, data }` (a 204 yields `undefined` data); a
 * non-2xx is parsed from the `NotificationErrorResponse` envelope into
 * `{ ok: false, code, message, retryAfterSeconds }`, reading `Retry-After` (or the
 * cooldown `details.remainingSeconds`) on a 429.
 *
 * @typeParam T - The expected success payload type.
 * @param path - Path relative to {@link API_BASE}.
 * @param body - The JSON request body.
 * @param tenantId - The active tenant sent as `x-tenant-id`.
 * @returns The discriminated success/failure result.
 */
export async function postForResult<T>(
  path: string,
  body: unknown,
  tenantId: string,
): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...tenantHeaders(tenantId) },
    body: JSON.stringify(body),
  })
  if (res.ok) {
    const data = (res.status === 204 ? undefined : await res.json()) as T
    return { ok: true, data }
  }
  // Stryker disable next-line ArrowFunction: a parse failure must yield a non-envelope value; `null`
  // and the mutant's `undefined` are both treated identically by `readErrorEnvelope` (→ null), so the
  // fallback value is not observable.
  const parsed: unknown = await res.json().catch(() => null)
  const envelope = readErrorEnvelope(parsed)
  return {
    ok: false,
    code: envelope?.code ?? '',
    message: envelope?.message ?? '',
    retryAfterSeconds: resolveRetryAfter(
      res.headers.get('Retry-After'),
      envelope?.remainingSeconds ?? null,
    ),
  }
}
