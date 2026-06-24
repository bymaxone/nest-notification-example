/**
 * @fileoverview Component tests for {@link FrozenOptions}.
 *
 * Covers the loading placeholder, the error state, and the success render — both
 * boot-frozen flags shown read-only with the explanatory note and, critically, NO
 * mutating control (no checkbox, switch, or button).
 *
 * @module components/settings/frozen-options.test
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

const { FrozenOptions } = await import('./frozen-options')

const STATUS = {
  channels: ['email'],
  provider: 'Nodemailer',
  storage: 'InMemoryOtpStorage',
  renderer: 'DefaultTemplateRenderer',
  consumeOnVerify: true,
  swallowErrors: false,
  maskRecipientMode: 'masked',
  defaultLocale: 'en',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Render under a fresh QueryClient + nuqs adapter. */
function renderOptions(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams="" hasMemory onUrlUpdate={vi.fn()}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NuqsTestingAdapter>
  )
  render(<FrozenOptions />, { wrapper })
}

describe('FrozenOptions', () => {
  /** While loading, the flags are not yet shown. */
  it('shows a placeholder while loading', () => {
    mock.getSettingsStatus.mockReturnValue(new Promise(() => {}))
    renderOptions()
    expect(screen.queryByText('consumeOnVerify')).toBeNull()
  })

  /** A failed query renders the error message. */
  it('renders an error message on failure', async () => {
    mock.getSettingsStatus.mockRejectedValue(new Error('down'))
    renderOptions()
    await waitFor(() =>
      expect(screen.getByText(/Could not load the frozen options/)).toBeInTheDocument(),
    )
  })

  /** Success shows both flags read-only with NO mutating control. */
  it('renders both flags read-only with no mutation control', async () => {
    mock.getSettingsStatus.mockResolvedValue(STATUS)
    renderOptions()
    await waitFor(() => expect(screen.getByText('consumeOnVerify')).toBeInTheDocument())
    expect(screen.getByText('swallowErrors')).toBeInTheDocument()
    expect(screen.getByText(/Resolved once at boot/)).toBeInTheDocument()
    // The boot-frozen options are read-only: no interactive mutation control.
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
