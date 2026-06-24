/**
 * @fileoverview ProviderMix — a donut of delivery counts by provider.
 *
 * Reads the `provider`-grouped `/audit/aggregate` series (which includes the
 * `__interceptor__` boundary source as its own slice) and renders a Recharts
 * donut plus a legend whose swatch + icon + label match each slice. Loading shows
 * a skeleton; an empty window shows a short empty note.
 *
 * @module components/charts/provider-mix
 */

'use client'

import { Server } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { useAggregate } from '@/hooks/use-aggregate'
import { colorForIndex, type ChartSeries } from '@/lib/chart-series'
import { toDonut } from '@/lib/metrics'
import type { AuditQuery } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from './chart-card'
import { ChartLegend } from './chart-legend'

/** Glass tooltip style. */
const TOOLTIP_STYLE = {
  background: 'rgba(10,10,12,0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  fontSize: 11,
} as const

/** Donut geometry. */
const INNER_RADIUS = 42
const OUTER_RADIUS = 64
const CHART_HEIGHT = 180

interface ProviderMixProps {
  /** The active filter driving the series. */
  query: AuditQuery
}

/**
 * The provider-mix donut panel.
 *
 * @param props - {@link ProviderMixProps}.
 * @returns The titled donut card, a skeleton, or an empty state.
 */
export function ProviderMix({ query }: ProviderMixProps) {
  const { data, isLoading, isError } = useAggregate('provider', query)

  if (isError) {
    return (
      <ChartCard title="Provider mix">
        <p className="py-8 text-center text-sm text-destructive">Failed to load provider mix.</p>
      </ChartCard>
    )
  }

  if (isLoading) {
    return (
      <ChartCard title="Provider mix">
        <Skeleton className="mx-auto h-[160px] w-[160px] rounded-full" />
      </ChartCard>
    )
  }

  const slices = toDonut(data ?? [])

  if (slices.length === 0) {
    return (
      <ChartCard title="Provider mix">
        <p className="py-10 text-center text-sm text-muted-foreground">No provider activity yet.</p>
      </ChartCard>
    )
  }

  const legend: ChartSeries[] = slices.map((slice, i) => ({
    key: slice.name,
    label: slice.name,
    color: colorForIndex(i),
    icon: Server,
  }))

  return (
    <ChartCard title="Provider mix" legend={<ChartLegend items={legend} />}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={INNER_RADIUS}
            outerRadius={OUTER_RADIUS}
            isAnimationActive={false}
            stroke="rgba(0,0,0,0.3)"
          >
            {slices.map((slice, i) => (
              <Cell key={slice.name} fill={colorForIndex(i)} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
