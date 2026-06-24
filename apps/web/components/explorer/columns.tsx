/**
 * @fileoverview Column definitions for the Explorer audit table.
 *
 * TanStack Table v8 `ColumnDef<NotificationLog>[]`. `verb` and `channel` render
 * with a severity colour + icon + label (never colour alone — `lib/severity` for
 * channels, `lib/chart-series` for verbs); `recipient` renders masked exactly as
 * the API returns it (never the raw address); `source` shows the dual-source
 * discriminator (`service` vs `__interceptor__`). There is no `code` column to
 * render — the audit row is structurally code-free (`OVERVIEW.md §15`).
 *
 * @module components/explorer/columns
 */

'use client'

import type { ColumnDef } from '@tanstack/react-table'

import { VERB_SERIES } from '@/lib/chart-series'
import { sourceOf } from '@/lib/audit-facets'
import { CHANNEL_SEVERITY } from '@/lib/severity'
import type { NotificationLog } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

/** Format an ISO timestamp as `HH:MM:SS.mmm`. */
function formatStamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

/** Column definitions for the virtualized audit table. */
export const notificationColumns: ColumnDef<NotificationLog>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => (
      <span className="font-mono text-[11px] tabular-nums text-white/55">
        {formatStamp(row.original.timestamp)}
      </span>
    ),
  },
  {
    accessorKey: 'channel',
    header: 'Channel',
    cell: ({ row }) => {
      const meta = CHANNEL_SEVERITY[row.original.channel]
      const Icon = meta.icon
      return (
        <span
          className="flex items-center gap-1.5 font-mono text-[11px]"
          style={{ color: meta.color }}
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {meta.label}
        </span>
      )
    },
  },
  {
    accessorKey: 'verb',
    header: 'Verb',
    cell: ({ row }) => {
      const meta = VERB_SERIES[row.original.verb]
      const Icon = meta.icon
      return (
        <span
          className="flex items-center gap-1.5 font-mono text-[11px]"
          style={{ color: meta.color }}
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {meta.label}
        </span>
      )
    },
  },
  {
    accessorKey: 'recipient',
    header: 'Recipient',
    cell: ({ row }) => (
      <span className="truncate font-mono text-[11px] text-white/70">{row.original.recipient}</span>
    ),
  },
  {
    accessorKey: 'purpose',
    header: 'Purpose',
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-white/55">{row.original.purpose ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'providerName',
    header: 'Provider',
    cell: ({ row }) => (
      <span className="truncate font-mono text-[11px] text-white/45">
        {row.original.providerName}
      </span>
    ),
  },
  {
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-[10px]">
        {sourceOf(row.original.providerName)}
      </Badge>
    ),
  },
]
