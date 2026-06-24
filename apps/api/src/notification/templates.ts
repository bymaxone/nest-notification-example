/**
 * @fileoverview Canonical email template registry for the default renderer.
 * @layer infrastructure
 *
 * Registers the app's email copy keyed by `${name}::${locale}`, using the library's
 * `CANONICAL_EMAIL_TEMPLATES` constants for the names so the wire names stay stable
 * across the providers/templates and never drift to a free-text string. Each entry is
 * a `{ subject, html, text }` triple with `{{var}}` placeholders that the
 * `DefaultTemplateRenderer` interpolates — HTML-escaping the html body only.
 *
 * Security: a template NEVER embeds a literal OTP code; `{{code}}` is a placeholder
 * filled at render time from the (never-logged) store.
 *
 * @module
 */
import { CANONICAL_EMAIL_TEMPLATES, type TemplateDefinition } from '@bymax-one/nest-notification'

/**
 * The registered email templates, keyed by `${templateName}::${locale}`.
 *
 * Only the `en` locale is shipped here; the renderer falls back to `en` for any other
 * requested locale, which the registry deliberately relies on.
 */
export const TEMPLATES: Record<string, TemplateDefinition> = {
  [`${CANONICAL_EMAIL_TEMPLATES.OTP_CODE}::en`]: {
    subject: 'Your {{appName}} verification code',
    html: '<p>Hi {{name}}, your verification code is <strong>{{code}}</strong>. It expires in {{expiresInMinutes}} minutes.</p>',
    text: 'Hi {{name}}, your verification code is {{code}}. It expires in {{expiresInMinutes}} minutes.',
  },
  [`${CANONICAL_EMAIL_TEMPLATES.OTP_PASSWORD_RESET}::en`]: {
    subject: 'Reset your {{appName}} password',
    html: '<p>Hi {{name}}, use code <strong>{{code}}</strong> to reset your password. It expires in {{expiresInMinutes}} minutes.</p>',
    text: 'Hi {{name}}, use code {{code}} to reset your password. It expires in {{expiresInMinutes}} minutes.',
  },
  [`${CANONICAL_EMAIL_TEMPLATES.WELCOME}::en`]: {
    subject: 'Welcome to {{appName}}',
    html: '<p>Hi {{name}}, welcome to {{appName}}! Get started at <a href="{{appUrl}}">{{appUrl}}</a>.</p>',
    text: 'Hi {{name}}, welcome to {{appName}}! Get started at {{appUrl}}.',
  },
  [`${CANONICAL_EMAIL_TEMPLATES.MFA_ENABLED}::en`]: {
    subject: 'Two-factor authentication enabled on your {{appName}} account',
    html: '<p>Two-factor authentication (MFA) has been enabled on your {{appName}} account. If you did not make this change, contact support immediately.</p>',
    text: 'Two-factor authentication (MFA) has been enabled on your {{appName}} account. If you did not make this change, contact support immediately.',
  },
  [`${CANONICAL_EMAIL_TEMPLATES.MFA_DISABLED}::en`]: {
    subject: 'Two-factor authentication disabled on your {{appName}} account',
    html: '<p>Two-factor authentication (MFA) has been disabled on your {{appName}} account. If you did not make this change, secure your account immediately.</p>',
    text: 'Two-factor authentication (MFA) has been disabled on your {{appName}} account. If you did not make this change, secure your account immediately.',
  },
  [`${CANONICAL_EMAIL_TEMPLATES.NEW_LOGIN_ALERT}::en`]: {
    subject: 'New sign-in detected on your {{appName}} account',
    html: '<p>A new sign-in was detected on your {{appName}} account.<br>Device: {{device}}<br>IP: {{ip}}<br>Session: {{sessionHash}}<br>If this was not you, secure your account immediately.</p>',
    text: 'A new sign-in was detected on your {{appName}} account. Device: {{device}} | IP: {{ip}} | Session: {{sessionHash}}. If this was not you, secure your account immediately.',
  },
  // Template for link-based (token) password reset — no canonical constant; named explicitly.
  ['password_reset_link::en']: {
    subject: 'Reset your {{appName}} password',
    html: '<p>Click the link below to reset your {{appName}} password. The link expires in 15 minutes.<br><a href="{{resetUrl}}">{{resetUrl}}</a></p>',
    text: 'Reset your {{appName}} password by visiting: {{resetUrl}}  The link expires in 15 minutes.',
  },
  // Template for tenant invitations — no canonical constant; named explicitly.
  ['invitation::en']: {
    subject: 'You have been invited to join {{tenantName}} on {{appName}}',
    html: '<p>{{inviterName}} has invited you to join <strong>{{tenantName}}</strong> on {{appName}}.<br>Accept the invitation before {{expiresAt}}: <a href="{{acceptUrl}}">{{acceptUrl}}</a></p>',
    text: '{{inviterName}} has invited you to join {{tenantName}} on {{appName}}. Accept before {{expiresAt}}: {{acceptUrl}}',
  },
}
