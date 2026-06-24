/**
 * Unit tests for the three alternate `IEmailTemplateRenderer` showcases.
 *
 * Each renderer is exercised through its full contract: construction (including the
 * with-/without-text branches and MJML's fail-fast on invalid markup), exact-locale
 * render, `en` fallback, the not-found throw, and HTML escaping where the engine owns
 * it (MJML's post-compile pass; React's automatic escaping).
 */
import { describe, expect, it } from '@jest/globals'
import { createElement, type ReactElement } from 'react'

import { HandlebarsTemplateRenderer } from './handlebars.renderer.js'
import { MjmlTemplateRenderer } from './mjml.renderer.js'
import { ReactEmailTemplateRenderer } from './react-email.renderer.js'

/** A minimal valid MJML body wrapping a single text node. */
const mjmlBody = (inner: string): string =>
  `<mjml><mj-body><mj-section><mj-column><mj-text>${inner}</mj-text></mj-column></mj-section></mj-body></mjml>`

describe('HandlebarsTemplateRenderer', () => {
  /** One template with text, one without — covers both construction/render branches. */
  const renderer = new HandlebarsTemplateRenderer({
    'otp_code::en': {
      subject: 'Your {{appName}} code',
      html: '<p>{{name}}: {{code}}</p>',
      text: '{{name}}: {{code}}',
    },
    'welcome::en': { subject: 'Welcome', html: '<p>Hi {{name}}</p>' },
  })

  it('reports the renderer name and template presence', async () => {
    /** Name is fixed; `hasTemplate` is an exact name+locale lookup. */
    expect(renderer.name).toBe('handlebars')
    expect(await renderer.hasTemplate('otp_code', 'en')).toBe(true)
    expect(await renderer.hasTemplate('missing', 'en')).toBe(false)
  })

  it('renders a template with a text body and HTML-escapes via Handlebars', async () => {
    /**
     * Handlebars `{{var}}` escapes by default in every body (it is context-unaware),
     * so the html AND text outputs carry the escaped value — a documented caveat.
     */
    const rendered = await renderer.render(
      'otp_code',
      { appName: 'Bymax', name: '<b>J</b>', code: 'X' },
      'en',
    )

    expect(rendered.subject).toBe('Your Bymax code')
    expect(rendered.html).toContain('&lt;b&gt;J&lt;/b&gt;')
    expect(rendered.text).toBe('&lt;b&gt;J&lt;/b&gt;: X')
  })

  it('omits text when the template has none and falls back to en', async () => {
    /** `welcome` has no text body, and a non-en locale resolves the en template. */
    const rendered = await renderer.render('welcome', { name: 'Jane' }, 'pt-BR')

    expect(rendered.text).toBeUndefined()
    expect(rendered.html).toBe('<p>Hi Jane</p>')
  })

  it('throws when no template matches the locale nor en', async () => {
    /** A name absent from the registry must raise a not-found error. */
    await expect(renderer.render('missing', {}, 'en')).rejects.toThrow('Template not found')
  })

  it('selects the exact-locale template over the en fallback when both exist', async () => {
    /**
     * Scenario: a `pt-BR` variant exists alongside `en`.
     * Contract: the primary `${name}::${locale}` lookup wins, so a `pt-BR` request renders the
     * `pt-BR` copy — proving the exact-locale key is consulted before the `::en` fallback.
     */
    const localized = new HandlebarsTemplateRenderer({
      'welcome::en': { subject: 'EN subject', html: '<p>EN body</p>' },
      'welcome::pt-BR': { subject: 'PT subject', html: '<p>PT body</p>' },
    })

    const rendered = await localized.render('welcome', {}, 'pt-BR')

    expect(rendered.subject).toBe('PT subject')
    expect(rendered.html).toBe('<p>PT body</p>')
  })
})

describe('MjmlTemplateRenderer', () => {
  /** One template with text, one without — covers both construction/render branches. */
  const renderer = new MjmlTemplateRenderer({
    'welcome::en': {
      subject: 'Welcome {{appName}}',
      mjml: mjmlBody('Hi {{name}}'),
      text: 'Hi {{name}}',
    },
    'otp::en': { subject: 'OTP', mjml: mjmlBody('{{code}}') },
  })

  it('reports the renderer name and template presence', async () => {
    /** Name is fixed; `hasTemplate` is an exact name+locale lookup. */
    expect(renderer.name).toBe('mjml')
    expect(await renderer.hasTemplate('welcome', 'en')).toBe(true)
    expect(await renderer.hasTemplate('missing', 'en')).toBe(false)
  })

  it('throws at construction on invalid MJML', () => {
    /** `soft` validation surfaces a structured error the adapter rethrows fail-fast. */
    expect(
      () =>
        new MjmlTemplateRenderer({
          'bad::en': {
            subject: 'x',
            mjml: '<mjml><mj-body><mj-bogus>x</mj-bogus></mj-body></mjml>',
          },
        }),
    ).toThrow('Invalid MJML')
  })

  it('escapes the html body only and renders the text body raw', async () => {
    /** Subject/text are interpolated without escaping; the html body is escaped. */
    const rendered = await renderer.render(
      'welcome',
      { appName: 'Acme & Co', name: '<script>x</script>' },
      'en',
    )

    expect(rendered.subject).toBe('Welcome Acme & Co')
    expect(rendered.html).toContain('&lt;script&gt;x&lt;/script&gt;')
    expect(rendered.html).not.toContain('<script>x</script>')
    expect(rendered.text).toBe('Hi <script>x</script>')
  })

  it('substitutes an absent variable with an empty string and omits absent text', async () => {
    /** A missing variable renders empty; `otp` has no text body, falling back to en. */
    const rendered = await renderer.render('otp', {}, 'pt-BR')

    expect(rendered.subject).toBe('OTP')
    expect(rendered.html).not.toContain('{{code}}')
    expect(rendered.text).toBeUndefined()
  })

  it('JSON-serializes an object-valued variable instead of "[object Object]"', async () => {
    /** A non-primitive interpolation value is JSON-serialized (then escaped in html). */
    const rendered = await renderer.render('welcome', { appName: 'A', name: { id: 1 } }, 'en')

    expect(rendered.text).toBe('Hi {"id":1}')
    expect(rendered.html).toContain('{&quot;id&quot;:1}')
  })

  it('stringifies a numeric variable and renders a null variable empty', async () => {
    /** Scalars stringify; an explicit `null` value renders as empty (no literal "null"). */
    const numeric = await renderer.render('otp', { code: 42 }, 'en')
    expect(numeric.html).toContain('42')

    const nulled = await renderer.render('otp', { code: null }, 'en')
    expect(nulled.html).not.toContain('null')
  })

  it('throws when no template matches the locale nor en', async () => {
    /** A name absent from the registry must raise a not-found error. */
    await expect(renderer.render('missing', {}, 'en')).rejects.toThrow('Template not found')
  })

  it('substitutes a whitespace-padded {{ var }} placeholder', async () => {
    /**
     * Scenario: a placeholder written with inner whitespace (`{{ name }}`).
     * Contract: the `\s*` arms of the placeholder regex tolerate the padding, so the variable is
     * still interpolated (a `\S*` form would fail to match the trailing spaces and leave it raw).
     */
    const spaced = new MjmlTemplateRenderer({
      'pad::en': { subject: 'Hi {{ name }}', mjml: mjmlBody('Hi {{ name }}') },
    })

    const rendered = await spaced.render('pad', { name: 'Jane' }, 'en')

    expect(rendered.subject).toBe('Hi Jane')
    expect(rendered.html).not.toContain('{{')
  })

  it('escapes ampersands and single quotes in the html body', async () => {
    /**
     * Scenario: an interpolated value carrying `&` and `'`.
     * Contract: the html escaper rewrites `&`→`&amp;` (first, so later entities are not
     * double-escaped) and `'`→`&#39;`, proving both replacement targets are applied.
     */
    const rendered = await renderer.render('welcome', { appName: 'A', name: "Tom & O'Neil" }, 'en')

    expect(rendered.html).toContain('Tom &amp; O&#39;Neil')
  })

  it('stringifies number, boolean, and bigint values rather than dropping them', async () => {
    /**
     * Scenario: each scalar non-string value (`number`, `boolean`, `bigint`) at a bracketed
     * placeholder.
     * Contract: every scalar arm of the stringify guard coerces via `String(value)` and emits the
     * literal text between the markers — none collapses to an empty substitution. A fresh renderer
     * isolates this assertion to its own template so the scalar coercion path is exercised here.
     */
    const scalars = new MjmlTemplateRenderer({
      'val::en': { subject: 's', mjml: mjmlBody('[{{v}}]') },
    })

    expect((await scalars.render('val', { v: 42 }, 'en')).html).toContain('[42]')
    expect((await scalars.render('val', { v: true }, 'en')).html).toContain('[true]')
    expect((await scalars.render('val', { v: 7n }, 'en')).html).toContain('[7]')
  })

  it('renders a null or absent value as an empty substitution (no sentinel text)', async () => {
    /**
     * Scenario: a `null` value and an absent value at a placeholder bracketed by literal markers.
     * Contract: the nullish stringify arm returns an empty string, so the markers collapse to
     * `[]` with nothing between them — the fallback emits no placeholder or sentinel text.
     */
    const gap = new MjmlTemplateRenderer({
      'gap::en': { subject: 's', mjml: mjmlBody('[{{value}}]') },
    })

    const withNull = await gap.render('gap', { value: null }, 'en')
    expect(withNull.html).toContain('[]')

    const withAbsent = await gap.render('gap', {}, 'en')
    expect(withAbsent.html).toContain('[]')
  })

  it('selects the exact-locale template over the en fallback when both exist', async () => {
    /**
     * Scenario: a `pt-BR` variant exists alongside `en`.
     * Contract: the primary `${name}::${locale}` lookup wins over the `::en` fallback, so a
     * `pt-BR` request renders the localized subject.
     */
    const localized = new MjmlTemplateRenderer({
      'welcome::en': { subject: 'EN subject', mjml: mjmlBody('en') },
      'welcome::pt-BR': { subject: 'PT subject', mjml: mjmlBody('pt') },
    })

    const rendered = await localized.render('welcome', {}, 'pt-BR')

    expect(rendered.subject).toBe('PT subject')
  })
})

describe('ReactEmailTemplateRenderer', () => {
  /** A trivial component that echoes a prop — React escapes the value automatically. */
  const Welcome = (props: Record<string, unknown>): ReactElement =>
    createElement('div', null, `Hi ${String(props['name'])}`)
  const renderer = new ReactEmailTemplateRenderer({
    'welcome::en': { subject: (d) => `Welcome ${String(d['appName'])}`, component: Welcome },
  })

  it('reports the renderer name and template presence', async () => {
    /** Name is fixed; `hasTemplate` is an exact name+locale lookup. */
    expect(renderer.name).toBe('react-email')
    expect(await renderer.hasTemplate('welcome', 'en')).toBe(true)
    expect(await renderer.hasTemplate('missing', 'en')).toBe(false)
  })

  it('renders the component to html + text and builds the subject from the factory', async () => {
    /** `render` produces html and (plainText) text; the subject comes from the factory. */
    const rendered = await renderer.render('welcome', { name: 'Jane', appName: 'Bymax' }, 'en')

    expect(rendered.subject).toBe('Welcome Bymax')
    expect(rendered.html).toContain('Hi Jane')
    expect(rendered.text).toContain('Hi Jane')
  })

  it('produces a tag-free plain-text body distinct from the html', async () => {
    /**
     * Scenario: the same component rendered for html and for text.
     * Contract: the second pass runs with `{ plainText: true }`, so the text body carries the
     * copy WITHOUT the markup the html body wraps it in — proving the plain-text option (and its
     * `true` flag) is honoured, not a second html render.
     */
    const rendered = await renderer.render('welcome', { name: 'Jane', appName: 'Bymax' }, 'en')

    expect(rendered.html).toContain('<')
    expect(rendered.text).not.toContain('<div')
    expect(rendered.text).not.toContain('</')
  })

  it('falls back to the en template for an unregistered locale', async () => {
    /** Only `en` is registered, so a `pt-BR` request resolves the `en` component. */
    const rendered = await renderer.render('welcome', { name: 'Jane', appName: 'Bymax' }, 'pt-BR')

    expect(rendered.html).toContain('Hi Jane')
  })

  it('selects the exact-locale template over the en fallback when both exist', async () => {
    /**
     * Scenario: a `pt-BR` component variant exists alongside `en`.
     * Contract: the primary `${name}::${locale}` lookup wins, so a `pt-BR` request renders the
     * localized subject — the exact-locale key is consulted before the `::en` fallback.
     */
    const Pt = (): ReactElement => createElement('div', null, 'corpo PT')
    const localized = new ReactEmailTemplateRenderer({
      'welcome::en': { subject: () => 'EN subject', component: Welcome },
      'welcome::pt-BR': { subject: () => 'PT subject', component: Pt },
    })

    const rendered = await localized.render('welcome', {}, 'pt-BR')

    expect(rendered.subject).toBe('PT subject')
    expect(rendered.html).toContain('corpo PT')
  })

  it('throws when no template matches the locale nor en', async () => {
    /** A name absent from the registry must raise a not-found error. */
    await expect(renderer.render('missing', {}, 'en')).rejects.toThrow('Template not found')
  })
})
