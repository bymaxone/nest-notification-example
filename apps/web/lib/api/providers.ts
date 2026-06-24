/**
 * @fileoverview Providers & Templates client + email-preview renderer.
 *
 * `getChannels` / `getConfigStatus` read the live adapter wiring (`GET /channels`
 * + `GET /config/status`) that the provider matrix renders. `renderEmailPreview`
 * is a pure, client-side renderer that mirrors the library's
 * "HTML-escape the html body only" contract: a variable injected into the html
 * body is escaped, while the subject and text bodies stay raw. It renders locally
 * (the backend's `send-template` returns only a `messageId`, never the rendered
 * bodies) so the escape can be PROVEN without a server round-trip — and it never
 * builds an HTML-injection sink.
 *
 * @module lib/api/providers
 */

import { getJson } from './http'

/** Read-only view of the resolved module config (`GET /config/status`). */
export interface NotificationConfigStatus {
  /** Enabled channels (e.g. `['email', 'otp']`). */
  channels: string[]
  /** Active email provider adapter name. */
  provider: string
  /** Active OTP storage adapter name. */
  storage: string
  /** Active template renderer name. */
  renderer: string
  /** Whether a verified OTP is consumed automatically (boot-frozen). */
  consumeOnVerify: boolean
  /** Whether audit failures are swallowed (boot-frozen). */
  swallowErrors: boolean
  /** Whether a non-identity recipient masker is active. */
  maskRecipient: boolean
  /** The default template locale. */
  defaultLocale: string
}

/**
 * Fetch the resolved module config snapshot.
 *
 * @param tenantId - The active tenant sent as `x-tenant-id`.
 * @returns The config-status payload.
 */
export function getConfigStatus(tenantId: string): Promise<NotificationConfigStatus> {
  return getJson<NotificationConfigStatus>('/config/status', tenantId)
}

/**
 * Fetch the enabled channel names.
 *
 * @param tenantId - The active tenant sent as `x-tenant-id`.
 * @returns The enabled channels (e.g. `['email', 'otp']`).
 */
export function getChannels(tenantId: string): Promise<string[]> {
  return getJson<string[]>('/channels', tenantId)
}

/** A selectable renderer the showcase lists (only one is wired at a time). */
export type EmailRendererName = 'Default' | 'Handlebars' | 'MJML' | 'React Email'

/** The renderer demos the matrix surfaces. */
export const EMAIL_RENDERERS: readonly EmailRendererName[] = [
  'Default',
  'Handlebars',
  'MJML',
  'React Email',
]

/** A demo template for the preview ({{var}} placeholders, three body sources). */
export interface EmailPreviewTemplate {
  /** Stable template id (and React key). */
  id: string
  /** Human label for the template selector. */
  name: string
  /** Subject line template (NOT an HTML context — variables stay raw). */
  subjectTemplate: string
  /** HTML body template (variables are HTML-escaped on render). */
  htmlTemplate: string
  /** Plain-text body template (NOT an HTML context — variables stay raw). */
  textTemplate: string
}

/** The demo templates the preview can render. */
export const EMAIL_PREVIEW_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome',
    subjectTemplate: 'Welcome, {{name}}!',
    htmlTemplate: '<h1>Welcome, {{name}}</h1><p>Thanks for joining {{appName}}.</p>',
    textTemplate: 'Welcome, {{name}}! Thanks for joining {{appName}}.',
  },
  {
    id: 'new_login_alert',
    name: 'New login alert',
    subjectTemplate: 'New sign-in for {{name}}',
    htmlTemplate:
      '<p>We noticed a new sign-in for <strong>{{name}}</strong> from {{location}}.</p>',
    textTemplate: 'New sign-in for {{name}} from {{location}}.',
  },
] as const satisfies readonly EmailPreviewTemplate[]

/** The template the preview opens with. */
export const DEFAULT_EMAIL_PREVIEW_TEMPLATE: EmailPreviewTemplate = EMAIL_PREVIEW_TEMPLATES[0]

/**
 * Resolve a template id to its definition, falling back to the default.
 *
 * @param id - The template id (e.g. from the preview selector).
 * @returns The matching template, or {@link DEFAULT_EMAIL_PREVIEW_TEMPLATE}.
 */
export function getEmailPreviewTemplate(id: string): EmailPreviewTemplate {
  return EMAIL_PREVIEW_TEMPLATES.find((entry) => entry.id === id) ?? DEFAULT_EMAIL_PREVIEW_TEMPLATE
}

/** Input for {@link renderEmailPreview}. */
export interface RenderEmailPreviewInput {
  /** The template to render. */
  template: EmailPreviewTemplate
  /** The variable values to interpolate. */
  data: Record<string, string>
  /** The locale label shown in the metadata tab. */
  locale: string
  /** The renderer label shown in the metadata tab (one of {@link EMAIL_RENDERERS}). */
  renderer: string
}

/** The rendered preview bodies + metadata. */
export interface RenderedEmailPreview {
  /** The subject (variables raw — not an HTML context). */
  subject: string
  /** The HTML body (variables HTML-escaped — closing the stored-XSS vector). */
  html: string
  /** The plain-text body (variables raw). */
  text: string
  /** Presentation metadata for the metadata tab. */
  metadata: {
    /** The rendered subject. */
    subject: string
    /** The requested locale. */
    locale: string
    /** The template id. */
    templateId: string
    /** The renderer label. */
    renderer: string
  }
}

/**
 * Map one HTML-significant character to its entity. Only the five characters the
 * `escapeHtml` pattern matches reach this function; the default handles `'`.
 *
 * @param char - A single matched character.
 * @returns The corresponding HTML entity.
 */
function escapeChar(char: string): string {
  switch (char) {
    case '&':
      return '&amp;'
    case '<':
      return '&lt;'
    case '>':
      return '&gt;'
    case '"':
      return '&quot;'
    default:
      return '&#39;'
  }
}

/**
 * Escape the HTML-significant characters in a string.
 *
 * @param value - The raw value (e.g. a user-supplied template variable).
 * @returns The value with `& < > " '` replaced by their entities.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, escapeChar)
}

/** Matches a `{{ variable }}` placeholder (optional surrounding whitespace). */
const VARIABLE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g

/**
 * Interpolate `{{var}}` placeholders, escaping each value only when `escape` is set.
 *
 * @param template - The template string.
 * @param data - The variable values (a missing key renders empty).
 * @param escape - Whether to HTML-escape each interpolated value.
 * @returns The interpolated string.
 */
function interpolate(template: string, data: Record<string, string>, escape: boolean): string {
  return template.replace(VARIABLE_PATTERN, (_match, key: string) => {
    const value = data[key] ?? ''
    return escape ? escapeHtml(value) : value
  })
}

/**
 * Render a template preview, escaping the html body only (subject + text stay raw).
 *
 * @param input - The template, data, locale, and renderer label.
 * @returns The rendered bodies + metadata proving the html-only escape.
 */
export function renderEmailPreview(input: RenderEmailPreviewInput): RenderedEmailPreview {
  const { template, data, locale, renderer } = input
  const subject = interpolate(template.subjectTemplate, data, false)
  const html = interpolate(template.htmlTemplate, data, true)
  const text = interpolate(template.textTemplate, data, false)
  return { subject, html, text, metadata: { subject, locale, templateId: template.id, renderer } }
}
