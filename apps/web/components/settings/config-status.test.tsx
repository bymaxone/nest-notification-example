/**
 * @fileoverview Component tests for {@link ConfigStatus}.
 *
 * Drives a mocked settings client + QueryClient/nuqs wrapper to cover the loading
 * placeholder, the error state, the success render (channels, provider/storage/
 * renderer, the RBAC role list from the switcher), and both recipient-mask modes.
 *
 * @module components/settings/config-status.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { ReactElement, ReactNode } from 'react'

const mock = { getSettingsStatus: vi.fn() }
vi.mock('@/lib/api/settings', () => ({
  getSettingsStatus: (...a: unknown[]) => mock.getSettingsStatus(...a),
}))

const { ConfigStatus } = await import('./config-status')
const { FrozenOptions } = await import('./frozen-options')

const STATUS = {
  channels: ['email', 'otp'],
  provider: 'Nodemailer',
  storage: 'InMemoryOtpStorage',
  renderer: 'DefaultTemplateRenderer',
  consumeOnVerify: false,
  swallowErrors: true,
  maskRecipientMode: 'masked',
  defaultLocale: 'en',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Render under a fresh QueryClient + nuqs adapter. */
function renderStatus(search = '?role=operator'): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={vi.fn()}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NuqsTestingAdapter>
  )
  render(<ConfigStatus />, { wrapper })
}

describe('ConfigStatus', () => {
  /** While loading, neither the config nor an error shows. */
  it('shows a placeholder while loading', () => {
    mock.getSettingsStatus.mockReturnValue(new Promise(() => {}))
    renderStatus()
    expect(screen.queryByText('Nodemailer')).toBeNull()
    expect(screen.queryByText(/Could not load/)).toBeNull()
  })

  /** A failed query renders the error message. */
  it('renders an error message on failure', async () => {
    mock.getSettingsStatus.mockRejectedValue(new Error('down'))
    renderStatus()
    await waitFor(() =>
      expect(screen.getByText(/Could not load the config status/)).toBeInTheDocument(),
    )
  })

  /** Success renders the config, the RBAC roles, and the masked recipient. */
  it('renders the config, roles, and masked recipient', async () => {
    mock.getSettingsStatus.mockResolvedValue(STATUS)
    renderStatus()
    await waitFor(() => expect(screen.getByText('Nodemailer')).toBeInTheDocument())
    expect(screen.getByText('InMemoryOtpStorage')).toBeInTheDocument()
    // Each enabled channel renders as a badge (the `channels.map`).
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('otp')).toBeInTheDocument()
    // The active role (operator) badge uses the brand (default) variant; the others are outline.
    expect(screen.getByText('Operator')).toHaveClass('bg-brand-500')
    const viewer = screen.getByText('Viewer')
    expect(viewer).toHaveClass('text-foreground')
    expect(viewer).not.toHaveClass('bg-brand-500')
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('j***@acme.com')).toBeInTheDocument()
  })

  /** In raw mode the stored recipient equals the raw recipient. */
  it('shows the raw recipient when masking is off', async () => {
    mock.getSettingsStatus.mockResolvedValue({ ...STATUS, maskRecipientMode: 'raw' })
    renderStatus()
    await waitFor(() => expect(screen.getAllByText('jane@acme.com')).toHaveLength(2))
  })

  /**
   * Both Settings panels key the snapshot query identically (`['settings-status', tenantId]`)
   * so they share one cache entry: rendering them together fetches the status exactly once.
   */
  it('shares the settings-status query key across both panels', async () => {
    mock.getSettingsStatus.mockResolvedValue(STATUS)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <NuqsTestingAdapter searchParams="?tenantId=acme" hasMemory onUrlUpdate={vi.fn()}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NuqsTestingAdapter>
    )
    render(
      <>
        <ConfigStatus />
        <FrozenOptions />
      </>,
      { wrapper },
    )
    await waitFor(() => expect(screen.getByText('Nodemailer')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('consumeOnVerify')).toBeInTheDocument())
    // A single shared cache entry → exactly one network read for the same tenant.
    expect(mock.getSettingsStatus).toHaveBeenCalledTimes(1)
    expect(mock.getSettingsStatus).toHaveBeenCalledWith('acme')
  })
})
