/**
 * @fileoverview Roadmap client — the honest v0.2 startup-rejection probes.
 *
 * Each helper POSTs to an `/admin/try-configure-*` route, which compiles a
 * throwaway module configured with a declared-but-rejected v0.2 surface and
 * returns the library's REAL startup-rejection message (`errorMessage`). The
 * panel renders that message verbatim — never a hard-coded string. The `code`
 * is the catalog code that maps to the surface (or `null` when none maps), used
 * only to localize a friendly label alongside the verbatim message.
 *
 * @module lib/api/roadmap
 */

import { NOTIFICATION_ERROR_CODES } from '@bymax-one/nest-notification/shared'

import { API_BASE } from './http'

/** The outcome of a roadmap probe — the mapped code + the verbatim message. */
export interface RoadmapRejection {
  /** The catalog code that maps to this surface, or `null` when none maps. */
  code: string | null
  /** The library's verbatim startup-rejection message (empty when unreachable). */
  message: string
}

/** Read the `errorMessage` field from a probe response via `in`-narrowing. */
function readErrorMessage(body: unknown): string {
  // Stryker disable next-line ConditionalExpression,LogicalOperator: this `in`-narrowing guard is
  // required for TypeScript to read `errorMessage`, but is behaviourally redundant — the
  // `typeof errorMessage === 'string'` check below yields `''` for a missing/undefined field, and the
  // caller's `try/catch` absorbs any throw a relaxed guard would cause, so every mutant returns `''`.
  if (typeof body !== 'object' || body === null || !('errorMessage' in body)) return ''
  const { errorMessage } = body
  return typeof errorMessage === 'string' ? errorMessage : ''
}

/** POST a probe and return the mapped code + the library's verbatim message. */
async function probe(path: string, code: string | null): Promise<RoadmapRejection> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    // Stryker disable next-line ArrowFunction: a parse failure must yield a non-object value; `null` and
    // the mutant's `undefined` are both rejected by `readErrorMessage` (→ ''), so the fallback is not
    // observable.
    const body: unknown = await res.json().catch(() => null)
    return { code, message: readErrorMessage(body) }
  } catch {
    return { code, message: '' }
  }
}

/**
 * Probe the SMS channel rejection.
 *
 * @returns The verbatim rejection + the `SMS_PROVIDER_NOT_CONFIGURED` code.
 */
export function tryConfigureSms(): Promise<RoadmapRejection> {
  return probe('/admin/try-configure-sms', NOTIFICATION_ERROR_CODES.SMS_PROVIDER_NOT_CONFIGURED)
}

/**
 * Probe the Push channel rejection.
 *
 * @returns The verbatim rejection + the `PUSH_PROVIDER_NOT_CONFIGURED` code.
 */
export function tryConfigurePush(): Promise<RoadmapRejection> {
  return probe('/admin/try-configure-push', NOTIFICATION_ERROR_CODES.PUSH_PROVIDER_NOT_CONFIGURED)
}

/**
 * Probe the async `useClass` registration rejection.
 *
 * @returns The verbatim rejection (no catalog code maps to this surface).
 */
export function tryConfigureAsyncUseClass(): Promise<RoadmapRejection> {
  return probe('/admin/try-configure-async-useclass', null)
}
