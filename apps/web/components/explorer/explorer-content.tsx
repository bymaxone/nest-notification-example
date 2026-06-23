/**
 * @fileoverview ExplorerContent — the client body of the Audit Explorer.
 *
 * Two-pane layout: the faceted rail (left) + the query bar and virtualized table
 * (right). All filter state is the `nuqs` URL state, so a brushed range from the
 * Overview / a Trigger auto-pivot lands here pre-filtered. Row click selects a row
 * (the detail drawer is wired in a later iteration); the SSE live tail is wired in
 * a later iteration too.
 *
 * @module components/explorer/explorer-content
 */

'use client'

import { useState } from 'react'

import { useAuditQuery } from '@/lib/filters'
import type { NotificationLog } from '@/lib/types'
import { FacetRail } from './facet-rail'
import { QueryBar } from './query-bar'
import { LogTable } from './log-table'

/**
 * The Audit Explorer page body.
 *
 * @returns The composed Explorer (rail + query bar + virtualized table).
 */
export function ExplorerContent() {
  const { query } = useAuditQuery()
  const [selected, setSelected] = useState<NotificationLog | null>(null)

  const openRow = (row: NotificationLog): void => {
    setSelected(row)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <FacetRail />
      <div className="min-w-0 space-y-4">
        <QueryBar />
        {selected !== null && (
          <p aria-live="polite" className="font-mono text-[11px] text-white/40">
            Selected {selected.verb} · {selected.recipient}
          </p>
        )}
        <LogTable query={query} onRowClick={openRow} />
      </div>
    </div>
  )
}
