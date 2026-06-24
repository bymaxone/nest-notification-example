/**
 * @fileoverview Unit tests for the Providers & Templates client + preview renderer.
 *
 * Covers the config/channels GETs (sending the trusted tenant header), the
 * HTML escaper across all five significant characters, and the journey-6 escape:
 * a `<script>` variable renders escaped in the html body but raw in the subject
 * and text bodies, with a missing variable rendering empty.
 *
 * @module lib/api/providers.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_EMAIL_PREVIEW_TEMPLATE,
  EMAIL_PREVIEW_TEMPLATES,
  EMAIL_RENDERERS,
  escapeHtml,
  getChannels,
  getConfigStatus,
  getEmailPreviewTemplate,
  renderEmailPreview,
} from './providers'

/** Build a minimal `Response`-like object for the fetch stub. */
function makeResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: '',
    json: () => Promise.resolve(body),
    headers: { get: () => null },
  } as unknown as Response
}

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  vi.clearAllMocks()
})

describe('config + channels clients', () => {
  /** getConfigStatus reads /config/status with the tenant header. */
  it('fetches the config status with the tenant header', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ provider: 'Nodemailer', channels: ['email', 'otp'] }),
    )
    const result = await getConfigStatus('acme')
    expect(result).toMatchObject({ provider: 'Nodemailer' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('/config/status')
    expect(init.headers['x-tenant-id']).toBe('acme')
  })

  /** getChannels reads /channels. */
  it('fetches the enabled channels', async () => {
    fetchMock.mockResolvedValue(makeResponse(['email', 'otp']))
    await expect(getChannels('')).resolves.toEqual(['email', 'otp'])
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/channels')
  })
})

describe('escapeHtml', () => {
  /** Escapes all five HTML-significant characters. */
  it('escapes &, <, >, ", and \'', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  /** Leaves an ordinary string untouched. */
  it('passes plain text through unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('renderEmailPreview', () => {
  const template = EMAIL_PREVIEW_TEMPLATES[0]!

  /** A markup variable is escaped in the html body but raw in subject + text. */
  it('escapes the html body only (journey 6)', () => {
    const rendered = renderEmailPreview({
      template,
      data: { name: '<script>alert(1)</script>', appName: 'Bymax' },
      locale: 'en',
      renderer: 'Default',
    })
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(rendered.html).not.toContain('<script>alert(1)</script>')
    expect(rendered.subject).toContain('<script>alert(1)</script>')
    expect(rendered.text).toContain('<script>alert(1)</script>')
  })

  /** Metadata carries the locale, template id, and renderer label. */
  it('reports the rendered metadata', () => {
    const rendered = renderEmailPreview({
      template,
      data: { name: 'Jane', appName: 'Bymax' },
      locale: 'pt-BR',
      renderer: 'MJML',
    })
    expect(rendered.metadata).toMatchObject({
      locale: 'pt-BR',
      templateId: 'welcome',
      renderer: 'MJML',
    })
  })

  /** A missing variable renders as an empty string. */
  it('renders a missing variable as empty', () => {
    const alert = EMAIL_PREVIEW_TEMPLATES[1]!
    const rendered = renderEmailPreview({
      template: alert,
      data: { name: 'Jane' },
      locale: 'en',
      renderer: 'Default',
    })
    expect(rendered.text).toBe('New sign-in for Jane from .')
  })

  /** The renderer catalog lists the four demos. */
  it('lists the four renderer demos', () => {
    expect(EMAIL_RENDERERS).toEqual(['Default', 'Handlebars', 'MJML', 'React Email'])
  })
})

describe('getEmailPreviewTemplate', () => {
  /** A known id resolves to its template. */
  it('resolves a known template id', () => {
    expect(getEmailPreviewTemplate('new_login_alert').name).toBe('New login alert')
  })

  /** An unknown id falls back to the default template. */
  it('falls back to the default for an unknown id', () => {
    expect(getEmailPreviewTemplate('nope')).toBe(DEFAULT_EMAIL_PREVIEW_TEMPLATE)
  })
})
