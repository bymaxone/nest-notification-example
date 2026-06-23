/**
 * @fileoverview Roadmap page — honest scope disclosure for unimplemented surfaces.
 *
 * A thin Server Component shell with a placeholder body. The full roadmap view
 * (SMS/Push declared-but-rejected channels, planned features) will be added in
 * a later iteration.
 *
 * @module app/roadmap/page
 */

import { AppShell } from '@/components/layout/app-shell'

export const dynamic = 'force-dynamic'

/**
 * Roadmap page.
 *
 * @returns The Roadmap placeholder inside the app shell.
 */
export default function RoadmapPage() {
  return (
    <AppShell>
      <section className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-white/55">Roadmap — coming in a later iteration.</p>
      </section>
    </AppShell>
  )
}
