/**
 * @fileoverview StatTile — a single delivery-health stat: icon + value + hint.
 *
 * A reusable glass card for the Overview health strip. Each tile pairs a
 * coloured icon (never colour alone) with a big headline value; the `danger`
 * flag rings the tile when a threshold is breached.
 *
 * @module components/charts/stat-tile
 */

'use client'

import type { LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatTileProps {
  /** Tile heading (mono). */
  title: string
  /** Big headline value (already formatted). */
  value: string
  /** Accessible icon paired with the colour. */
  icon: LucideIcon
  /** Icon / accent colour token. */
  color: string
  /** Optional sub-label under the value (e.g. `delivery rate`). */
  hint?: string
  /** When true, ring the tile red (threshold breached). */
  danger?: boolean
}

/**
 * A single delivery-health stat tile.
 *
 * @param props - {@link StatTileProps}.
 * @returns The stat tile card.
 */
export function StatTile({ title, value, icon: Icon, color, hint, danger = false }: StatTileProps) {
  return (
    <Card className={cn('min-w-40 flex-1', danger && 'ring-1 ring-destructive/60')}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="font-mono text-xs font-medium text-white/55">{title}</CardTitle>
        <Icon className="h-4 w-4 shrink-0" style={{ color }} aria-hidden="true" />
      </CardHeader>
      <CardContent className="space-y-1">
        <span className={cn('text-2xl font-bold', danger ? 'text-destructive' : 'text-foreground')}>
          {value}
        </span>
        {hint !== undefined && <p className="text-[11px] text-white/40">{hint}</p>}
      </CardContent>
    </Card>
  )
}
