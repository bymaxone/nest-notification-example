/**
 * @fileoverview Settings page — console configuration.
 *
 * A thin Server Component shell with a placeholder body. The full settings
 * panel will be added in a later iteration.
 *
 * @module app/settings/page
 */

import { AppShell } from '@/components/layout/app-shell'

export const dynamic = 'force-dynamic'

/**
 * Settings page.
 *
 * @returns The Settings placeholder inside the app shell.
 */
export default function SettingsPage() {
  return (
    <AppShell>
      <section className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-white/55">Settings — coming in a later iteration.</p>
      </section>
    </AppShell>
  )
}
