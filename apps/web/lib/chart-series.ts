/**
 * @fileoverview Single source of truth for delivery-health chart series metadata.
 *
 * Each verb series carries colour **+ icon + label** (never colour alone) so a
 * chart and its `<ChartLegend>` read from the same definition and can render
 * accessible indicators. A bounded palette colours the dynamic channel/provider
 * breakdown slices. Stays JSX-free — an `icon` is a component reference, not JSX.
 *
 * @module lib/chart-series
 */

import {
  BadgeCheck,
  KeyRound,
  Send,
  ShieldCheck,
  ShieldX,
  TimerOff,
  type LucideIcon,
} from 'lucide-react'

import type { NotificationVerb } from './types'

/** One chart series: its data key, human label, swatch colour, and accessible icon. */
export interface ChartSeries {
  /** The series key (a verb, or a synthetic line key). */
  key: string
  /** Label shown in the legend and tooltip. */
  label: string
  /** Swatch / stroke / fill colour (hex token). */
  color: string
  /** Leading icon (accessibility: never colour alone). */
  icon: LucideIcon
}

/** Accessible descriptor for every audit verb (colour + icon + label). */
export const VERB_SERIES: Record<NotificationVerb, ChartSeries> = {
  sent: { key: 'sent', label: 'Sent', color: '#22c55e', icon: Send },
  generated: { key: 'generated', label: 'Generated', color: '#60a5fa', icon: KeyRound },
  verified: { key: 'verified', label: 'Verified', color: '#a855f7', icon: ShieldCheck },
  failed: { key: 'failed', label: 'Failed', color: '#ef4444', icon: ShieldX },
  cooldown_blocked: {
    key: 'cooldown_blocked',
    label: 'Cooldown',
    color: '#f59e0b',
    icon: TimerOff,
  },
  max_attempts_exceeded: {
    key: 'max_attempts_exceeded',
    label: 'Max attempts',
    color: '#fb923c',
    icon: BadgeCheck,
  },
}

/** The two series the delivery-rate line plots (sent vs failed). */
export const DELIVERY_SERIES: readonly ChartSeries[] = [VERB_SERIES.sent, VERB_SERIES.failed]

/** Bounded categorical palette for the dynamic channel/provider breakdown slices. */
export const PALETTE: readonly string[] = [
  '#60a5fa',
  '#ff6224',
  '#22c55e',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#eab308',
]

/**
 * Pick a stable palette colour for a slice index (wraps around the palette).
 *
 * @param index - The zero-based slice index.
 * @returns A hex colour token from {@link PALETTE}.
 */
export function colorForIndex(index: number): string {
  return PALETTE[index % PALETTE.length] ?? '#60a5fa'
}
