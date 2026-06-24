/**
 * @fileoverview `useAggregate` — server-side chart data for one group-by dimension.
 *
 * Thin `useQuery` wrapper over `GET /audit/aggregate`. The Overview charts read
 * this hook only; the browser never aggregates raw rows (`OVERVIEW.md §15`).
 *
 * @module hooks/use-aggregate
 */

'use client'

import { useQuery } from '@tanstack/react-query'

import { fetchAggregate } from '@/lib/audit-api'
import type { AggregateBucket, AggregateGroupBy, AuditQuery } from '@/lib/types'

/**
 * Query a time-bucketed aggregate series for one group-by dimension.
 *
 * @param groupBy - One of `verb` / `channel` / `provider`.
 * @param query - The active filter (time window + tenant scope + source facet).
 * @returns The TanStack `useQuery` result for the {@link AggregateBucket} series.
 */
export function useAggregate(groupBy: AggregateGroupBy, query: AuditQuery) {
  return useQuery<AggregateBucket[]>({
    queryKey: ['audit-aggregate', groupBy, query],
    queryFn: () => fetchAggregate(query, groupBy),
  })
}
