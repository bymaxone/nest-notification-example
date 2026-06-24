/**
 * @fileoverview Component tests for {@link EmailPreview}.
 *
 * Covers the four tabs and the journey-6 escape proof: a `<script>` variable
 * renders escaped in the Rendered iframe + HTML source but raw in the Text body;
 * the Metadata tab reports the renderer/locale/template; and the template,
 * renderer, and variable controls update the rendered output.
 *
 * @module components/providers/email-preview.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { EmailPreview } from './email-preview'

const user = userEvent.setup({ pointerEventsCheck: 0 })

const pointerOriginals = {
  hasPointerCapture: Element.prototype.hasPointerCapture,
  setPointerCapture: Element.prototype.setPointerCapture,
  releasePointerCapture: Element.prototype.releasePointerCapture,
}

beforeEach(() => {
  Element.prototype.hasPointerCapture = (): boolean => false
  Element.prototype.setPointerCapture = (): void => {}
  Element.prototype.releasePointerCapture = (): void => {}
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  Element.prototype.hasPointerCapture = pointerOriginals.hasPointerCapture
  Element.prototype.setPointerCapture = pointerOriginals.setPointerCapture
  Element.prototype.releasePointerCapture = pointerOriginals.releasePointerCapture
})

describe('EmailPreview', () => {
  /** The default Rendered tab is a sandboxed iframe carrying the escaped html. */
  it('renders the escaped html in a sandboxed iframe', () => {
    render(<EmailPreview />)
    const iframe = screen.getByTitle('Rendered email preview')
    expect(iframe).toHaveAttribute('sandbox', '')
    expect(iframe.getAttribute('srcdoc') ?? '').toContain('&lt;script&gt;')
  })

  /** The HTML tab shows the escaped source (no raw <script> tag). */
  it('shows the html body escaped (journey 6)', async () => {
    render(<EmailPreview />)
    await user.click(screen.getByRole('tab', { name: 'HTML' }))
    const html = screen.getByTestId('preview-html')
    expect(html.textContent ?? '').toContain('&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;')
    expect(html.textContent ?? '').not.toContain('<script>')
    // The fixed appName variable is interpolated into the rendered body.
    expect(html.textContent ?? '').toContain('Bymax')
  })

  /** The Text tab keeps the variable raw (text is not an HTML context). */
  it('keeps the text body raw', async () => {
    render(<EmailPreview />)
    await user.click(screen.getByRole('tab', { name: 'Text' }))
    expect(screen.getByTestId('preview-text').textContent ?? '').toContain(
      "<script>alert('xss')</script>",
    )
  })

  /** The Metadata tab reports the locale, template, and renderer. */
  it('reports the rendered metadata', async () => {
    render(<EmailPreview />)
    await user.click(screen.getByRole('tab', { name: 'Metadata' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Locale')).toBeInTheDocument()
    expect(within(panel).getByText('en')).toBeInTheDocument()
    expect(within(panel).getByText('Default')).toBeInTheDocument()
    expect(within(panel).getByText('welcome')).toBeInTheDocument()
  })

  /** Editing the variable updates the escaped output. */
  it('re-escapes when the variable changes', async () => {
    render(<EmailPreview />)
    const input = screen.getByLabelText('Variable (try HTML)')
    await user.clear(input)
    await user.type(input, '<b>hi</b>')
    await user.click(screen.getByRole('tab', { name: 'HTML' }))
    expect(screen.getByTestId('preview-html').textContent ?? '').toContain('&lt;b&gt;hi&lt;/b&gt;')
  })

  /** Selecting another template renders its body. */
  it('switches the previewed template', async () => {
    render(<EmailPreview />)
    await user.click(screen.getByRole('combobox', { name: 'Template' }))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByRole('option', { name: 'New login alert' }))
    // The new-login template interpolates the fixed location variable into its body.
    await user.click(screen.getByRole('tab', { name: 'HTML' }))
    expect(screen.getByTestId('preview-html').textContent ?? '').toContain('Berlin, DE')
    await user.click(screen.getByRole('tab', { name: 'Metadata' }))
    expect(within(screen.getByRole('tabpanel')).getByText('new_login_alert')).toBeInTheDocument()
  })

  /** Selecting another renderer updates the metadata renderer label. */
  it('switches the renderer label', async () => {
    render(<EmailPreview />)
    await user.click(screen.getByRole('combobox', { name: 'Renderer' }))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByRole('option', { name: 'MJML' }))
    await user.click(screen.getByRole('tab', { name: 'Metadata' }))
    expect(within(screen.getByRole('tabpanel')).getByText('MJML')).toBeInTheDocument()
  })
})
