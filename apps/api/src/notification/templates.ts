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
}
