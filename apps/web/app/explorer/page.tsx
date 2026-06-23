/**
 * @fileoverview Audit Explorer page — keyset-paginated audit log with live tail.
 *
 * A thin Server Component shell that renders the app chrome around the
 * `'use client'` Explorer body. Marked `force-dynamic` so the URL-driven filter
 * state is read per request.
 *
 * @module app/explorer/page
 */

import { AppShell } from '@/components/layout/app-shell'
import { ExplorerContent } from '@/components/explorer/explorer-content'

export const dynamic = 'force-dynamic'

/**
 * Audit Explorer page.
 *
 * @returns The Audit Explorer inside the app shell.
 */
export default function ExplorerPage() {
  return (
    <AppShell>
      <ExplorerContent />
    </AppShell>
  )
}
