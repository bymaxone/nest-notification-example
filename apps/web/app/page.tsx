/**
 * @fileoverview Overview page — the notification console landing view.
 *
 * A thin Server Component shell that renders the app chrome around the
 * `'use client'` delivery-health dashboard. Marked `force-dynamic` so the
 * URL-driven global controls (tenant / role / live) are read per request.
 *
 * @module app/page
 */

import { AppShell } from '@/components/layout/app-shell'
import { OverviewContent } from '@/components/charts/overview-content'

// URL-driven console: global controls (tenant/role/live) read search params.
export const dynamic = 'force-dynamic'

/**
 * Overview landing page.
 *
 * @returns The delivery-health dashboard inside the app shell.
 */
export default function OverviewPage() {
  return (
    <AppShell>
      <OverviewContent />
    </AppShell>
  )
}
