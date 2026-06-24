/**
 * @fileoverview RoadmapPanel — the honest v0.2 + console-roadmap preview.
 *
 * Three "try to enable" cards (SMS · Push · useClass) each POST to an
 * `/admin/try-configure-*` route and render the library's REAL startup-rejection
 * message verbatim (proving the v0.2 interfaces exist but are rejected today),
 * plus the localized code where one maps. A second section honestly declares the
 * two console surfaces that are designed but not yet built — each names what the
 * backend would need first, consistent with how SMS/Push are shown.
 *
 * @module components/roadmap/roadmap-panel
 */

'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import {
  tryConfigureAsyncUseClass,
  tryConfigurePush,
  tryConfigureSms,
  type RoadmapRejection,
} from '@/lib/api/roadmap'
import { localizeNotificationError } from '@/lib/error-codes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** One "try to enable a rejected surface" probe. */
interface RoadmapProbe {
  /** Stable id + React key. */
  id: string
  /** Card title (the action it offers). */
  title: string
  /** A timeless, one-line description of what the surface would add. */
  description: string
  /** The probe call returning the verbatim rejection. */
  run: () => Promise<RoadmapRejection>
}

/** The v0.2 surfaces the backend rejects at startup today. */
const PROBES: readonly RoadmapProbe[] = [
  {
    id: 'sms',
    title: 'Enable SMS',
    description: 'SMS delivery is declared but not enabled in this build.',
    run: tryConfigureSms,
  },
  {
    id: 'push',
    title: 'Enable Push',
    description: 'Push delivery is declared but not enabled in this build.',
    run: tryConfigurePush,
  },
  {
    id: 'useclass',
    title: 'Use useClass registration',
    description: 'The async useClass provider form is declared but rejected at startup.',
    run: tryConfigureAsyncUseClass,
  },
]

/** A console surface that is designed but not yet built. */
interface ConsoleRoadmapItem {
  /** Stable id + React key. */
  id: string
  /** The surface title. */
  title: string
  /** What it would add. */
  summary: string
  /** What the backend must provide before it can ship. */
  needs: string
}

/** The two declared-but-not-yet-built console surfaces. */
const CONSOLE_ROADMAP: readonly ConsoleRoadmapItem[] = [
  {
    id: 'break-audit-sink',
    title: 'Break audit sink demo',
    summary: 'A Trigger Center action that forces an audit-write failure to show fault tolerance.',
    needs:
      'An API fault-injection endpoint that fails the audit write (surfacing AUDIT_LOG_FAILED).',
  },
  {
    id: 'latency-percentiles',
    title: 'Latency percentiles on Overview',
    summary: 'A p50/p95 latency-to-sent panel on the delivery-health Overview.',
    needs: 'A duration column on NotificationLog so percentiles can be aggregated.',
  },
]

/** A single probe card with its run state + verbatim rejection. */
function ProbeCard({ probe }: { probe: RoadmapProbe }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RoadmapRejection | null>(null)

  const onRun = async (): Promise<void> => {
    setBusy(true)
    try {
      setResult(await probe.run())
    } catch {
      // An unexpected throw still leaves the button usable and shows the no-message
      // fallback rather than sticking disabled forever.
      setResult({ code: null, message: '' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card data-testid={`probe-${probe.id}`}>
      <CardHeader>
        <CardTitle className="text-base">{probe.title}</CardTitle>
        <CardDescription>{probe.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button type="button" size="sm" onClick={() => void onRun()} disabled={busy}>
          {busy ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : null}
          {busy ? 'Trying…' : 'Try'}
        </Button>
        {result !== null && (
          <div className="flex flex-col gap-2" role="status">
            {result.code !== null && (
              <Badge variant="outline">{localizeNotificationError(result.code)}</Badge>
            )}
            <pre className="overflow-auto rounded-lg border border-(--glass-border) bg-(--glass-bg) p-2 text-xs text-amber-400">
              {result.message === ''
                ? 'The backend did not return a rejection message.'
                : result.message}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * The Roadmap panel — v0.2 rejection probes + declared console surfaces.
 *
 * @returns The probe cards + the console-roadmap declarations.
 */
export function RoadmapPanel() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Roadmap</h1>
        <p className="text-sm text-white/55">
          An honest preview: the v0.2 interfaces exist but the backend rejects them at startup
          today. Try one to see the library&apos;s real rejection.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PROBES.map((probe) => (
          <ProbeCard key={probe.id} probe={probe} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/55">
          Declared console surfaces (not yet built)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CONSOLE_ROADMAP.map((item) => (
            <Card key={item.id} data-testid={`roadmap-${item.id}`}>
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-white/55">Needs: {item.needs}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
