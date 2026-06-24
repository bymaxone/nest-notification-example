/**
 * @fileoverview Shared client types for the notification console data layer.
 *
 * Bridges the `apps/api` `/audit/*` read-API to `apps/web`. The closed
 * `NotificationChannel` + open `OtpPurpose` unions come from the isomorphic
 * `@bymax-one/nest-notification/shared` subpath (never redefined); the row,
 * query, page, and aggregate shapes mirror exactly what each endpoint returns
 * (`OVERVIEW.md §15`). The `verb` union is **app-local** — `./shared` exports no
 * verb type and the server root (which does) must never be imported here.
 *
 * Crucially there is **no** `code` field anywhere on `NotificationLog`: a
 * generated OTP code lives only in the TTL-bound store and is never persisted to
 * the audit log, so the row the Explorer renders is structurally code-free.
 *
 * @module lib/types
 */

// Isomorphic subpath ONLY — never import the server `.` root in the browser bundle.
import type { NotificationChannel, OtpPurpose } from '@bymax-one/nest-notification/shared'
import type { RbacRole } from './filters'

export type { NotificationChannel, OtpPurpose }

/**
 * App-local audit verb union (the `./shared` subpath exports no verb type, and
 * the server-root `NotificationLogVerb` must not be imported into the browser).
 * Mirrors the library's lifecycle verbs plus the interceptor's `sent`/`failed`.
 */
export type NotificationVerb =
  | 'sent'
  | 'generated'
  | 'verified'
  | 'failed'
  | 'cooldown_blocked'
  | 'max_attempts_exceeded'

/**
 * The dual source a row can come from: a service lifecycle verb, or the library
 * `NotificationAuditInterceptor` (`providerName === '__interceptor__'`). The
 * Explorer's source facet maps to the API's `source` query param.
 */
export type AuditSource = 'service' | 'interceptor'

/** The reserved `providerName` stamped on every HTTP-boundary interceptor row. */
export const INTERCEPTOR_PROVIDER = '__interceptor__'

/**
 * One delivery-audit row as returned by `GET /audit/logs` and the SSE tail.
 *
 * Mirrors the Postgres `notification_logs` projection: `timestamp` is an ISO-8601
 * string over the wire (the API serializes the `DateTime` column — there is no
 * `createdAt`), `recipient` is already masked, and there is deliberately no
 * `code` column. `cursor` is present only on rows delivered via the SSE live tail
 * (its keyset cursor / event id); rows from `GET /audit/logs` omit it.
 */
export interface NotificationLog {
  /** Row id (uuid). */
  id: string
  /** ISO-8601 timestamp (the serialized `DateTime` column). */
  timestamp: string
  /** Owning tenant slug. */
  tenantId: string
  /** Delivery channel. */
  channel: NotificationChannel
  /** Lifecycle / interceptor verb. */
  verb: NotificationVerb
  /** Masked recipient (`j***@acme.com`) — never the raw address. */
  recipient: string
  /** OTP purpose / email template name, when present. */
  purpose: OtpPurpose | null
  /** Provider name; `__interceptor__` for HTTP-boundary rows (the source facet). */
  providerName: string
  /** Provider message id, when present. */
  messageId: string | null
  /** Error message only (never a stack trace), when present — the free-text `q` target. */
  errorMessage: string | null
  /** Owning user, when present. */
  userId: string | null
  /** Arbitrary caller metadata, when present (already masked at the write seam). */
  metadata: Record<string, unknown> | null
  /** Present only on SSE live-tail rows — the row's opaque keyset cursor (the event `id`). */
  cursor?: string
}

/**
 * Shared filter object accepted by every `/audit/*` read endpoint.
 *
 * Serialized to a query string by `encodeAuditQuery`. `role` is the lone
 * exception — it travels as the `x-role` RBAC header, never a query param; the
 * trusted tenant travels as `x-tenant-id`. The `cursor` is the opaque base64url
 * keyset cursor returned by a previous page (never an OFFSET).
 */
export interface AuditQuery {
  /** Trusted tenant scope; sent as `x-tenant-id` (empty ⇒ omitted). */
  tenantId?: string
  /** RBAC role; sent as the `x-role` header, never serialized to the query string. */
  role?: RbacRole
  /** Exact channel match. */
  channel?: NotificationChannel
  /** Exact verb match. */
  verb?: NotificationVerb
  /** Exact purpose match. */
  purpose?: string
  /** Exact (already-masked) recipient match. */
  recipient?: string
  /** Exact provider-name match (e.g. `nodemailer`, `__interceptor__`). */
  provider?: string
  /** Source facet: `interceptor` ⇒ only `__interceptor__`; `service` ⇒ exclude them. */
  source?: AuditSource
  /** Free-text, case-insensitive `contains` over the audit `errorMessage` column. */
  q?: string
  /** ISO-8601 window start; the API applies `now-1h` when omitted. */
  from?: string
  /** ISO-8601 window end; the API applies `now` when omitted. */
  to?: string
  /** Opaque base64url keyset cursor from a previous page. */
  cursor?: string
  /** Page size (the API clamps to 1–100, default 50). */
  limit?: number
}

/** Bounded group-by dimensions for the Overview charts (never high-cardinality columns). */
export type AggregateGroupBy = 'verb' | 'channel' | 'provider'

/** One zero-filled aggregate row: a bucket timestamp, the dimension value, and the count. */
export interface AggregateBucket {
  /** ISO-8601 bucket start. */
  bucket: string
  /** The group-by dimension value (a verb / channel / provider name). */
  dimension: string
  /** Row count in this bucket for this dimension value. */
  n: number
}

/** A keyset page of rows plus the opaque cursor for the next (older) page. */
export interface PageResult<T> {
  /** The page of newest-first rows. */
  data: T[]
  /** The cursor to fetch the next page, or `null` on the last page. */
  nextCursor: string | null
  /** `true` when a full page was returned (a next page may exist). */
  hasMore: boolean
}

/** A bounded-dimension field that may be faceted in the Explorer rail. */
export type FacetField = 'channel' | 'verb' | 'provider' | 'purpose' | 'source'

/** One facet value with its count in the current page. */
export interface FacetValue {
  /** The facet value (e.g. `email`, `failed`, `__interceptor__`). */
  value: string
  /** How many rows in the current page carry this value. */
  count: number
}

/** Map of faceted field → its sorted value list. */
export type FacetsResult = Record<FacetField, FacetValue[]>

/**
 * Error thrown by the API client for any non-2xx response.
 *
 * Carries the HTTP `status` so callers branch on it — e.g. a `410` (stale keyset
 * cursor) resets pagination from the top.
 */
export class ApiError extends Error {
  /**
   * @param status - The HTTP status code of the failed response.
   * @param message - A human-readable error message.
   */
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
