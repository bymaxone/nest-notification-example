/**
 * @fileoverview nuqs typed URL state — the single source of truth for the console filters.
 *
 * Maps the global controls (`tenantId`, `role`, `live`) AND the Explorer filter +
 * range + facet state bidirectionally to the URL, so every view is a shareable
 * deep-link and a Trigger auto-pivot / an Overview click / a facet selection all
 * land the Explorer pre-filtered. {@link useAuditQuery} compiles the URL into the
 * effective {@link AuditQuery}; a relative `range` preset is resolved to concrete
 * `from`/`to` at read time, quantized so the TanStack-Query key stays stable
 * between refreshes (`OVERVIEW.md §15`).
 *
 * @module lib/filters
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs'

import { ALL_CHANNELS } from './severity'
import type { AuditQuery, AuditSource, NotificationChannel, NotificationVerb } from './types'

/** Demo tenant identifiers exercised by the example domain endpoints. */
export const TENANTS = ['acme', 'globex'] as const

/** Selectable RBAC roles for the tenant/role switcher. */
export const ROLES = ['viewer', 'operator', 'admin'] as const

/** A valid RBAC role value. */
export type RbacRole = (typeof ROLES)[number]

/** Audit verbs (mirrors the app-local {@link NotificationVerb} union). */
export const VERBS = [
  'sent',
  'generated',
  'verified',
  'failed',
  'cooldown_blocked',
  'max_attempts_exceeded',
] as const satisfies readonly NotificationVerb[]

/** Relative range presets → milliseconds; keys are the preset tokens stored in the URL. */
export const RANGE_MS: Record<string, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
}

/** Ordered preset tokens for rendering the relative-range buttons. */
export const RANGE_PRESETS = ['15m', '1h', '6h', '24h'] as const

/** Quantize "now" to this granularity so a relative range yields a stable query key. */
const NOW_QUANTUM_MS = 30_000

/**
 * nuqs parser map for the entire console filter state (global + Explorer).
 *
 * Each field defaults to an empty string / sensible enum so reads are non-null;
 * an empty string means "unset". `tenantId` defaults to `''` (all tenants);
 * `role` defaults to `viewer` (least-privileged landing); `live` to `false`.
 */
export const notificationQueryParsers = {
  tenantId: parseAsString.withDefault(''),
  role: parseAsStringEnum<RbacRole>([...ROLES]).withDefault('viewer'),
  live: parseAsBoolean.withDefault(false),
  range: parseAsString.withDefault(''),
  from: parseAsString.withDefault(''),
  to: parseAsString.withDefault(''),
  channel: parseAsString.withDefault(''),
  verb: parseAsString.withDefault(''),
  recipient: parseAsString.withDefault(''),
  purpose: parseAsString.withDefault(''),
  provider: parseAsString.withDefault(''),
  source: parseAsString.withDefault(''),
  q: parseAsString.withDefault(''),
  id: parseAsString.withDefault(''),
}

/** The notification console's reactive URL filter state (global controls subset). */
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
 * Read the global notification console controls (tenant / role / live) from the URL.
 *
 * @returns The current global control state bound to the URL.
 */
export function useNotificationQuery(): NotificationQueryState {
  const [{ tenantId, role, live }, setQuery] = useQueryStates(notificationQueryParsers)
  return { tenantId, role, live, setQuery }
}

/** Narrow an arbitrary URL token to a {@link NotificationChannel}, else `undefined`. */
export function asChannel(value: string): NotificationChannel | undefined {
  return (ALL_CHANNELS as readonly string[]).includes(value)
    ? (value as NotificationChannel)
    : undefined
}

/** Narrow an arbitrary URL token to a {@link NotificationVerb}, else `undefined`. */
export function asVerb(value: string): NotificationVerb | undefined {
  return (VERBS as readonly string[]).includes(value) ? (value as NotificationVerb) : undefined
}

/** Narrow an arbitrary URL token to an {@link AuditSource}, else `undefined`. */
export function asSource(value: string): AuditSource | undefined {
  return value === 'service' || value === 'interceptor' ? value : undefined
}

/**
 * Resolve a relative `range` preset to a concrete, quantized `{ from, to }` window.
 *
 * @param range - The range preset token (e.g. `15m`); unknown tokens yield `null`.
 * @returns The ISO window, or `null` when the token is not a known preset.
 */
export function resolveWindow(range: string): { from: string; to: string } | null {
  const rangeMs = RANGE_MS[range]
  if (rangeMs === undefined) return null
  const now = Math.floor(Date.now() / NOW_QUANTUM_MS) * NOW_QUANTUM_MS
  return { from: new Date(now - rangeMs).toISOString(), to: new Date(now).toISOString() }
}

/** Effective audit-filter state derived from the URL. */
export interface AuditQueryState {
  /** The compiled filter passed to the data hooks. */
  query: AuditQuery
  /** nuqs setter for the raw URL state. */
  setQuery: ReturnType<typeof useQueryStates<typeof notificationQueryParsers>>[1]
  /** Whether the live tail toggle is on. */
  live: boolean
  /** Whether the current range is relative (live tail is only allowed when true). */
  isRelative: boolean
  /** The selected-row id (for the detail drawer / deep-link highlight), or `''`. */
  selectedId: string
}

/**
 * Read the console filter from the URL and compile it into an {@link AuditQuery}.
 *
 * Resolves a relative `range` preset to concrete `from`/`to` (quantized "now"),
 * narrows the channel/verb/source tokens, threads the RBAC role, and reports
 * whether the range is relative so the live tail can enforce its relative-only
 * guardrail.
 *
 * @returns The effective query, the nuqs setter, and `live` / `isRelative` flags.
 */
export function useAuditQuery(): AuditQueryState {
  const [state, setQuery] = useQueryStates(notificationQueryParsers)

  // A relative preset advances its window over time; tick a coarse counter so the
  // memoized window (and the query key) refresh on a bounded cadence. The ticker
  // runs only for relative presets, so absolute windows keep a stable query key.
  const usesRelativePreset = RANGE_MS[state.range] !== undefined
  const [nowTick, setNowTick] = useState(0)
  useEffect(() => {
    if (!usesRelativePreset) return
    // Stryker disable next-line ArithmeticOperator: the tick value is only used as a memo dependency
    // to force re-evaluation; any change (whether `+ 1` or `- 1`) recomputes the window equally, so
    // the operator's direction is not observable — the resulting `to` is derived from `Date.now()`.
    const id = setInterval(() => setNowTick((t) => t + 1), NOW_QUANTUM_MS)
    return () => clearInterval(id)
    // Stryker disable next-line ArrayDeclaration: emptying the dependency list only changes WHEN the
    // ticker is torn down across a relative↔absolute transition; it has no observable effect on the
    // compiled query, because for a non-relative range `resolveWindow` returns null and `to` is the
    // fixed URL value regardless of any extra tick — a leaked interval cannot change the output.
  }, [usesRelativePreset])

  const query = useMemo<AuditQuery>(() => {
    const window = resolveWindow(state.range)
    const from = window?.from ?? state.from
    const to = window?.to ?? state.to
    const channel = asChannel(state.channel)
    const verb = asVerb(state.verb)
    const source = asSource(state.source)
    return {
      role: state.role,
      ...(state.tenantId !== '' ? { tenantId: state.tenantId } : {}),
      ...(from !== '' ? { from } : {}),
      ...(to !== '' ? { to } : {}),
      ...(channel !== undefined ? { channel } : {}),
      ...(verb !== undefined ? { verb } : {}),
      ...(state.recipient !== '' ? { recipient: state.recipient } : {}),
      ...(state.purpose !== '' ? { purpose: state.purpose } : {}),
      ...(state.provider !== '' ? { provider: state.provider } : {}),
      ...(source !== undefined ? { source } : {}),
      ...(state.q !== '' ? { q: state.q } : {}),
    }
    // `nowTick` participates intentionally: a relative window recomputes as time advances.
  }, [
    nowTick,
    state.range,
    state.from,
    state.to,
    state.role,
    state.tenantId,
    state.channel,
    state.verb,
    state.recipient,
    state.purpose,
    state.provider,
    state.source,
    state.q,
  ])

  const isRelative = state.range !== '' || (state.from === '' && state.to === '')
  return { query, setQuery, live: state.live, isRelative, selectedId: state.id }
}
