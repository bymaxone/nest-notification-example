/**
 * @fileoverview Typed fetch wrappers for the `apps/api` notification read-API.
 *
 * A single {@link apiFetch} helper centralizes the base URL, JSON parsing, the
 * RBAC headers, and non-2xx → {@link ApiError} mapping. {@link encodeAuditQuery}
 * serializes a filter to a query string (re-used by the SSE hook). Typed callers
 * wrap the `/audit/logs`, `/audit/aggregate`, and `/channels` endpoints.
 *
 * @module lib/api-client
 */

import type { RbacRole } from './filters'

/** API base URL — the `apps/api` notification service. Defaults to the local port. */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/**
 * Structured HTTP error thrown when the API responds with a non-2xx status.
 */
export class ApiError extends Error {
  /**
   * @param status - The HTTP status code.
   * @param message - A human-readable error description.
   */
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Filter parameters for audit log queries. */
export interface AuditFilter {
  /** Scope to a specific tenant (omit for all tenants). */
  tenantId?: string
  /** RBAC role — forwarded as the `x-role` header. */
  role?: RbacRole
  /** Channel filter — e.g. `email`, `otp`. */
  channel?: string
  /** Keyset cursor for pagination. */
  cursor?: string
  /** Maximum rows to return per page. */
  limit?: number
}

/** A single audit log row returned by the API. */
export interface AuditLogRow {
  id: string
  tenantId: string
  channel: string
  verb: string
  recipient: string | null
  status: string
  errorCode: string | null
  createdAt: string
  cursor?: string
}

/** Paginated response from `/audit/logs`. */
export interface AuditPage {
  data: AuditLogRow[]
  nextCursor: string | null
  hasMore: boolean
}

/** Aggregate data point from `/audit/aggregate`. */
export interface AuditAggregate {
  bucket: string
  channel: string
  total: number
  failed: number
}

/** Channel descriptor returned by `/channels`. */
export interface ChannelDescriptor {
  channel: string
  isEnabled: boolean
  reason: string | null
}

/**
 * Build the RBAC headers for a request from the filter's `role` / `tenantId`.
 *
 * The API resolves access from `x-role` + `x-tenant-id`; sending them is what
 * makes the tenant/role switcher actually scope the data.
 *
 * @param filter - The active filter carrying the role and tenant.
 * @returns A headers record with the RBAC fields that are present.
 */
export function rbacHeaders(
  filter: Pick<AuditFilter, 'role' | 'tenantId'>,
): Record<string, string> {
  const headers: Record<string, string> = {}
  if (filter.role !== undefined) headers['x-role'] = filter.role
  if (filter.tenantId !== undefined && filter.tenantId !== '') {
    headers['x-tenant-id'] = filter.tenantId
  }
  return headers
}

/**
 * Serialize an {@link AuditFilter} to a URL query string.
 *
 * `role` is omitted — it travels as the `x-role` RBAC header.
 *
 * @param filter - The filter to serialize.
 * @returns A URL-encoded query string (without the leading `?`).
 */
export function encodeAuditQuery(filter: AuditFilter): string {
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null) continue
    if (key === 'role') continue // role travels as x-role header
    p.set(key, String(value))
  }
  return p.toString()
}

/**
 * Base fetch helper — prefixes the API base URL, sets JSON + RBAC headers, and
 * maps any non-2xx response to a thrown {@link ApiError}.
 *
 * @typeParam T - The expected JSON payload type.
 * @param path - Path relative to the API base (e.g. `/audit/logs?...`).
 * @param headers - Per-request headers merged after the JSON defaults.
 * @returns The parsed JSON payload.
 * @throws {ApiError} When the response status is not 2xx.
 */
export async function apiFetch<T>(path: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', ...headers },
  })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/**
 * Fetch a keyset page of audit logs.
 *
 * @param filter - The active filter (its `cursor` selects the page).
 * @returns A page of audit rows plus the next keyset cursor.
 */
export function getAuditLogs(filter: AuditFilter): Promise<AuditPage> {
  return apiFetch<AuditPage>(`/audit/logs?${encodeAuditQuery(filter)}`, rbacHeaders(filter))
}

/**
 * Fetch a time-bucketed aggregate series for the overview charts.
 *
 * @param filter - The active filter (time window + channel scope).
 * @returns An array of bucketed aggregate data points.
 */
export function getAuditAggregate(filter: AuditFilter): Promise<AuditAggregate[]> {
  return apiFetch<AuditAggregate[]>(
    `/audit/aggregate?${encodeAuditQuery(filter)}`,
    rbacHeaders(filter),
  )
}

/**
 * Fetch the channel descriptors (enabled/disabled + rejection reason).
 *
 * @returns The array of channel descriptors reported by the API.
 */
export function getChannels(): Promise<ChannelDescriptor[]> {
  return apiFetch<ChannelDescriptor[]>('/channels', {})
}
