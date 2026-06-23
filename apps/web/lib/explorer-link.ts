/**
 * @fileoverview Builds Explorer deep-links from an audit pivot key or time window.
 *
 * Reuses the exact `nuqs` param names the Explorer reads (`id`, `verb`,
 * `recipient`, `purpose`, `channel`, `source`, `from`, `to`, `range`) so a link
 * lands pre-filtered with no parallel query-state scheme. A relative `range` is
 * applied by default so the live-tail / keyset window includes "now" and a
 * just-fired row is visible. There is no `traceId`/`requestId` in this domain —
 * the correlation pivot is the row id / verb / recipient / purpose
 * (`OVERVIEW.md §15`); an OTP code is never part of a target.
 *
 * @module lib/explorer-link
 */

/** Target the Explorer should open on — at least one field should be set. */
export interface ExplorerTarget {
  /** Pivot to (and highlight) a single audit row by its id. */
  id?: string
  /** Pre-apply a `verb` filter. */
  verb?: string
  /** Pre-apply a masked-`recipient` filter. */
  recipient?: string
  /** Pre-apply an OTP `purpose` (or email template) filter. */
  purpose?: string
  /** Pre-apply a `channel` filter. */
  channel?: string
  /** Pre-apply a `source` facet (`service` / `interceptor`). */
  source?: string
  /** Absolute ISO window start; when set, the relative `range` is omitted. */
  from?: string
  /** Absolute ISO window end. */
  to?: string
  /** Relative range preset token (e.g. `15m`); defaults to `15m` for pivots. */
  range?: string
}

/** Default relative range so a freshly fired row falls inside the window. */
const DEFAULT_RANGE = '15m'

/** Set a param only when the value is a non-empty string. */
function setIfPresent(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value !== undefined && value !== '') params.set(key, value)
}

/**
 * Build a relative-or-absolute Explorer href from a {@link ExplorerTarget}.
 *
 * When `from`/`to` are provided the link uses that absolute window; otherwise it
 * applies a relative `range` (default `15m`) so the Explorer covers "now".
 *
 * @param target - The pivot key(s), optional facet filters, and time window.
 * @returns A root-relative href like `/explorer?recipient=j***@acme.com&range=15m`.
 */
export function explorerHref(target: ExplorerTarget): string {
  const params = new URLSearchParams()
  setIfPresent(params, 'id', target.id)
  setIfPresent(params, 'verb', target.verb)
  setIfPresent(params, 'recipient', target.recipient)
  setIfPresent(params, 'purpose', target.purpose)
  setIfPresent(params, 'channel', target.channel)
  setIfPresent(params, 'source', target.source)
  if (target.from !== undefined && target.from !== '') {
    // Absolute window: an explicit from/to overrides any relative range.
    params.set('from', target.from)
    setIfPresent(params, 'to', target.to)
  } else {
    params.set('range', target.range ?? DEFAULT_RANGE)
  }
  return `/explorer?${params.toString()}`
}
