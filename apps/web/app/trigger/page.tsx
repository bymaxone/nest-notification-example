/**
 * @fileoverview Trigger Center page — notification dispatch playground.
 *
 * A thin Server Component shell with a placeholder body. The full trigger
 * form (OTP, email, dispatch) will be added in a later iteration.
 *
 * @module app/trigger/page
 */

import { AppShell } from '@/components/layout/app-shell'

export const dynamic = 'force-dynamic'

/**
 * Trigger Center page.
 *
 * @returns The Trigger Center placeholder inside the app shell.
 */
export default function TriggerPage() {
  return (
    <AppShell>
      <section className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-white/55">Trigger Center — coming in a later iteration.</p>
      </section>
    </AppShell>
  )
}
