/**
 * @fileoverview Accessible severity metadata for each notification channel.
 *
 * Provides a `{ color, icon, label }` descriptor per channel so the Audit
 * Explorer and Overview charts can render colour-coded, accessible indicators
 * without embedding styling inside data components. Imports only the
 * isomorphic `@bymax-one/nest-notification/shared` subpath — safe in the
 * browser bundle.
 *
 * There is no runtime channel array on `./shared`, so the local `CHANNELS`
 * constant is the authoritative value list; a `satisfies` guard pins it to the
 * imported `NotificationChannel` union at compile time.
 *
 * @module lib/severity
 */

import { type LucideIcon, Mail, KeyRound, MessageSquare, Bell } from 'lucide-react'
// Import the channel union type-only from the isomorphic subpath — never the server root.
import type { NotificationChannel } from '@bymax-one/nest-notification/shared'

/** Authoritative local channel list, pinned to the shared union. */
const CHANNELS = ['email', 'otp', 'sms', 'push'] as const satisfies readonly NotificationChannel[]

/** Visual descriptor for a notification channel. */
export interface SeverityMeta {
  /** CSS hex colour token for the channel badge / chart slice / left-border. */
  color: string
  /** Leading Lucide icon (accessibility: never colour alone). */
  icon: LucideIcon
  /** Human label for the channel pill. */
  label: string
}

/** Channel → accessible visual descriptor (colour + icon + label). */
export const CHANNEL_SEVERITY = {
  email: { color: '#60a5fa', icon: Mail, label: 'Email' },
  otp: { color: '#ff6224', icon: KeyRound, label: 'OTP' },
  sms: { color: '#22c55e', icon: MessageSquare, label: 'SMS' },
  push: { color: '#a855f7', icon: Bell, label: 'Push' },
} satisfies Record<NotificationChannel, SeverityMeta>

/** All channels with their metadata, ordered for consistent rendering. */
export const ALL_CHANNELS: readonly NotificationChannel[] = CHANNELS

/**
 * Returns the accessible severity descriptor for a notification channel.
 *
 * @param channel - A notification channel from `NotificationChannel`.
 * @returns The `{ color, icon, label }` descriptor.
 */
export function getSeverityForChannel(channel: NotificationChannel): SeverityMeta {
  return CHANNEL_SEVERITY[channel]
}
