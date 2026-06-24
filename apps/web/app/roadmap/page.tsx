/**
 * @fileoverview Roadmap page — honest scope disclosure for unimplemented surfaces.
 *
 * A thin Server Component shell that mounts the `'use client'` roadmap panel: the
 * v0.2 startup-rejection probes (SMS · Push · useClass) plus the declared-but-not-
 * yet-built console surfaces. Marked `force-dynamic` to match the other routes.
 *
 * @module app/roadmap/page
 */

import { AppShell } from '@/components/layout/app-shell'
import { RoadmapPanel } from '@/components/roadmap/roadmap-panel'

export const dynamic = 'force-dynamic'

/**
 * Roadmap page.
 *
 * @returns The roadmap panel inside the app shell.
 */
export default function RoadmapPage() {
  return (
    <AppShell>
      <RoadmapPanel />
    </AppShell>
  )
}
