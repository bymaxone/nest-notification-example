/**
 * @fileoverview TriggerCard — one fire-a-feature card.
 *
 * Presentational + local fire state only: title, a "Demonstrates" line, the
 * endpoint as a mono badge, and a Fire button. Firing runs the injected `fire`
 * callback, toggles a loading state, toasts the outcome (an `isExpectedError`
 * 4xx/5xx is the expected result, not a failure), and — on completion — reveals
 * the correlation summary + a "View in Explorer →" deep-link that auto-pivots the
 * Explorer to the resulting audit row(s). Never surfaces an OTP code.
 *
 * @module components/trigger/trigger-card
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'

import type { TriggerResult } from '@/lib/trigger-api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FireContext, TriggerDescriptor } from './trigger-grid'

interface TriggerCardProps {
  /** The trigger definition this card fires. */
  descriptor: TriggerDescriptor
  /** Active tenant id (from the global control) used by the fire. */
  tenantId: string
  /** Build the Explorer deep-link href from the fire result. */
  hrefFor: (result: TriggerResult) => string
}

/** The card header: title + "Demonstrates" line + the endpoint badge. */
function CardHeader({ descriptor }: { descriptor: TriggerDescriptor }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{descriptor.title}</h3>
        <p className="mt-0.5 text-xs text-white/55">{descriptor.demonstrates}</p>
      </div>
      <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
        {descriptor.endpoint}
      </Badge>
    </div>
  )
}

/** The post-fire correlation summary + "View in Explorer →" deep-link. */
function FireResultSummary({ result, href }: { result: TriggerResult; href: string }) {
  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-1 border-t border-(--glass-border) pt-2 text-[11px]"
    >
      <span className={cn('font-mono', result.ok ? 'text-white/55' : 'text-amber-400')}>
        HTTP {result.status} · {result.channel} · {result.verb}
      </span>
      <Link
        href={href}
        className="inline-flex items-center gap-1 font-medium text-brand-500 hover:underline"
      >
        View in Explorer <ArrowRight aria-hidden className="h-3 w-3" />
      </Link>
    </div>
  )
}

/**
 * A single Trigger Center card.
 *
 * @param props - {@link TriggerCardProps}.
 * @returns The card with its Fire button and post-fire result.
 */
export function TriggerCard({ descriptor, tenantId, hrefFor }: TriggerCardProps) {
  const [isFiring, setIsFiring] = useState(false)
  const [result, setResult] = useState<TriggerResult | null>(null)

  const onFire = async (): Promise<void> => {
    setIsFiring(true)
    try {
      const ctx: FireContext = { tenantId }
      const value = await descriptor.fire(ctx)
      const unexpectedError = !value.ok && descriptor.isExpectedError !== true
      if (unexpectedError) {
        toast.error(`${descriptor.title} returned ${value.status}`)
      } else {
        toast.success(`${descriptor.title} fired`, { description: `HTTP ${value.status}` })
      }
      setResult(value)
    } catch (err) {
      toast.error(`${descriptor.title} failed`, {
        description: err instanceof Error ? err.message : 'Network error',
      })
    } finally {
      setIsFiring(false)
    }
  }

  return (
    <div
      data-testid={`trigger-${descriptor.id}`}
      className="flex flex-col gap-3 rounded-xl border border-(--glass-border) bg-(--glass-bg) p-4"
    >
      <CardHeader descriptor={descriptor} />

      <Button
        type="button"
        size="sm"
        onClick={() => void onFire()}
        disabled={isFiring}
        className="mt-auto w-full"
      >
        {isFiring ? (
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap aria-hidden className="h-3.5 w-3.5" />
        )}
        {isFiring ? 'Firing…' : 'Fire'}
      </Button>

      {result !== null && <FireResultSummary result={result} href={hrefFor(result)} />}
    </div>
  )
}
