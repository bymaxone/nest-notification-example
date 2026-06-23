/**
 * @fileoverview HealthStrip — the Overview's delivery-health stat tiles.
 *
 * Reads the `verb`-grouped `/audit/aggregate` series and renders send count,
 * delivery rate (sent ÷ sent+failed), verify rate (verified ÷ generated), and
 * failures — each a {@link StatTile} with a coloured icon. Loading shows skeleton
 * tiles (never spinners); an empty window shows an action-oriented prompt to fire
 * an event from the Trigger Center (`OVERVIEW.md §10`).
 *
 * @module components/charts/health-strip
 */

'use client'

import Link from 'next/link'

import { useAggregate } from '@/hooks/use-aggregate'
import { VERB_SERIES } from '@/lib/chart-series'
import { formatCount, formatPct, grandTotal, ratePct, totalOf } from '@/lib/metrics'
import type { AuditQuery } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatTile } from './stat-tile'

/** Delivery-rate threshold below which the delivery tile turns red (90%). */
const DELIVERY_RATE_THRESHOLD = 90

/** Number of skeleton tiles shown while the series loads. */
const TILE_COUNT = 4

interface HealthStripProps {
  /** The active filter driving every tile. */
  query: AuditQuery
}

/**
 * The Overview delivery-health stat strip.
 *
 * @param props - {@link HealthStripProps}.
 * @returns The four-tile responsive health row, a skeleton, or an empty state.
 */
export function HealthStrip({ query }: HealthStripProps) {
  const { data, isLoading, isError } = useAggregate('verb', query)

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Failed to load delivery metrics. Check that the API is reachable, then retry.
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: TILE_COUNT }, (_, i) => (
          <Card key={i} className="min-w-40 flex-1">
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const rows = data ?? []
  const total = grandTotal(rows)

  if (total === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-6 text-sm text-muted-foreground">
          <p>No delivery events in this window yet.</p>
          <Link href="/trigger" className="font-mono text-brand-500 hover:underline">
            Fire one from the Trigger Center →
          </Link>
        </CardContent>
      </Card>
    )
  }

  const sent = totalOf(rows, 'sent')
  const failed = totalOf(rows, 'failed')
  const generated = totalOf(rows, 'generated')
  const verified = totalOf(rows, 'verified')
  const deliveryRate = ratePct(sent, sent + failed)
  const verifyRate = ratePct(verified, generated)

  return (
    <div className="flex flex-wrap gap-4">
      <StatTile
        title="DELIVERED"
        value={formatCount(sent)}
        hint="sent in window"
        icon={VERB_SERIES.sent.icon}
        color={VERB_SERIES.sent.color}
      />
      <StatTile
        title="DELIVERY RATE"
        value={formatPct(deliveryRate)}
        hint="sent vs failed"
        icon={VERB_SERIES.generated.icon}
        color={VERB_SERIES.generated.color}
        danger={deliveryRate < DELIVERY_RATE_THRESHOLD}
      />
      <StatTile
        title="VERIFY RATE"
        value={formatPct(verifyRate)}
        hint="verified of generated"
        icon={VERB_SERIES.verified.icon}
        color={VERB_SERIES.verified.color}
      />
      <StatTile
        title="FAILURES"
        value={formatCount(failed)}
        hint="failed in window"
        icon={VERB_SERIES.failed.icon}
        color={VERB_SERIES.failed.color}
        danger={failed > 0}
      />
    </div>
  )
}
