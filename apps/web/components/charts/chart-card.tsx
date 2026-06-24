/**
 * @fileoverview ChartCard — a glass panel wrapper for a titled chart.
 *
 * Centralizes the glass card + mono title used by every Overview panel so the
 * chart components stay focused on their data + Recharts markup. A decorative
 * chart body is exposed to assistive tech as a single labelled image; an
 * interactive body keeps its tree so the controls stay operable.
 *
 * @module components/charts/chart-card
 */

'use client'

import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  /** Panel heading (mono). */
  title: string
  /** Optional right-aligned node (e.g. a stat readout). */
  action?: ReactNode
  /** Optional legend rendered as a footer row below the chart. */
  legend?: ReactNode
  /** The chart / panel body. */
  children: ReactNode
  /** Extra classes for the card. */
  className?: string
  /**
   * Whether the body contains operable controls. When `false` (default) the body
   * is one labelled image (`role="img"` + the title) so a decorative SVG chart
   * gets a single accessible name; when `true` the children stay in the tree.
   */
  interactive?: boolean
}

/**
 * Glass panel wrapper with a mono title and an optional header action + legend footer.
 *
 * @param props - {@link ChartCardProps}.
 * @returns The titled chart card.
 */
export function ChartCard({
  title,
  action,
  legend,
  children,
  className,
  interactive = false,
}: ChartCardProps) {
  const a11y = interactive ? {} : { role: 'img' as const, 'aria-label': `${title} chart` }
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="font-mono text-sm font-medium text-white/70">{title}</CardTitle>
        {action !== undefined && <div className="flex items-center gap-1">{action}</div>}
      </CardHeader>
      <CardContent className={cn('flex-1', legend !== undefined && 'pb-3')} {...a11y}>
        {children}
      </CardContent>
      {legend !== undefined && <div className="border-t border-white/5 px-6 py-3">{legend}</div>}
    </Card>
  )
}
