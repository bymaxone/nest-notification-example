/**
 * @fileoverview OtpCountdownPill — an expiry pill over `useOtpCountdown`.
 *
 * Wraps the library's `useOtpCountdown` hook to render the remaining time as a
 * design-system badge (`MM:SS`), switching to an "Expired" state at zero. When no
 * OTP is active (`expiresAt` is `null`) nothing is rendered. State only — the hook
 * performs no network I/O.
 *
 * @module components/otp/otp-countdown-pill
 */

'use client'

import {
  useOtpCountdown,
  type UseOtpCountdownOptions,
  type UseOtpCountdownState,
} from '@bymax-one/nest-notification/react'

import { Badge } from '@/components/ui/badge'

/** Props for {@link OtpCountdownPill}. */
export interface OtpCountdownPillProps {
  /** Expiry as a Unix epoch (ms), or `null` when no OTP is active. */
  expiresAt: number | null
  /** Invoked once when the countdown first reaches zero. */
  onExpired?: () => void
}

/**
 * An expiry countdown pill for the active OTP.
 *
 * @param props - {@link OtpCountdownPillProps}.
 * @returns The countdown badge, or `null` when no OTP is active.
 */
export function OtpCountdownPill({ expiresAt, onExpired }: OtpCountdownPillProps) {
  const options: UseOtpCountdownOptions = {
    expiresAt,
    ...(onExpired !== undefined ? { onExpired } : {}),
  }
  const countdown: UseOtpCountdownState = useOtpCountdown(options)

  if (expiresAt === null) return null

  return (
    <Badge
      variant={countdown.expired ? 'destructive' : 'outline'}
      className="font-mono tabular-nums"
      aria-live="polite"
    >
      {countdown.expired ? 'Expired' : `Expires in ${countdown.formatted}`}
    </Badge>
  )
}
