/**
 * @fileoverview `useAuditLogs` — keyset/infinite audit query for the Explorer table.
 *
 * Wraps TanStack Query's `useInfiniteQuery`; `getNextPageParam` reads the opaque
 * keyset `nextCursor` (never an OFFSET). A `410 Gone` (stale cursor) removes the
 * cached query so the next render restarts pagination from the newest page.
 *
 * @module hooks/use-audit-logs
 */

'use client'

import { useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'

import { fetchLogs } from '@/lib/audit-api'
import { ApiError, type AuditQuery, type NotificationLog, type PageResult } from '@/lib/types'

/** HTTP status the API returns for a stale/invalid keyset cursor. */
const STALE_CURSOR_STATUS = 410

/**
 * Infinite keyset query over `GET /audit/logs`.
 *
 * @param query - The active filter; changing it starts a fresh keyset scan.
 * @returns The TanStack `useInfiniteQuery` result (pages of {@link NotificationLog}).
 */
export function useAuditLogs(query: AuditQuery) {
  const client = useQueryClient()

  const result = useInfiniteQuery({
    queryKey: ['audit-logs', query],
    queryFn: ({
      pageParam,
    }: {
      pageParam: string | undefined
    }): Promise<PageResult<NotificationLog>> =>
      fetchLogs(pageParam !== undefined ? { ...query, cursor: pageParam } : query),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PageResult<NotificationLog>): string | undefined =>
      last.nextCursor ?? undefined,
  })

  // A stale cursor (410) invalidates the whole keyset chain — drop it so the next
  // access restarts cleanly from the newest page.
  const { error } = result
  useEffect(() => {
    if (error instanceof ApiError && error.status === STALE_CURSOR_STATUS) {
      client.removeQueries({ queryKey: ['audit-logs', query] })
    }
  }, [error, client, query])

  return result
}
