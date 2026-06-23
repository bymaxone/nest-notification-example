/**
 * @fileoverview LogTable — virtualized Explorer audit grid.
 *
 * TanStack Table v8 (headless) + TanStack Virtual v3 render a large audit log at
 * 60fps: sticky header, newest-first, keyset infinite scroll (older pages load
 * via `fetchNextPage` near the bottom — never OFFSET) from `useAuditLogs`. Live
 * SSE rows are appended at the bottom via the `liveRows` prop (highlighted); a row
 * click opens the detail drawer. Loading shows skeletons (not spinners); an empty
 * query shows an action-oriented prompt.
 *
 * @module components/explorer/log-table
 */

'use client'

import { useRef } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

import { useAuditLogs } from '@/hooks/use-audit-logs'
import { ApiError, type AuditQuery, type NotificationLog } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { notificationColumns } from './columns'

/** Grid template mirroring the column order in `columns.tsx` (recipient flexes). */
const GRID_COLUMNS = '120px 96px 130px minmax(180px,1fr) 110px 130px 96px'

/** Estimated row height (px) for the virtualizer. */
const ROW_HEIGHT = 36

/** Distance (px) from the bottom at which the next (older) page is prefetched. */
const SCROLL_THRESHOLD = 320

/** Number of skeleton rows shown while the first page loads. */
const SKELETON_ROWS = 12

interface LogTableProps {
  /** The active filter. */
  query: AuditQuery
  /** Called with the clicked row to open the detail drawer. */
  onRowClick: (row: NotificationLog) => void
  /** Live SSE rows appended at the bottom (oldest→newest) and highlighted. */
  liveRows?: NotificationLog[]
  /** Ref to the scroll container so the live tail can drive follow-mode. */
  scrollRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * Virtualized, keyset-paginated audit table.
 *
 * @param props - {@link LogTableProps}.
 * @returns The Explorer audit grid.
 */
export function LogTable({ query, onRowClick, liveRows = [], scrollRef }: LogTableProps) {
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useAuditLogs(query)

  const historical = (data?.pages ?? []).flatMap((page) => page.data)
  const rows: NotificationLog[] = liveRows.length > 0 ? [...historical, ...liveRows] : historical
  const historicalCount = historical.length

  const table = useReactTable({
    data: rows,
    columns: notificationColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const localRef = useRef<HTMLDivElement | null>(null)
  const parentRef = scrollRef ?? localRef

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  /** Prefetch the next (older) keyset page when the user nears the bottom. */
  const handleScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    const el = event.currentTarget
    if (
      el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage()
    }
  }

  const tableRows = table.getRowModel().rows
  const headerGroups = table.getHeaderGroups()

  return (
    <div className="overflow-hidden rounded-lg border border-(--glass-border)">
      <div
        className="sticky top-0 z-10 grid border-b border-(--glass-border) bg-black/60 px-3 py-2 backdrop-blur-md"
        style={{ gridTemplateColumns: GRID_COLUMNS }}
      >
        {headerGroups[0]?.headers.map((header) => (
          <span
            key={header.id}
            className="font-mono text-[10px] uppercase tracking-wide text-white/40"
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        ))}
      </div>

      <div ref={parentRef} onScroll={handleScroll} className="h-[68vh] overflow-auto">
        {error !== null && rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-destructive">
            Failed to load audit logs{error instanceof ApiError ? ` (${error.status})` : ''}. Check
            the API connection and retry.
          </p>
        ) : isLoading ? (
          <div className="space-y-1 p-3">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No events match this query. Widen the range or fire one from the Trigger Center.
          </p>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = tableRows[virtualRow.index]
              if (row === undefined) return null
              const isLive = virtualRow.index >= historicalCount
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onRowClick(row.original)}
                  className={cn(
                    'absolute left-0 grid w-full items-center gap-0 border-b border-white/5 px-3 text-left hover:bg-white/5',
                    isLive && 'animate-[pulse_1.2s_ease-in-out_1] bg-brand-500/10',
                  )}
                  style={{
                    gridTemplateColumns: GRID_COLUMNS,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <span key={cell.id} className="min-w-0 truncate pr-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  ))}
                </button>
              )
            })}
          </div>
        )}
        {isFetchingNextPage && (
          <p className="py-2 text-center font-mono text-[11px] text-white/40">
            Loading older events…
          </p>
        )}
      </div>
    </div>
  )
}
