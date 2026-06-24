/**
 * @fileoverview TriggerGrid — the fire-every-feature card grid.
 *
 * Declares one descriptor per demonstrable backend feature: title, a
 * "Demonstrates" line, the endpoint badge, the **fire** action, whether a 4xx/5xx
 * is the expected outcome (`isExpectedError`), and an `explorerTarget` that builds
 * the post-fire Explorer deep-link via `explorerHref` (`OVERVIEW.md §10`/§16). The
 * active tenant comes from the single global control (nuqs URL state); the spoof
 * card forges the *other* tenant in the body to prove the resolver override.
 *
 * @module components/trigger/trigger-grid
 */

'use client'

import { useNotificationQuery } from '@/lib/filters'
import { explorerHref, type ExplorerTarget } from '@/lib/explorer-link'
import { triggerApi, type TriggerResult } from '@/lib/trigger-api'
import { TriggerCard } from './trigger-card'

/** Runtime inputs a card passes to its fire action. */
export interface FireContext {
  /** Active tenant id (the trusted header) used by every fire. */
  tenantId: string
}

/** A single Trigger Center card definition. */
export interface TriggerDescriptor {
  /** Stable id (also the React key). */
  id: string
  /** Card title. */
  title: string
  /** One-line "what this proves" description. */
  demonstrates: string
  /** Target route shown as a mono badge (`METHOD /path`). */
  endpoint: string
  /** When `true`, a 4xx/5xx response is the expected outcome (not a failure toast). */
  isExpectedError?: boolean
  /** Fire the demo endpoint with the collected inputs. */
  fire: (ctx: FireContext) => Promise<TriggerResult>
  /** Build the Explorer deep-link target from the fire result. */
  explorerTarget: (result: TriggerResult) => ExplorerTarget
}

/** The fallback active tenant when "All tenants" is selected. */
const DEFAULT_TENANT = 'acme'

/** The other demo tenant — forged in the spoof body. */
function otherTenant(tenantId: string): string {
  return tenantId === 'globex' ? 'acme' : 'globex'
}

/** Build a deep-link target from a fire result (relative window so the new row is in-window). */
function pivot(result: TriggerResult): ExplorerTarget {
  return {
    recipient: result.recipient,
    channel: result.channel,
    range: '15m',
    ...(result.purpose !== null ? { purpose: result.purpose } : {}),
  }
}

/** The trigger descriptors, in journey order (`OVERVIEW.md §16`). */
export const TRIGGERS: TriggerDescriptor[] = [
  {
    id: 'send-email',
    title: 'Send email',
    demonstrates: 'EmailService.send → a masked `sent` audit row',
    endpoint: 'POST /email/send',
    fire: (ctx) => triggerApi.sendEmail(ctx.tenantId),
    explorerTarget: pivot,
  },
  {
    id: 'generate-otp',
    title: 'Generate OTP',
    demonstrates: 'OtpService.generate → a `generated` row, never the code',
    endpoint: 'POST /otp/generate',
    fire: (ctx) => triggerApi.generateOtp(ctx.tenantId),
    explorerTarget: pivot,
  },
  {
    id: 'verify-otp',
    title: 'Verify OTP (wrong code)',
    demonstrates: 'a wrong code → a `failed` verify row (the guessed code is never logged)',
    endpoint: 'POST /otp/verify',
    isExpectedError: true,
    fire: (ctx) => triggerApi.verifyWrong(ctx.tenantId),
    explorerTarget: pivot,
  },
  {
    id: 'cooldown',
    title: 'Trip resend cooldown',
    demonstrates: 'generate then resend → OTP_COOLDOWN_ACTIVE (429)',
    endpoint: 'POST /otp/resend',
    isExpectedError: true,
    fire: (ctx) => triggerApi.tripCooldown(ctx.tenantId),
    explorerTarget: pivot,
  },
  {
    id: 'max-attempts',
    title: 'Force max attempts',
    demonstrates: 'repeated wrong codes → OTP_MAX_ATTEMPTS_EXCEEDED (429)',
    endpoint: 'POST /otp/verify ×N',
    isExpectedError: true,
    fire: (ctx) => triggerApi.forceMaxAttempts(ctx.tenantId),
    explorerTarget: pivot,
  },
  {
    id: 'oversize',
    title: 'Oversize attachment',
    demonstrates: 'an oversize attachment → EMAIL_ATTACHMENTS_TOO_LARGE (413)',
    endpoint: 'POST /email/send-template',
    isExpectedError: true,
    fire: (ctx) => triggerApi.oversizeAttachment(ctx.tenantId),
    explorerTarget: pivot,
  },
  {
    id: 'spoof',
    title: 'Spoof tenant',
    demonstrates: 'a forged body tenantId is overridden by the trusted header in the audit row',
    endpoint: 'POST /dispatch',
    fire: (ctx) =>
      triggerApi.spoofTenant(ctx.tenantId || DEFAULT_TENANT, otherTenant(ctx.tenantId)),
    explorerTarget: pivot,
  },
  {
    id: 'dispatch',
    title: 'Dispatch (façade)',
    demonstrates: 'NotificationService.dispatch → an `__interceptor__` boundary row',
    endpoint: 'POST /dispatch',
    fire: (ctx) => triggerApi.dispatch(ctx.tenantId),
    explorerTarget: pivot,
  },
]

/**
 * The responsive grid of trigger cards, bound to the active tenant.
 *
 * @returns The Trigger Center card grid.
 */
export function TriggerGrid() {
  const { tenantId } = useNotificationQuery()
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {TRIGGERS.map((descriptor) => (
        <TriggerCard
          key={descriptor.id}
          descriptor={descriptor}
          tenantId={tenantId}
          hrefFor={(result) => explorerHref(descriptor.explorerTarget(result))}
        />
      ))}
    </div>
  )
}
