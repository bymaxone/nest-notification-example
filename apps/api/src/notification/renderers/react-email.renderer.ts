/**
 * @fileoverview React Email `IEmailTemplateRenderer` adapter (showcase).
 * @layer infrastructure
 *
 * Renders email templates authored as type-safe React components through the custom
 * renderer interface. Each entry pairs a `subject` factory with a React `component`;
 * `render(...)` is awaited to produce the HTML, and a second pass with
 * `{ plainText: true }` produces the text body. Keys follow the library convention
 * `${templateName}::${locale}` with a hard fallback to `en`.
 *
 * Security: React escapes interpolated values automatically — `{user.name}` is
 * HTML-safe with no extra work. Never route unsanitized input through
 * `dangerouslySetInnerHTML`; the subject is plain text built by a factory, never a
 * component, so it can never carry markup.
 *
 * @module
 */
import { createElement, type ComponentType } from 'react'
import { render } from '@react-email/render'
import type { IEmailTemplateRenderer, RenderedEmail } from '@bymax-one/nest-notification'

/** A React Email template: a subject factory + a component rendered to html/text. */
export interface ReactEmailTemplate {
  subject: (data: Record<string, unknown>) => string
  component: ComponentType<Record<string, unknown>>
}

/**
 * Renders email templates from React Email components. Keys follow the library
 * convention `${templateName}::${locale}`.
 */
export class ReactEmailTemplateRenderer implements IEmailTemplateRenderer {
  /** Renderer name surfaced in diagnostics. */
  readonly name = 'react-email'

  /**
   * @param templates - React templates keyed by `${templateName}::${locale}`.
   */
  constructor(private readonly templates: Record<string, ReactEmailTemplate>) {}

  /**
   * Whether a template is registered for the exact name + locale.
   *
   * @param templateName - Template name.
   * @param locale - Requested locale.
   * @returns `true` when the `${name}::${locale}` key exists.
   */
  hasTemplate(templateName: string, locale: string): Promise<boolean> {
    return Promise.resolve(Boolean(this.templates[`${templateName}::${locale}`]))
  }

  /**
   * Renders a template to subject + html + text, falling back to `en`.
   *
   * @param templateName - Template name.
   * @param data - Props passed to the component and the subject factory.
   * @param locale - Requested locale.
   * @returns The rendered subject + html + text.
   * @throws Error When no template matches the locale nor `en`.
   */
  async render(
    templateName: string,
    data: Record<string, unknown>,
    locale: string,
  ): Promise<RenderedEmail> {
    const template =
      this.templates[`${templateName}::${locale}`] ?? this.templates[`${templateName}::en`]
    if (!template) {
      throw new Error(`Template not found: ${templateName} (locale=${locale})`)
    }
    const element = createElement(template.component, data)
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
    return { subject: template.subject(data), html, text }
  }
}
