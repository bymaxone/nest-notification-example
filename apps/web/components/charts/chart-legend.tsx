/**
 * @fileoverview ChartLegend — a compact legend (swatch + icon + label) per series.
 *
 * Reads {@link ChartSeries} metadata shared with the chart itself, so the swatch
 * and icon always match the line/slice they describe. Never colour alone — every
 * row pairs the swatch with the series icon and label.
 *
 * @module components/charts/chart-legend
 */

'use client'

import type { ChartSeries } from '@/lib/chart-series'
import { cn } from '@/lib/utils'

interface ChartLegendProps {
  /** Series to describe, in render order. */
  items: readonly ChartSeries[]
  /** Optional extra classes. */
  className?: string
}

/**
 * A horizontal, wrapping legend row of colour swatch + icon + label per series.
 *
 * @param props - {@link ChartLegendProps}.
 * @returns The legend list, or `null` when there is nothing to describe.
 */
export function ChartLegend({ items, className }: ChartLegendProps) {
  if (items.length === 0) return null
  return (
    <ul
      aria-label="Chart legend"
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}
    >
      {items.map((series) => {
        const Icon = series.icon
        return (
          <li
            key={series.key}
            className="flex items-center gap-1.5 text-[11px] leading-none text-white/55"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: series.color }}
            />
            <Icon className="h-3 w-3 shrink-0" style={{ color: series.color }} aria-hidden="true" />
            <span className="font-mono">{series.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
