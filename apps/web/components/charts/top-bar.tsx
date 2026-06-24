/**
 * @fileoverview TopBar — a reusable horizontal top-N facet panel, click-to-filter.
 *
 * Renders bounded-dimension facet rows (purposes, providers, …) as horizontal
 * bars whose width is proportional to the count. Each row is a link that pivots
 * the Explorer to that value via the URL (built by the caller's `hrefFor`).
 * Loading shows skeletons; an empty list shows a short note.
 *
 * @module components/charts/top-bar
 */

'use client'

import Link from 'next/link'

import type { FacetValue } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from './chart-card'

/** Max rows rendered (keeps the panel compact). */
const MAX_ROWS = 6

interface TopBarProps {
  /** Panel heading. */
  title: string
  /** Facet rows to render (already counted). */
  rows: readonly FacetValue[]
  /** Build the Explorer deep-link for a clicked value. */
  hrefFor: (value: string) => string
  /** Bar fill colour (defaults to brand orange). */
  fill?: string
  /** Whether the data is still loading. */
  loading?: boolean
}

/**
 * A reusable horizontal top-N facet panel with click-to-filter.
 *
 * @param props - {@link TopBarProps}.
 * @returns The titled top-N card, a skeleton, or an empty state.
 */
export function TopBar({ title, rows, hrefFor, fill = '#ff6224', loading = false }: TopBarProps) {
  if (loading) {
    return (
      <ChartCard title={title} interactive>
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      </ChartCard>
    )
  }

  const top = rows.slice(0, MAX_ROWS)

  if (top.length === 0) {
    return (
      <ChartCard title={title} interactive>
        <p className="py-8 text-center text-xs text-white/40">No data yet.</p>
      </ChartCard>
    )
  }

  const max = Math.max(...top.map((row) => row.count))

  return (
    <ChartCard title={title} interactive>
      <ul className="space-y-1">
        {top.map((row) => (
          <li key={row.value}>
            <Link
              href={hrefFor(row.value)}
              title={`Filter the Explorer by ${row.value}`}
              className="relative flex items-center justify-between gap-2 overflow-hidden rounded px-2 py-1 text-xs hover:bg-white/5"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded opacity-20"
                style={{ width: `${(row.count / max) * 100}%`, background: fill }}
              />
              <span className="z-1 truncate font-mono text-white/70">{row.value}</span>
              <span className="z-1 shrink-0 tabular-nums text-white/45">{row.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}
