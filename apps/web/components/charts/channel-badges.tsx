/**
 * @fileoverview ChannelBadges — per-channel delivery counts, click-to-filter.
 *
 * Reads the `channel`-grouped `/audit/aggregate` series and renders one badge per
 * channel (colour + icon + label from `lib/severity`, never colour alone). Each
 * badge is a link that pivots the Explorer to that channel via the URL
 * (`explorerHref`). Loading shows skeletons; an empty window shows a short note.
 *
 * @module components/charts/channel-badges
 */

'use client'

import Link from 'next/link'

import { useAggregate } from '@/hooks/use-aggregate'
import { asChannel } from '@/lib/filters'
import { explorerHref } from '@/lib/explorer-link'
import { toDonut } from '@/lib/metrics'
import { CHANNEL_SEVERITY, type SeverityMeta } from '@/lib/severity'
import type { AuditQuery } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from './chart-card'

interface ChannelBadgesProps {
  /** The active filter driving the series. */
  query: AuditQuery
}

/** Resolve a dimension value to its channel severity descriptor, else `undefined`. */
function severityFor(name: string): SeverityMeta | undefined {
  const channel = asChannel(name)
  return channel !== undefined ? CHANNEL_SEVERITY[channel] : undefined
}

/**
 * The channel-badge breakdown panel (click a badge to pivot the Explorer).
 *
 * @param props - {@link ChannelBadgesProps}.
 * @returns The titled badge card, a skeleton, or an empty state.
 */
export function ChannelBadges({ query }: ChannelBadgesProps) {
  const { data, isLoading, isError } = useAggregate('channel', query)

  if (isError) {
    return (
      <ChartCard title="Channels" interactive>
        <p className="py-8 text-center text-sm text-destructive">Failed to load channels.</p>
      </ChartCard>
    )
  }

  if (isLoading) {
    return (
      <ChartCard title="Channels" interactive>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </ChartCard>
    )
  }

  const slices = toDonut(data ?? [])

  if (slices.length === 0) {
    return (
      <ChartCard title="Channels" interactive>
        <p className="py-10 text-center text-sm text-muted-foreground">No channel activity yet.</p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Channels" interactive>
      <ul className="flex flex-wrap gap-2">
        {slices.map((slice) => {
          const meta = severityFor(slice.name)
          const color = meta?.color ?? '#60a5fa'
          const Icon = meta?.icon
          const label = meta?.label ?? slice.name
          return (
            <li key={slice.name}>
              <Link
                href={explorerHref({ channel: slice.name })}
                className="flex items-center gap-2 rounded-lg border border-(--glass-border) bg-(--glass-bg) px-3 py-1.5 text-xs hover:border-white/20"
                style={{ color }}
                title={`Filter the Explorer by ${label}`}
              >
                {Icon !== undefined && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                <span className="font-mono">{label}</span>
                <span className="tabular-nums text-white/45">{slice.value}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </ChartCard>
  )
}
