/**
 * Unit tests for the {@link TEMPLATES} registry via the bundled DefaultTemplateRenderer.
 *
 * Proves the stored-XSS guard and the locale fallback the registry relies on:
 * interpolated values are HTML-escaped in the **html** body only (raw in subject and
 * text), and a non-`en` locale falls back to the `en` template.
 */
import { describe, expect, it } from '@jest/globals'
import { CANONICAL_EMAIL_TEMPLATES, DefaultTemplateRenderer } from '@bymax-one/nest-notification'

import { TEMPLATES } from './templates.js'

/** A renderer over the app's real template registry. */
const renderer = new DefaultTemplateRenderer({ templates: TEMPLATES })

describe('TEMPLATES registry', () => {
  it('registers the canonical template names', () => {
    /** The registry keys must use the canonical names so the wire names stay stable. */
    expect(TEMPLATES).toHaveProperty(`${CANONICAL_EMAIL_TEMPLATES.OTP_CODE}::en`)
    expect(TEMPLATES).toHaveProperty(`${CANONICAL_EMAIL_TEMPLATES.OTP_PASSWORD_RESET}::en`)
    expect(TEMPLATES).toHaveProperty(`${CANONICAL_EMAIL_TEMPLATES.WELCOME}::en`)
  })

  it.each([
    [
      `${CANONICAL_EMAIL_TEMPLATES.OTP_CODE}::en`,
      'verification code',
      'verification code is',
      'verification code is',
    ],
    [
      `${CANONICAL_EMAIL_TEMPLATES.OTP_PASSWORD_RESET}::en`,
      'Reset your',
      'reset your password',
      'reset your password',
    ],
    [`${CANONICAL_EMAIL_TEMPLATES.WELCOME}::en`, 'Welcome to', 'welcome to', 'welcome to'],
    [
      `${CANONICAL_EMAIL_TEMPLATES.MFA_ENABLED}::en`,
      'enabled',
      'has been enabled',
      'has been enabled',
    ],
    [
      `${CANONICAL_EMAIL_TEMPLATES.MFA_DISABLED}::en`,
      'disabled',
      'has been disabled',
      'has been disabled',
    ],
    [
      `${CANONICAL_EMAIL_TEMPLATES.NEW_LOGIN_ALERT}::en`,
      'New sign-in',
      'new sign-in was detected',
      'new sign-in was detected',
    ],
    ['password_reset_link::en', 'Reset your', 'Click the link', 'by visiting'],
    ['invitation::en', 'invited to join', 'has invited you to join', 'has invited you to join'],
  ])('carries the expected subject/html/text copy for %s', (key, subject, html, text) => {
    /**
     * Scenario: every registered template's three bodies.
     * Contract: each `subject`/`html`/`text` carries its distinctive, non-empty copy — pinning the
     * literal content so a silently-blanked field (e.g. a missing subject or escaped-away body) is
     * caught rather than shipped as an empty email.
     */
    const entry = TEMPLATES[key]
    expect(entry).toBeDefined()
    expect(entry?.subject).toContain(subject)
    expect(entry?.html).toContain(html)
    expect(entry?.text).toContain(text)
  })

  it('escapes interpolated values in the html body only', async () => {
    /**
     * The html body is an HTML context (escape), the subject and text are not (raw):
     * a `<script>` payload and an `&` prove the asymmetric escaping the renderer applies.
     */
    const rendered = await renderer.render(
      'welcome',
      { name: '<script>alert(1)</script>', appName: 'Acme & Co', appUrl: 'http://x' },
      'en',
    )

    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(rendered.html).not.toContain('<script>')
    expect(rendered.html).toContain('Acme &amp; Co')
    expect(rendered.subject).toBe('Welcome to Acme & Co')
    expect(rendered.text).toContain('<script>alert(1)</script>')
    expect(rendered.text).toContain('Acme & Co')
  })

  it('falls back to the en template for an unregistered locale', async () => {
    /** Only `en` is registered, so a `pt-BR` request resolves the `en` welcome copy. */
    const rendered = await renderer.render(
      'welcome',
      { name: 'Jane', appName: 'Bymax', appUrl: 'http://x' },
      'pt-BR',
    )

    expect(rendered.subject).toBe('Welcome to Bymax')
    expect(await renderer.hasTemplate('welcome', 'pt-BR')).toBe(false)
  })
})
