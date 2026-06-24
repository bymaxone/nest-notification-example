/**
 * @fileoverview DeliveryRateLine — sent-vs-failed delivery line over time.
 *
 * Reads the `verb`-grouped `/audit/aggregate` series, reshapes it into per-bucket
 * sent/failed points, and plots two Recharts lines whose colours match the
 * {@link DELIVERY_SERIES} legend (colour + icon + label). Loading shows a
 * skeleton; an empty window shows an action-oriented prompt.
 *
 * @module components/charts/delivery-rate-line
 */

'use client'

import Link from 'next/link'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useAggregate } from '@/hooks/use-aggregate'
import { DELIVERY_SERIES, VERB_SERIES } from '@/lib/chart-series'
import { deliverySeries } from '@/lib/metrics'
import type { AuditQuery } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from './chart-card'
import { ChartLegend } from './chart-legend'

/** Glass tooltip style shared by the Overview charts. */
const TOOLTIP_STYLE = {
  background: 'rgba(10,10,12,0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  fontSize: 11,
} as const

/** Chart pixel height. */
const CHART_HEIGHT = 220

interface DeliveryRateLineProps {
  /** The active filter driving the series. */
  query: AuditQuery
}

/**
 * The delivery-rate line panel (sent vs failed per bucket).
 *
 * @param props - {@link DeliveryRateLineProps}.
 * @returns The titled line-chart card, a skeleton, or an empty state.
 */
export function DeliveryRateLine({ query }: DeliveryRateLineProps) {
  const { data, isLoading, isError } = useAggregate('verb', query)

  if (isError) {
    return (
      <ChartCard title="Delivery rate">
        <p className="py-8 text-center text-sm text-destructive">
          Failed to load the delivery series.
        </p>
      </ChartCard>
    )
  }

  if (isLoading) {
    return (
      <ChartCard title="Delivery rate">
        <Skeleton className="h-[220px] w-full" />
      </ChartCard>
    )
  }

  const points = deliverySeries(data ?? [])

  if (points.length === 0) {
    return (
      <ChartCard title="Delivery rate">
        <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
          <p>No delivery events to chart yet.</p>
          <Link href="/trigger" className="font-mono text-brand-500 hover:underline">
            Fire one from the Trigger Center →
          </Link>
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Delivery rate" legend={<ChartLegend items={DELIVERY_SERIES} />}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line
            type="monotone"
            dataKey="sent"
            stroke={VERB_SERIES.sent.color}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="failed"
            stroke={VERB_SERIES.failed.color}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
