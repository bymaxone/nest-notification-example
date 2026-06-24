/**
 * @fileoverview ExplorerContent — the client body of the Audit Explorer.
 *
 * Two-pane layout: the faceted rail (left) + the query bar, live-tail control bar,
 * and virtualized table (right). All filter state is the `nuqs` URL state, so a
 * brushed range / a Trigger auto-pivot lands here pre-filtered. When the global
 * Live toggle is on and the range is relative, the SSE tail (over the same-origin
 * proxy) appends new rows at the bottom with follow-mode (pinned auto-scroll;
 * scroll-up pauses with an "N new — jump to latest" pill). Row click selects a
 * row (the detail drawer is wired in a later iteration).
 *
 * @module components/explorer/explorer-content
 */

'use client'

import { useRef, useState } from 'react'
import { ArrowDownToLine, Eraser, Pause, Play, Radio } from 'lucide-react'

import { useAuditQuery } from '@/lib/filters'
import { useAuditStream } from '@/lib/sse'
import { useFollowMode } from '@/hooks/use-follow-mode'
import type { NotificationLog } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FacetRail } from './facet-rail'
import { QueryBar } from './query-bar'
import { LogTable } from './log-table'
import { DetailDrawer } from './detail-drawer'

/**
 * Resolve the live-tail status label from the stream + enabled state.
 *
 * @param failed - Whether the stream hit a terminal failure.
 * @param connected - Whether the EventSource is open.
 * @param enabled - Whether the stream is enabled (live + relative range).
 * @returns The human status label.
 */
function statusLabel(failed: boolean, connected: boolean, enabled: boolean): string {
  if (failed) return 'Live tail failed — retry'
  if (connected) return 'Streaming'
  if (enabled) return 'Connecting…'
  return 'Paused (absolute range)'
}

/** Stream + follow-mode surface the live control bar consumes. */
interface LiveBarProps {
  /** The SSE stream state. */
  stream: ReturnType<typeof useAuditStream>
  /** The follow-mode state. */
  follow: ReturnType<typeof useFollowMode>
  /** Whether the stream is enabled (live + relative range). */
  streamEnabled: boolean
}

/** The live-tail control bar (status + N-live count + Pause/Resume/Clear). */
function LiveControlBar({ stream, follow, streamEnabled }: LiveBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-(--glass-border) bg-(--glass-bg) px-3 py-2 text-xs">
      <span
        className={cn(
          'flex items-center gap-1.5 font-mono',
          stream.isFailed
            ? 'text-destructive'
            : stream.isConnected
              ? 'text-(--color-success)'
              : 'text-white/40',
        )}
      >
        <Radio className={cn('h-3.5 w-3.5', stream.isConnected && 'animate-pulse')} />
        {statusLabel(stream.isFailed, stream.isConnected, streamEnabled)}
      </span>
      <span className="text-white/30">·</span>
      <span className="font-mono text-white/45">{stream.rows.length} live</span>
      <div className="ml-auto flex items-center gap-1.5">
        {follow.paused ? (
          <Button type="button" size="sm" variant="outline" onClick={follow.resume}>
            <Play className="h-3.5 w-3.5" /> Resume
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={follow.pause}>
            <Pause className="h-3.5 w-3.5" /> Pause
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={stream.clear}>
          <Eraser className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>
    </div>
  )
}

/** The "N new — Jump to latest" pill shown when paused with pending live rows. */
function JumpPill({ count, onJump }: { count: number; onJump: () => void }) {
  return (
    <button
      type="button"
      onClick={onJump}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-4 py-1.5 font-mono text-xs font-semibold text-white shadow-(--shadow-primary)"
    >
      <ArrowDownToLine className="mr-1 inline h-3.5 w-3.5" />
      {count} new — Jump to latest
    </button>
  )
}

/**
 * The Audit Explorer page body.
 *
 * @returns The composed Explorer (rail + query bar + live tail + table).
 */
export function ExplorerContent() {
  const { query, live, isRelative } = useAuditQuery()
  const [selected, setSelected] = useState<NotificationLog | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const streamEnabled = live && isRelative
  const stream = useAuditStream(query, streamEnabled)
  const follow = useFollowMode(scrollRef, stream.rows.length)

  const openRow = (row: NotificationLog): void => {
    setSelected(row)
    setDrawerOpen(true)
  }

  const onDrawerChange = (open: boolean): void => {
    setDrawerOpen(open)
    if (!open) setSelected(null)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <FacetRail />
      <div className="min-w-0 space-y-4">
        <QueryBar />

        {live && <LiveControlBar stream={stream} follow={follow} streamEnabled={streamEnabled} />}

        <div className="relative">
          <LogTable
            query={query}
            onRowClick={openRow}
            liveRows={live ? stream.rows : []}
            scrollRef={scrollRef}
          />
          {live && follow.newCount > 0 && (
            <JumpPill count={follow.newCount} onJump={follow.jumpToLatest} />
          )}
        </div>

        <DetailDrawer row={selected} open={drawerOpen} onOpenChange={onDrawerChange} />
      </div>
    </div>
  )
}
