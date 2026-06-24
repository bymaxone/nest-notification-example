/**
 * @fileoverview Unit tests for the Settings status composer.
 *
 * Mocks the providers client to cover the reshape (channels + config → the
 * Settings view) and both recipient-mask branches (masked vs raw).
 *
 * @module lib/api/settings.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSettingsStatus } from './settings'

const providers = {
  getChannels: vi.fn(),
  getConfigStatus: vi.fn(),
}
vi.mock('./providers', () => ({
  getChannels: (...a: unknown[]) => providers.getChannels(...a),
  getConfigStatus: (...a: unknown[]) => providers.getConfigStatus(...a),
}))

const CONFIG = {
  channels: ['email', 'otp'],
  provider: 'Nodemailer',
  storage: 'InMemoryOtpStorage',
  renderer: 'DefaultTemplateRenderer',
  consumeOnVerify: false,
  swallowErrors: true,
  maskRecipient: true,
  defaultLocale: 'en',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('getSettingsStatus', () => {
  /** Composes channels + config into the Settings view (masked mode). */
  it('reshapes the config with a masked recipient mode', async () => {
    providers.getChannels.mockResolvedValue(['email', 'otp'])
    providers.getConfigStatus.mockResolvedValue(CONFIG)
    const result = await getSettingsStatus('acme')
    expect(result).toEqual({
      channels: ['email', 'otp'],
      provider: 'Nodemailer',
      storage: 'InMemoryOtpStorage',
      renderer: 'DefaultTemplateRenderer',
      consumeOnVerify: false,
      swallowErrors: true,
      maskRecipientMode: 'masked',
      defaultLocale: 'en',
    })
    expect(providers.getChannels).toHaveBeenCalledWith('acme')
  })

  /** A disabled masker reports the raw mode. */
  it('reports the raw mode when masking is off', async () => {
    providers.getChannels.mockResolvedValue([])
    providers.getConfigStatus.mockResolvedValue({ ...CONFIG, maskRecipient: false })
    const result = await getSettingsStatus('')
    expect(result.maskRecipientMode).toBe('raw')
  })
})
