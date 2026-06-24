/**
 * @fileoverview OverviewContent — the delivery-health dashboard body.
 *
 * Composes top→bottom, general→specific: the health strip (send/delivery/verify/
 * failure tiles) → the delivery-rate line (sent vs failed) → a breakdown row
 * (channel badges, provider-mix donut, top purposes). Each panel reads the shared
 * `useAuditQuery` filter; the breakdown panels pivot the Explorer via the URL
 * (`explorerHref`). All state lives in the URL, so a click lands the Explorer
 * pre-filtered (`OVERVIEW.md §10`).
 *
 * @module components/charts/overview-content
 */

'use client'

import { useFacets } from '@/hooks/use-facets'
import { useAuditQuery } from '@/lib/filters'
import { explorerHref } from '@/lib/explorer-link'
import { ChannelBadges } from './channel-badges'
import { DeliveryRateLine } from './delivery-rate-line'
import { HealthStrip } from './health-strip'
import { ProviderMix } from './provider-mix'
import { TopBar } from './top-bar'

/**
 * The Overview delivery-health dashboard body.
 *
 * @returns The composed Overview (health strip + delivery line + breakdown row).
 */
export function OverviewContent() {
  const { query } = useAuditQuery()
  const { facets, isLoading } = useFacets(query)

  return (
    <div className="space-y-6">
      <HealthStrip query={query} />
      <DeliveryRateLine query={query} />
      <div className="grid gap-4 lg:grid-cols-3">
        <ChannelBadges query={query} />
        <ProviderMix query={query} />
        <TopBar
          title="Top purposes"
          rows={facets.purpose}
          loading={isLoading}
          hrefFor={(value) => explorerHref({ purpose: value })}
        />
      </div>
    </div>
  )
}
