/**
 * Unit tests for {@link resolveEmailProvider}.
 *
 * `nodemailer` is mocked so constructing the Nodemailer branch opens no socket.
 * Proves the opt-in ladder across the three env permutations: `RESEND_API_KEY` →
 * Resend, `SMTP_URL` (no Resend) → Nodemailer→Mailpit, neither → `NoOpEmailProvider`.
 */
import { describe, expect, it, jest } from '@jest/globals'
import type { ConfigService } from '@nestjs/config'

jest.unstable_mockModule('nodemailer', () => ({ createTransport: jest.fn(() => ({})) }))

const { resolveEmailProvider } = await import('./email-provider.resolver.js')

/** Build a minimal `ConfigService` whose `get(key)` reads from a plain record. */
function fakeConfig(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string): string | undefined => env[key] } as unknown as ConfigService
}

describe('resolveEmailProvider', () => {
  it('selects Resend when RESEND_API_KEY is set', () => {
    /** A Resend key takes priority over any SMTP configuration. */
    const provider = resolveEmailProvider(fakeConfig({ RESEND_API_KEY: 're_test', SMTP_URL: 'smtp://x' }))

    expect(provider.name).toBe('resend')
  })

  it('selects Nodemailer when only SMTP_URL is set', () => {
    /** Without a Resend key, the custom Nodemailer→Mailpit provider is chosen. */
    const provider = resolveEmailProvider(fakeConfig({ SMTP_URL: 'smtp://localhost:1025' }))

    expect(provider.name).toBe('nodemailer')
  })

  it('falls back to the NoOp provider when neither is set', () => {
    /** With no email transport configured, the bundled no-op provider is the floor. */
    const provider = resolveEmailProvider(fakeConfig({}))

    expect(provider.name).toBe('noop')
  })
})
