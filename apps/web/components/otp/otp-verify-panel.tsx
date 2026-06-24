/**
 * @fileoverview OtpVerifyPanel — the end-to-end OTP verify UX.
 *
 * Ties the segmented box + countdown pill to a REAL verify against the backend:
 * a purpose selector (driven by the app-local purpose map, NOT `DEFAULT_TTLS`),
 * a generate action, a cooldown-gated resend, `remainingAttempts` on a wrong
 * code, and every surfaced `OTP_*` error localized from `./shared`. The library
 * hooks are state/UX only — issuing the request is this panel's job. The code
 * lives solely in box state and the verify request body; it is never rendered,
 * logged, or placed in a URL/`nuqs` param.
 *
 * @module components/otp/otp-verify-panel
 */

'use client'

import { useState } from 'react'
import { useOtpCountdown } from '@bymax-one/nest-notification/react'
import { NOTIFICATION_ERROR_CODES } from '@bymax-one/nest-notification/shared'
import { CheckCircle2, KeyRound, Loader2, RefreshCw } from 'lucide-react'

import {
  consumeOtp,
  generateOtp,
  resendOtp,
  verifyOtp,
  type OtpGenerateData,
  type OtpVerifyOutcome,
} from '@/lib/api/otp'
import type { ApiResult } from '@/lib/api/http'
import { formatCooldown } from '@/lib/cooldown'
import { localizeNotificationError } from '@/lib/error-codes'
import { useNotificationQuery } from '@/lib/filters'
import { DEFAULT_OTP_PURPOSE, getOtpPurposeConfig, OTP_PURPOSES } from '@/lib/otp-purposes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OtpCountdownPill } from './otp-countdown-pill'
import { OtpInputBox } from './otp-input-box'

/** The demo recipient an OTP is issued to (a valid, non-PII address). */
const DEMO_RECIPIENT = 'demo@example.com'

/** The active OTP's expiry + cooldown timestamps. */
interface OtpSession {
  /** Expiry epoch (ms) — drives the countdown pill. */
  expiresAt: number
  /** Cooldown end epoch (ms) — gates the resend button. */
  cooldownUntil: number
}

/** The verify/feedback state shown beneath the box. */
type Feedback =
  | { kind: 'idle' }
  | { kind: 'success' }
  | { kind: 'expired' }
  | { kind: 'message'; text: string; remainingAttempts: number | null; terminal: boolean }

/** Normalize a generate/resend call to an issue outcome (never throws). */
async function issueOtp(
  call: Promise<ApiResult<OtpGenerateData>>,
): Promise<
  | { ok: true; data: OtpGenerateData }
  | { ok: false; code: string; retryAfterSeconds: number | null }
> {
  try {
    const result = await call
    return result.ok
      ? { ok: true, data: result.data }
      : { ok: false, code: result.code, retryAfterSeconds: result.retryAfterSeconds }
  } catch {
    return { ok: false, code: '', retryAfterSeconds: null }
  }
}

/** Whether a verify error code is terminal (the current code is dead). */
function isTerminalCode(code: string): boolean {
  return (
    code === NOTIFICATION_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED ||
    code === NOTIFICATION_ERROR_CODES.OTP_NOT_FOUND
  )
}

/** Reactive controller for the OTP verify flow. */
interface OtpController {
  recipient: string
  setRecipient: (value: string) => void
  purposeKey: string
  selectPurpose: (value: string) => void
  session: OtpSession | null
  cooldownRemaining: number
  resetToken: number
  busy: boolean
  feedback: Feedback
  generate: () => Promise<void>
  resend: () => Promise<void>
  verify: (code: string) => Promise<void>
  consume: () => Promise<void>
  expire: () => void
}

/**
 * Holds every piece of OTP-flow state and the action handlers.
 *
 * @param tenantId - The active tenant (trusted `x-tenant-id`).
 * @returns The reactive controller consumed by the panel.
 */
function useOtpController(tenantId: string): OtpController {
  const [recipient, setRecipient] = useState(DEMO_RECIPIENT)
  const [purposeKey, setPurposeKey] = useState<string>(DEFAULT_OTP_PURPOSE.purpose)
  const [session, setSession] = useState<OtpSession | null>(null)
  const [resetToken, setResetToken] = useState(0)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' })
  const purpose = getOtpPurposeConfig(purposeKey).purpose
  const cooldown = useOtpCountdown({ expiresAt: session?.cooldownUntil ?? null })

  const clear = (next: Feedback): void => {
    setSession(null)
    setFeedback(next)
    setResetToken((token) => token + 1)
  }

  const selectPurpose = (value: string): void => {
    setPurposeKey(value)
    clear({ kind: 'idle' })
  }

  const issue = async (call: Promise<ApiResult<OtpGenerateData>>): Promise<void> => {
    setBusy(true)
    const outcome = await issueOtp(call)
    if (outcome.ok) {
      setSession({
        expiresAt: outcome.data.expiresAt,
        cooldownUntil: Date.now() + outcome.data.cooldownSeconds * 1000,
      })
      setFeedback({ kind: 'idle' })
      setResetToken((token) => token + 1)
    } else {
      setFeedback({
        kind: 'message',
        text: localizeNotificationError(outcome.code),
        remainingAttempts: null,
        terminal: false,
      })
    }
    setBusy(false)
  }

  const failWith = (code: string, remainingAttempts: number | null, terminal: boolean): void => {
    setFeedback({
      kind: 'message',
      text: localizeNotificationError(code),
      remainingAttempts,
      terminal,
    })
    setResetToken((token) => token + 1)
  }

  const verify = async (code: string): Promise<void> => {
    let outcome: OtpVerifyOutcome
    try {
      outcome = await verifyOtp({ tenantId, recipient, purpose, code })
    } catch {
      failWith('', null, false)
      return
    }
    if (outcome.ok) {
      setFeedback({ kind: 'success' })
      return
    }
    failWith(outcome.code, outcome.remainingAttempts, isTerminalCode(outcome.code))
  }

  const consume = async (): Promise<void> => {
    try {
      await consumeOtp({ tenantId, recipient, purpose })
      clear({ kind: 'idle' })
    } catch {
      failWith('', null, false)
    }
  }

  return {
    recipient,
    setRecipient,
    purposeKey,
    selectPurpose,
    session,
    cooldownRemaining: cooldown.remainingSeconds,
    resetToken,
    busy,
    feedback,
    generate: () => issue(generateOtp({ tenantId, recipient, purpose, deliverVia: 'email' })),
    resend: () => issue(resendOtp({ tenantId, recipient, purpose, deliverVia: 'email' })),
    verify,
    consume,
    expire: () => setFeedback({ kind: 'expired' }),
  }
}

/** Recipient + purpose + generate row. */
function OtpComposer({ controller }: { controller: OtpController }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="otp-recipient">Recipient</Label>
        <Input
          id="otp-recipient"
          type="email"
          value={controller.recipient}
          onChange={(event) => controller.setRecipient(event.target.value)}
          disabled={controller.busy}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="otp-purpose">Purpose</Label>
        <Select value={controller.purposeKey} onValueChange={controller.selectPurpose}>
          <SelectTrigger id="otp-purpose" className="w-56" aria-label="Purpose">
            <SelectValue placeholder="Purpose" />
          </SelectTrigger>
          <SelectContent>
            {OTP_PURPOSES.map((config) => (
              <SelectItem key={config.purpose} value={config.purpose}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" onClick={() => void controller.generate()} disabled={controller.busy}>
        {controller.busy ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <KeyRound aria-hidden className="h-4 w-4" />
        )}
        Generate
      </Button>
    </div>
  )
}

/** The localized feedback line beneath the box. */
function OtpFeedback({ feedback }: { feedback: Feedback }) {
  if (feedback.kind === 'idle') return null
  if (feedback.kind === 'success') {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-400" role="status">
        <CheckCircle2 aria-hidden className="h-4 w-4" /> Code verified.
      </p>
    )
  }
  if (feedback.kind === 'expired') {
    return (
      <p className="text-sm text-amber-400" role="status">
        {localizeNotificationError(NOTIFICATION_ERROR_CODES.OTP_EXPIRED)}
      </p>
    )
  }
  return (
    <p className="text-sm text-amber-400" role="status">
      {feedback.text}
      {feedback.remainingAttempts !== null && (
        <span className="ml-2 text-white/55">{feedback.remainingAttempts} attempt(s) left</span>
      )}
    </p>
  )
}

/** The challenge area shown once an OTP is active: pill + box + resend + feedback. */
function OtpChallenge({ controller }: { controller: OtpController }) {
  const { session, feedback } = controller
  if (session === null) {
    return <OtpFeedback feedback={feedback} />
  }
  const config = getOtpPurposeConfig(controller.purposeKey)
  const terminal =
    feedback.kind === 'success' ||
    feedback.kind === 'expired' ||
    (feedback.kind === 'message' && feedback.terminal)
  const resendDisabled = controller.busy || controller.cooldownRemaining > 0
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-(--glass-border) bg-(--glass-bg) p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-white/55">Enter the code</span>
        <OtpCountdownPill expiresAt={session.expiresAt} onExpired={controller.expire} />
      </div>
      <OtpInputBox
        length={config.length}
        type={config.type}
        onComplete={(code) => void controller.verify(code)}
        disabled={terminal}
        resetToken={controller.resetToken}
      />
      <div className="flex items-center justify-between gap-3">
        <OtpFeedback feedback={feedback} />
        {feedback.kind === 'success' ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void controller.consume()}
          >
            Consume
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void controller.resend()}
            disabled={resendDisabled}
          >
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            {controller.cooldownRemaining > 0
              ? `Resend in ${formatCooldown(controller.cooldownRemaining)}`
              : 'Resend'}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * The OTP Verify panel — segmented box + countdown driving a real verify.
 *
 * @returns The composed OTP verify surface.
 */
export function OtpVerifyPanel() {
  const { tenantId } = useNotificationQuery()
  const controller = useOtpController(tenantId)
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">OTP Verify</h1>
        <p className="text-sm text-white/55">
          Generate a code, then enter it below. The library hooks manage input + countdown; this
          panel verifies against the backend.{' '}
          <Badge variant="outline">codes never leave the box</Badge>
        </p>
      </header>
      <OtpComposer controller={controller} />
      <OtpChallenge controller={controller} />
    </section>
  )
}
