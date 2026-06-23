/**
 * @fileoverview nuqs typed URL state — the single source of truth for global
 * notification console filters.
 *
 * Maps `tenantId`, `role`, and `live` bidirectionally to the URL so every
 * console view is a shareable deep-link. The tenant switcher drives the trusted
 * `x-tenant-id` header forwarded by the API-client; the role switcher gates the
 * RBAC demo; the live toggle enables the SSE audit tail.
 *
 * @module lib/filters
 */

'use client'

import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs'

/** Demo tenant identifiers exercised by the example domain endpoints. */
export const TENANTS = ['acme', 'globex'] as const

/** Selectable RBAC roles for the tenant/role switcher. */
export const ROLES = ['viewer', 'operator', 'admin'] as const

/** A valid RBAC role value. */
export type RbacRole = (typeof ROLES)[number]

/**
 * nuqs parser map for the global notification console filter state.
 *
 * Each field defaults to a sensible empty/enum value so reads are non-null.
 * `tenantId` defaults to `''` (all tenants); `role` defaults to `viewer`
 * (least-privileged landing); `live` defaults to `false`.
 */
export const notificationQueryParsers = {
  tenantId: parseAsString.withDefault(''),
  role: parseAsStringEnum<RbacRole>([...ROLES]).withDefault('viewer'),
  live: parseAsBoolean.withDefault(false),
}

/** The notification console's reactive URL filter state. */
export interface NotificationQueryState {
  /** The active tenant scope (empty = all tenants). */
  tenantId: string
  /** The active RBAC role. */
  role: RbacRole
  /** Whether the SSE live tail is enabled. */
  live: boolean
  /** nuqs setter for the raw URL state. */
  setQuery: ReturnType<typeof useQueryStates<typeof notificationQueryParsers>>[1]
}

/**
 * Read the global notification console filter from the URL.
 *
 * Returns `tenantId`, `role`, `live`, and the nuqs `setQuery` setter so
 * controls can update the URL state without prop-drilling.
 *
 * @returns The current notification query state bound to the URL.
 */
export function useNotificationQuery(): NotificationQueryState {
  const [{ tenantId, role, live }, setQuery] = useQueryStates(notificationQueryParsers)
  return { tenantId, role, live, setQuery }
}
