/**
 * @fileoverview Transport layer for the `apps/api` notification read-API.
 *
 * A single {@link apiFetch} helper centralizes the base URL, JSON parsing, the
 * RBAC headers, and non-2xx → `ApiError` mapping. {@link encodeAuditQuery}
 * serializes an `AuditQuery` to a query string (re-used by the audit client and
 * the SSE hook); {@link rbacHeaders} derives the trusted `x-tenant-id` + `x-role`
 * headers. The typed audit wrappers live in `lib/audit-api.ts`; the only endpoint
 * wrapped here is `GET /channels` (used by the Trigger Center).
 *
 * @module lib/api-client
 */

import { ApiError, type AuditQuery } from './types'

/** API base URL — the `apps/api` notification service. Defaults to the local port. */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/** Channel descriptor returned by `GET /channels`. */
export interface ChannelDescriptor {
  /** The channel name (e.g. `email`, `otp`). */
  channel: string
  /** Whether the channel's service is configured and ready. */
  isEnabled: boolean
  /** Why the channel is disabled, when applicable. */
  reason: string | null
}

/**
 * Build the RBAC headers for a request from the query's `role` / `tenantId`.
 *
 * The API resolves the trusted tenant from `x-tenant-id` and the demo role from
 * `x-role`; sending them is what makes the tenant/role switcher scope the data.
 * A blank/absent tenant omits the header (the API then resolves the default).
 *
 * @param query - The active query carrying the role and tenant.
 * @returns A headers record with the RBAC fields that are present.
 */
export function rbacHeaders(query: Pick<AuditQuery, 'role' | 'tenantId'>): Record<string, string> {
  const headers: Record<string, string> = {}
  if (query.role !== undefined) headers['x-role'] = query.role
  if (query.tenantId !== undefined && query.tenantId !== '') {
    headers['x-tenant-id'] = query.tenantId
  }
  return headers
}

/**
 * Serialize an {@link AuditQuery} to a URL query string.
 *
 * `role` is omitted — it travels as the `x-role` RBAC header; `undefined`/`null`
 * values are skipped so no empty params are emitted.
 *
 * @param query - The query to serialize.
 * @returns A URL-encoded query string (without the leading `?`).
 */
export function encodeAuditQuery(query: AuditQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (key === 'role') continue // role travels as the x-role header
    params.set(key, String(value))
  }
  return params.toString()
}

/**
 * Base fetch helper — prefixes the API base URL, sets JSON + RBAC headers, and
 * maps any non-2xx response to a thrown `ApiError`.
 *
 * @typeParam T - The expected JSON payload type.
 * @param path - Path relative to the API base (e.g. `/audit/logs?...`).
 * @param headers - Per-request headers merged after the JSON defaults.
 * @returns The parsed JSON payload.
 * @throws {ApiError} When the response status is not 2xx (carrying the status).
 */
export async function apiFetch<T>(path: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', ...headers },
  })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/**
 * Fetch the channel descriptors (enabled/disabled + rejection reason).
 *
 * @returns The array of channel descriptors reported by the API.
 */
export function getChannels(): Promise<ChannelDescriptor[]> {
  return apiFetch<ChannelDescriptor[]>('/channels', {})
}
