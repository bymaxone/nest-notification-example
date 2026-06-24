/**
 * @fileoverview Component tests for {@link ProviderMatrix}.
 *
 * Drives a mocked providers client + a QueryClient/nuqs wrapper to cover the
 * loading placeholder, the error state, the success table (four boundaries with
 * their wired adapters Active), and a disabled channel rendering a Disabled badge.
 *
 * @module components/providers/provider-matrix.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { ReactElement, ReactNode } from 'react'

const mock = {
  getChannels: vi.fn(),
  getConfigStatus: vi.fn(),
}
vi.mock('@/lib/api/providers', () => ({
  getChannels: (...args: unknown[]) => mock.getChannels(...args),
  getConfigStatus: (...args: unknown[]) => mock.getConfigStatus(...args),
}))

const { ProviderMatrix } = await import('./provider-matrix')

const CONFIG = {
  channels: ['email', 'otp'],
  provider: 'Nodemailer (Mailpit)',
  storage: 'InMemoryOtpStorage',
  renderer: 'DefaultTemplateRenderer',
  consumeOnVerify: false,
  swallowErrors: true,
  maskRecipient: true,
  defaultLocale: 'en',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Render the matrix under a fresh QueryClient + nuqs adapter. */
function renderMatrix(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams="?tenantId=acme" hasMemory onUrlUpdate={vi.fn()}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NuqsTestingAdapter>
  )
  render(<ProviderMatrix />, { wrapper })
}

describe('ProviderMatrix', () => {
  /** While the queries are pending, neither the table nor an error shows. */
  it('shows a placeholder while loading', () => {
    mock.getChannels.mockReturnValue(new Promise(() => {}))
    mock.getConfigStatus.mockReturnValue(new Promise(() => {}))
    renderMatrix()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(/Could not load/)).toBeNull()
  })

  /** A query error renders the error message. */
  it('renders an error message when a query fails', async () => {
    mock.getChannels.mockRejectedValue(new Error('down'))
    mock.getConfigStatus.mockResolvedValue(CONFIG)
    renderMatrix()
    await waitFor(() =>
      expect(screen.getByText(/Could not load the provider matrix/)).toBeInTheDocument(),
    )
  })

  /** Success renders the four boundaries with their wired adapters Active. */
  it('renders the four boundaries with live badges', async () => {
    mock.getChannels.mockResolvedValue(['email', 'otp'])
    mock.getConfigStatus.mockResolvedValue(CONFIG)
    renderMatrix()
    await waitFor(() => expect(screen.getByText('Email transport')).toBeInTheDocument())
    expect(screen.getByText('OTP storage')).toBeInTheDocument()
    expect(screen.getByText('Template rendering')).toBeInTheDocument()
    expect(screen.getByText('Audit sink')).toBeInTheDocument()
    expect(screen.getByText('Nodemailer (Mailpit)')).toBeInTheDocument()
    expect(screen.getByText('InMemoryOtpStorage')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(4)
  })

  /** A disabled channel renders a Disabled badge for its boundary. */
  it('marks a disabled channel', async () => {
    mock.getChannels.mockResolvedValue(['email'])
    mock.getConfigStatus.mockResolvedValue(CONFIG)
    renderMatrix()
    await waitFor(() => expect(screen.getByText('Disabled')).toBeInTheDocument())
  })
})
