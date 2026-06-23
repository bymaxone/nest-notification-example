/**
 * @fileoverview MJML `IEmailTemplateRenderer` adapter (showcase).
 * @layer infrastructure
 *
 * Uses MJML for responsive layout while keeping variable interpolation safe. MJML
 * compiles *layout*, not data, and does NOT escape interpolated variables — so this
 * adapter splits the concerns: it compiles each MJML body to responsive HTML once in
 * the constructor (placeholders such as `{{name}}` survive into the HTML), then runs
 * an HTML-escaping `{{var}}` substitution at render time. The subject/text are plain
 * text and are interpolated without escaping (they are not HTML contexts).
 *
 * Security: never feed raw user data into the MJML string without the post-compile
 * escaping pass — that would reopen a stored-XSS vector. The compile uses the `soft`
 * validation level so a malformed template surfaces a structured error this adapter
 * rethrows at construction, rather than MJML throwing an unstructured one.
 *
 * @module
 */
import mjml2html from 'mjml'
import type { IEmailTemplateRenderer, RenderedEmail } from '@bymax-one/nest-notification'

/** A raw MJML template source: subject + mjml markup (+ optional text). */
export interface MjmlRawTemplate {
  subject: string
  mjml: string
  text?: string
}

/** A compiled template — MJML already lowered to HTML, placeholders intact. */
interface CompiledTemplate {
  subject: string
  html: string
  text?: string
}

/** Matches a `{{ var }}` placeholder, capturing the variable name. */
const TEMPLATE_VAR = /\{\{\s*(\w+)\s*\}\}/g

/**
 * Escapes the five HTML-significant characters.
 *
 * @param value - The raw value to escape.
 * @returns The HTML-safe value.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Coerces an interpolation value to a string without ever emitting `[object Object]`:
 * nullish values render empty, objects are JSON-serialized, primitives stringify.
 *
 * @param value - The raw value from the render data.
 * @returns The string form to interpolate.
 */
function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    // Positively narrowed to a scalar, so this never yields `[object Object]`.
    return String(value)
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  // `null`, `undefined`, `symbol`, and `function` have no email rendering.
  return ''
}

/**
 * Substitutes every `{{var}}` placeholder from `data`, escaping when `escape` is set.
 *
 * @param source - The string carrying placeholders.
 * @param data - Variables to interpolate.
 * @param escape - Whether to HTML-escape each interpolated value.
 * @returns The interpolated string.
 */
function fill(source: string, data: Record<string, unknown>, escape: boolean): string {
  return source.replace(TEMPLATE_VAR, (_match, name: string) => {
    const raw = stringify(data[name])
    return escape ? escapeHtml(raw) : raw
  })
}

/**
 * Renders email templates with MJML layout + escaped `{{var}}` interpolation. Keys
 * follow the library convention `${templateName}::${locale}`.
 */
export class MjmlTemplateRenderer implements IEmailTemplateRenderer {
  /** Renderer name surfaced in diagnostics. */
  readonly name = 'mjml'

  /** Compiled HTML keyed by `${templateName}::${locale}`. */
  private readonly compiled = new Map<string, CompiledTemplate>()

  /**
   * @param templates - Raw MJML templates keyed by `${templateName}::${locale}`.
   * @throws Error When a template's MJML is invalid.
   */
  constructor(templates: Record<string, MjmlRawTemplate>) {
    for (const [key, template] of Object.entries(templates)) {
      const { html, errors } = mjml2html(template.mjml, { validationLevel: 'soft' })
      const firstError = errors[0]
      if (firstError) {
        throw new Error(`Invalid MJML for "${key}": ${firstError.message}`)
      }
      this.compiled.set(key, {
        subject: template.subject,
        html,
        ...(template.text !== undefined ? { text: template.text } : {}),
      })
    }
  }

  /**
   * Whether a template is registered for the exact name + locale.
   *
   * @param templateName - Template name.
   * @param locale - Requested locale.
   * @returns `true` when the `${name}::${locale}` key exists.
   */
  hasTemplate(templateName: string, locale: string): Promise<boolean> {
    return Promise.resolve(this.compiled.has(`${templateName}::${locale}`))
  }

  /**
   * Renders a template, escaping the html body only, falling back to `en`.
   *
   * @param templateName - Template name.
   * @param data - Variables to interpolate.
   * @param locale - Requested locale.
   * @returns The rendered subject + html (+ text when the template has one).
   */
  render(
    templateName: string,
    data: Record<string, unknown>,
    locale: string,
  ): Promise<RenderedEmail> {
    const template =
      this.compiled.get(`${templateName}::${locale}`) ?? this.compiled.get(`${templateName}::en`)
    if (!template) {
      return Promise.reject(new Error(`Template not found: ${templateName} (locale=${locale})`))
    }
    return Promise.resolve({
      subject: fill(template.subject, data, false),
      html: fill(template.html, data, true),
      ...(template.text !== undefined ? { text: fill(template.text, data, false) } : {}),
    })
  }
}
