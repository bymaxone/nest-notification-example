/**
 * @fileoverview Trigger Center page — fire every feature, then jump to the Explorer.
 *
 * A thin Server Component shell that renders the app chrome, a header, and the
 * `'use client'` TriggerGrid. Marked `force-dynamic` so the URL-driven active
 * tenant is read per request.
 *
 * @module app/trigger/page
 */

import { AppShell } from '@/components/layout/app-shell'
import { TriggerGrid } from '@/components/trigger/trigger-grid'

export const dynamic = 'force-dynamic'

/**
 * Trigger Center page.
 *
 * @returns The Trigger Center grid inside the app shell.
 */
export default function TriggerPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Trigger Center</h1>
          <p className="text-sm text-white/55">
            Fire each feature, then jump to the Explorer to see the audit row it lands.
          </p>
        </div>
        <TriggerGrid />
      </div>
    </AppShell>
  )
}
