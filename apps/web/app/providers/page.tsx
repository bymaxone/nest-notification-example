/**
 * @fileoverview Providers & Templates page — channel status + email preview.
 *
 * A thin Server Component shell with a placeholder body. The full provider
 * matrix, template list, and email preview panel will be added in a later
 * iteration.
 *
 * @module app/providers/page
 */

import { AppShell } from '@/components/layout/app-shell'

export const dynamic = 'force-dynamic'

/**
 * Providers & Templates page.
 *
 * @returns The Providers placeholder inside the app shell.
 */
export default function ProvidersPage() {
  return (
    <AppShell>
      <section className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-white/55">
          Providers &amp; Templates — coming in a later iteration.
        </p>
      </section>
    </AppShell>
  )
}
