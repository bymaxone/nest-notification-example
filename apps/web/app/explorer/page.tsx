/**
 * @fileoverview Audit Explorer page — keyset-paginated audit log with live tail.
 *
 * A thin Server Component shell with a placeholder body. The full audit table,
 * SSE live tail, and facet filters will be added in a later iteration.
 *
 * @module app/explorer/page
 */

import { AppShell } from '@/components/layout/app-shell'

export const dynamic = 'force-dynamic'

/**
 * Audit Explorer page.
 *
 * @returns The Audit Explorer placeholder inside the app shell.
 */
export default function ExplorerPage() {
  return (
    <AppShell>
      <section className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-white/55">Audit Explorer — coming in a later iteration.</p>
      </section>
    </AppShell>
  )
}
