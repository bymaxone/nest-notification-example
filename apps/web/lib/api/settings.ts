/**
 * @fileoverview Settings client — composes the config-status surface.
 *
 * `getSettingsStatus` reads `GET /channels` + `GET /config/status` and reshapes
 * them into the Settings view: the enabled channels, the wired provider/storage/
 * renderer, the boot-frozen `consumeOnVerify` / `swallowErrors` flags (rendered
 * read-only — they resolve once at boot), and the recipient-mask mode. It never
 * mutates anything — Settings is a read-only introspection surface.
 *
 * @module lib/api/settings
 */

import { getChannels, getConfigStatus } from './providers'

/** Whether the audit log persists a masked or a raw recipient. */
export type MaskRecipientMode = 'masked' | 'raw'

/** The reshaped Settings status surface. */
export interface SettingsStatus {
  /** Enabled channels (e.g. `['email', 'otp']`). */
  channels: string[]
  /** Active email provider adapter. */
  provider: string
  /** Active OTP storage adapter. */
  storage: string
  /** Active template renderer. */
  renderer: string
  /** Boot-frozen: whether a verified OTP is consumed automatically. */
  consumeOnVerify: boolean
  /** Boot-frozen: whether audit-write failures are swallowed. */
  swallowErrors: boolean
  /** Whether the audit log stores a masked or a raw recipient. */
  maskRecipientMode: MaskRecipientMode
  /** The default template locale. */
  defaultLocale: string
}

/**
 * Read and reshape the resolved-config snapshot for the Settings page.
 *
 * @param tenantId - The active tenant sent as `x-tenant-id`.
 * @returns The composed Settings status.
 */
export async function getSettingsStatus(tenantId: string): Promise<SettingsStatus> {
  const [channels, config] = await Promise.all([getChannels(tenantId), getConfigStatus(tenantId)])
  return {
    channels,
    provider: config.provider,
    storage: config.storage,
    renderer: config.renderer,
    consumeOnVerify: config.consumeOnVerify,
    swallowErrors: config.swallowErrors,
    maskRecipientMode: config.maskRecipient ? 'masked' : 'raw',
    defaultLocale: config.defaultLocale,
  }
}
