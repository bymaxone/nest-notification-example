/**
 * @fileoverview Component tests for {@link RoadmapPanel}.
 *
 * Drives a mocked roadmap client to cover: the three probe cards + two declared
 * console surfaces render; a probe surfaces the verbatim backend message + the
 * localized code where one maps (none for useClass); an empty message falls back;
 * and the busy state disables the button mid-flight.
 *
 * @module components/roadmap/roadmap-panel.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { NOTIFICATION_ERROR_CODES } from '@bymax-one/nest-notification/shared'

const mock = {
  tryConfigureSms: vi.fn(),
  tryConfigurePush: vi.fn(),
  tryConfigureAsyncUseClass: vi.fn(),
}
vi.mock('@/lib/api/roadmap', () => ({
  tryConfigureSms: (...a: unknown[]) => mock.tryConfigureSms(...a),
  tryConfigurePush: (...a: unknown[]) => mock.tryConfigurePush(...a),
  tryConfigureAsyncUseClass: (...a: unknown[]) => mock.tryConfigureAsyncUseClass(...a),
}))

const { RoadmapPanel } = await import('./roadmap-panel')

const user = userEvent.setup()

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Click the Try button inside one probe card. */
async function tryProbe(id: string): Promise<void> {
  const card = screen.getByTestId(`probe-${id}`)
  await user.click(within(card).getByRole('button', { name: /Try/ }))
}

describe('RoadmapPanel', () => {
  /** Renders the three probe cards and the two declared console surfaces. */
  it('renders the probes and declared surfaces', () => {
    render(<RoadmapPanel />)
    expect(screen.getByTestId('probe-sms')).toBeInTheDocument()
    expect(screen.getByTestId('probe-push')).toBeInTheDocument()
    expect(screen.getByTestId('probe-useclass')).toBeInTheDocument()
    expect(screen.getByTestId('roadmap-break-audit-sink')).toBeInTheDocument()
    expect(screen.getByTestId('roadmap-latency-percentiles')).toBeInTheDocument()
  })

  /** A SMS probe shows the verbatim backend message + the localized SMS code. */
  it('surfaces the verbatim rejection and localized code for SMS', async () => {
    mock.tryConfigureSms.mockResolvedValue({
      code: NOTIFICATION_ERROR_CODES.SMS_PROVIDER_NOT_CONFIGURED,
      message: 'SMS channel is declared but not implemented (v0.2).',
    })
    render(<RoadmapPanel />)
    await tryProbe('sms')
    const card = screen.getByTestId('probe-sms')
    await waitFor(() =>
      expect(within(card).getByText(/declared but not implemented/)).toBeInTheDocument(),
    )
    expect(within(card).getByText(/No SMS provider is configured/)).toBeInTheDocument()
  })

  /** A useClass probe shows the message but no code badge (no code maps). */
  it('shows no code badge for the useClass probe', async () => {
    mock.tryConfigureAsyncUseClass.mockResolvedValue({
      code: null,
      message: 'useClass is rejected',
    })
    render(<RoadmapPanel />)
    await tryProbe('useclass')
    const card = screen.getByTestId('probe-useclass')
    await waitFor(() => expect(within(card).getByText('useClass is rejected')).toBeInTheDocument())
    expect(within(card).queryByText(/is configured/)).toBeNull()
  })

  /** An empty message renders the explanatory fallback. */
  it('falls back when the backend returns no message', async () => {
    mock.tryConfigurePush.mockResolvedValue({
      code: NOTIFICATION_ERROR_CODES.PUSH_PROVIDER_NOT_CONFIGURED,
      message: '',
    })
    render(<RoadmapPanel />)
    await tryProbe('push')
    const card = screen.getByTestId('probe-push')
    await waitFor(() =>
      expect(within(card).getByText(/did not return a rejection message/)).toBeInTheDocument(),
    )
  })

  /** The Try button is disabled while the probe is in flight. */
  it('disables the button while the probe runs', async () => {
    mock.tryConfigureSms.mockReturnValue(new Promise(() => {}))
    render(<RoadmapPanel />)
    await tryProbe('sms')
    const card = screen.getByTestId('probe-sms')
    await waitFor(() => expect(within(card).getByRole('button')).toBeDisabled())
  })
})
