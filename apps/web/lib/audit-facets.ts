/**
 * @fileoverview Client-side facet derivation for the Explorer rail + Overview breakdowns.
 *
 * The notification read-API exposes no dedicated `/facets` endpoint, so facet
 * value-counts are derived from the current page of `NotificationLog` rows:
 * `channel`, `verb`, `provider`, `purpose`, and the **source** facet (service vs
 * `__interceptor__`). The field list is a module-level constant (stable
 * reference, no per-render allocation) and each value list is sorted by
 * descending count then value so the rail order is deterministic.
 *
 * @module lib/audit-facets
 */

import {
  INTERCEPTOR_PROVIDER,
  type AuditSource,
  type FacetField,
  type FacetValue,
  type FacetsResult,
  type NotificationLog,
} from './types'

/** The faceted fields, in render order — a stable module-level array. */
export const FACET_FIELDS: readonly FacetField[] = [
  'channel',
  'verb',
  'provider',
  'purpose',
  'source',
]

/** Human label per facet field, for section headings. */
export const FACET_LABELS: Record<FacetField, string> = {
  channel: 'Channel',
  verb: 'Verb',
  provider: 'Provider',
  purpose: 'Purpose',
  source: 'Source',
}

/** Map a row's `providerName` to its source facet value. */
export function sourceOf(providerName: string): AuditSource {
  return providerName === INTERCEPTOR_PROVIDER ? 'interceptor' : 'service'
}

/** Extract the facet value of `field` from a row, or `null` when absent. */
function valueOf(row: NotificationLog, field: FacetField): string | null {
  switch (field) {
    case 'channel':
      return row.channel
    case 'verb':
      return row.verb
    case 'provider':
      return row.providerName
    case 'purpose':
      return row.purpose
    case 'source':
      return sourceOf(row.providerName)
  }
}

/** Sort facet values by descending count, then ascending value for stable ties. */
function sortValues(counts: Map<string, number>): FacetValue[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/**
 * Derive facet value-counts for every {@link FACET_FIELDS} field from a page of rows.
 *
 * @param rows - The current page of audit rows (e.g. the loaded keyset pages).
 * @returns A {@link FacetsResult} mapping each field to its sorted value list.
 */
export function deriveFacets(rows: readonly NotificationLog[]): FacetsResult {
  const tallies: Record<FacetField, Map<string, number>> = {
    channel: new Map(),
    verb: new Map(),
    provider: new Map(),
    purpose: new Map(),
    source: new Map(),
  }
  for (const row of rows) {
    for (const field of FACET_FIELDS) {
      const value = valueOf(row, field)
      if (value === null || value === '') continue
      tallies[field].set(value, (tallies[field].get(value) ?? 0) + 1)
    }
  }
  return {
    channel: sortValues(tallies.channel),
    verb: sortValues(tallies.verb),
    provider: sortValues(tallies.provider),
    purpose: sortValues(tallies.purpose),
    source: sortValues(tallies.source),
  }
}
