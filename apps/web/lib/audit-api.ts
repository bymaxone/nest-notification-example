/**
 * @fileoverview Typed client for the `apps/api` `/audit/*` read-API.
 *
 * Two JSX-free wrappers the three console surfaces share: {@link fetchLogs}
 * (keyset-paginated `GET /audit/logs` → a {@link PageResult}; a stale-cursor 410
 * surfaces as a typed `ApiError` carrying the status) and {@link fetchAggregate}
 * (`GET /audit/aggregate` → time-bucketed counts grouped by `verb`/`channel`/
 * `provider`). Both attach the trusted `x-tenant-id` (+ demo `x-role`) header via
 * the `api-client` transport (`OVERVIEW.md §15`).
 *
 * @module lib/audit-api
 */

import { apiFetch, encodeAuditQuery, rbacHeaders } from './api-client'
import type {
  AggregateBucket,
  AggregateGroupBy,
  AuditQuery,
  NotificationLog,
  PageResult,
} from './types'

/**
 * Fetch a keyset page of audit logs (newest-first).
 *
 * The page envelope is `{ data, nextCursor, hasMore }`; pagination is keyset
 * (the `cursor` from a prior page), never OFFSET. A stale/foreign cursor makes
 * the API answer 410, which the transport throws as an `ApiError` (status 410)
 * so the caller can restart pagination from the top.
 *
 * @param query - The active filter (its `cursor` selects the page).
 * @returns A page of {@link NotificationLog} rows plus the next keyset cursor.
 * @throws {ApiError} When the API responds non-2xx (e.g. 410 on a stale cursor).
 */
export function fetchLogs(query: AuditQuery): Promise<PageResult<NotificationLog>> {
  const qs = encodeAuditQuery(query)
  return apiFetch<PageResult<NotificationLog>>(`/audit/logs?${qs}`, rbacHeaders(query))
}

/**
 * Fetch a time-bucketed aggregate series for the Overview charts.
 *
 * @param query - The active filter (time window + tenant scope + source facet).
 * @param groupBy - The dimension each bucket is split by (`verb`/`channel`/`provider`).
 * @returns The zero-filled chart series of {@link AggregateBucket} rows.
 * @throws {ApiError} When the API responds non-2xx.
 */
export function fetchAggregate(
  query: AuditQuery,
  groupBy: AggregateGroupBy,
): Promise<AggregateBucket[]> {
  // Charts span the whole window, so the keyset cursor/limit are meaningless here —
  // drop them and pin the group-by dimension.
  const params = new URLSearchParams(encodeAuditQuery(query))
  params.delete('cursor')
  params.delete('limit')
  params.set('groupBy', groupBy)
  return apiFetch<AggregateBucket[]>(`/audit/aggregate?${params.toString()}`, rbacHeaders(query))
}
