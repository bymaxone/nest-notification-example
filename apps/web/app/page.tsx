/**
 * @fileoverview Overview page — the notification console landing view.
 *
 * A thin Server Component shell that renders the app chrome with a placeholder
 * body. Overview charts and KPI data will be added in a later iteration.
 *
 * @module app/page
 */

import { AppShell } from '@/components/layout/app-shell'

// URL-driven console: global controls (tenant/role/live) read search params.
export const dynamic = 'force-dynamic'

/**
 * Overview landing page.
 *
 * @returns The Overview placeholder inside the app shell.
 */
export default function OverviewPage() {
  return (
    <AppShell>
      <section className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-white/55">
          Overview — charts and KPI data coming in a later iteration.
        </p>
      </section>
    </AppShell>
  )
}
