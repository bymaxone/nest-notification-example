/**
 * @fileoverview `useFacets` — facet values + counts for the Explorer rail / Overview.
 *
 * The notification read-API exposes no `/facets` endpoint, so counts are derived
 * client-side from the loaded keyset pages of the SAME `useAuditLogs` query (the
 * cache is shared by query key, so this never doubles the network traffic). The
 * pure {@link deriveFacets} does the tally; this hook only adapts the loading
 * states for the rail.
 *
 * @module hooks/use-facets
 */

'use client'

import { useMemo } from 'react'

import { useAuditLogs } from './use-audit-logs'
import { deriveFacets } from '@/lib/audit-facets'
import type { AuditQuery, FacetsResult, NotificationLog, PageResult } from '@/lib/types'

/** Facet counts plus the loading/error state of the underlying logs query. */
export interface FacetsState {
  /** The derived facet value-counts for each field. */
  facets: FacetsResult
  /** Whether the first page is still loading. */
  isLoading: boolean
  /** Whether the underlying logs query errored. */
  isError: boolean
}

/**
 * Derive facet value-counts from the loaded pages of the audit-logs query.
 *
 * @param query - The active filter (shared with the Explorer table query).
 * @returns The facet counts plus the underlying loading/error flags.
 */
export function useFacets(query: AuditQuery): FacetsState {
  const { data, isLoading, isError } = useAuditLogs(query)
  const facets = useMemo<FacetsResult>(() => {
    const rows: NotificationLog[] = (data?.pages ?? []).flatMap(
      (page: PageResult<NotificationLog>) => page.data,
    )
    return deriveFacets(rows)
  }, [data])
  return { facets, isLoading, isError }
}
