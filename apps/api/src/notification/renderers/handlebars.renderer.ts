/**
 * @fileoverview Handlebars `IEmailTemplateRenderer` adapter (showcase).
 * @layer infrastructure
 *
 * An alternate renderer for copy that needs conditionals (`{{#if}}`), iteration
 * (`{{#each}}`), partials, or helpers the bundled `DefaultTemplateRenderer` does not
 * support. Each template is compiled once in the constructor (Handlebars caches the
 * delegate) and the requested locale resolves with a hard fallback to `en`, matching
 * the library's `${templateName}::${locale}` keying convention.
 *
 * Security: every template here — subject, html, AND text — is compiled with the
 * standard Handlebars compiler, which HTML-escapes `{{var}}` interpolations by
 * default; only the raw triple-stache `{{{var}}}` bypasses that escaping. Escaping
 * all outputs by default is the safe choice and is intentionally left unchanged, so
 * prefer `{{var}}` over `{{{var}}}` and never disable escaping with `noEscape`.
 *
 * @module
 */
import Handlebars from 'handlebars'
import type { IEmailTemplateRenderer, RenderedEmail } from '@bymax-one/nest-notification'

/** A raw Handlebars template source: subject + html (+ optional text). */
export interface HandlebarsRawTemplate {
  subject: string
  html: string
  text?: string
}

/** A compiled template — each field is a cached Handlebars delegate. */
interface CompiledTemplate {
  subject: HandlebarsTemplateDelegate
  html: HandlebarsTemplateDelegate
  text?: HandlebarsTemplateDelegate
}

/**
 * Renders email templates with Handlebars. Keys follow the library convention
 * `${templateName}::${locale}` (e.g. `welcome::pt-BR`).
 */
export class HandlebarsTemplateRenderer implements IEmailTemplateRenderer {
  /** Renderer name surfaced in diagnostics. */
  readonly name = 'handlebars'

  /** Compiled delegates keyed by `${templateName}::${locale}`. */
  private readonly compiled = new Map<string, CompiledTemplate>()

  /**
   * @param templates - Raw templates keyed by `${templateName}::${locale}`.
   */
  constructor(templates: Record<string, HandlebarsRawTemplate>) {
    for (const [key, template] of Object.entries(templates)) {
      this.compiled.set(key, {
        subject: Handlebars.compile(template.subject),
        html: Handlebars.compile(template.html),
        ...(template.text !== undefined ? { text: Handlebars.compile(template.text) } : {}),
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
   * Renders a template, falling back to the `en` locale.
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
      subject: template.subject(data),
      html: template.html(data),
      ...(template.text !== undefined ? { text: template.text(data) } : {}),
    })
  }
}
