/**
 * @fileoverview Component tests for {@link TriggerCard}.
 *
 * Mocks `sonner` and drives the injected `fire` to cover: the header content +
 * endpoint badge + stable test id, the success path (success toast with its HTTP
 * description, the result summary's mono/neutral styling, and the Explorer
 * deep-link), an expected-error 4xx (success toast, amber summary, not a failure),
 * an unexpected error (error toast naming the status), a thrown fire (catch → error
 * toast with the error message, no result) including the non-Error fallback, the
 * in-flight "Firing…" disabled state, and the re-enable after completion.
 *
 * @module components/trigger/trigger-card.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TriggerCard } from './trigger-card'
import type { TriggerDescriptor } from './trigger-grid'
import type { TriggerResult } from '@/lib/trigger-api'

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}))

/** A base fire result. */
const OK_RESULT: TriggerResult = {
  status: 201,
  ok: true,
  recipient: 'd***@example.com',
  channel: 'email',
  purpose: null,
  verb: 'sent',
}

/** Build a descriptor whose fire resolves/rejects as configured. */
function makeDescriptor(over: Partial<TriggerDescriptor>): TriggerDescriptor {
  return {
    id: 'demo',
    title: 'Demo fire',
    demonstrates: 'a thing',
    endpoint: 'POST /demo',
    fire: vi.fn(() => Promise.resolve(OK_RESULT)),
    explorerTarget: () => ({ range: '15m' }),
    ...over,
  }
}

/** Render a card with the given descriptor. */
function renderCard(descriptor: TriggerDescriptor): void {
  render(<TriggerCard descriptor={descriptor} tenantId="acme" hrefFor={() => '/explorer?x=1'} />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TriggerCard', () => {
  /** The header renders the title, "Demonstrates" line, endpoint badge, and stable test id. */
  it('renders the header content and a stable test id', () => {
    renderCard(makeDescriptor({}))
    expect(screen.getByText('Demo fire')).toBeInTheDocument()
    expect(screen.getByText('a thing')).toBeInTheDocument()
    expect(screen.getByText('POST /demo')).toBeInTheDocument()
    expect(screen.getByTestId('trigger-demo')).toBeInTheDocument()
  })

  /** A successful fire toasts success (with the HTTP description) and reveals the summary. */
  it('fires successfully and reveals the Explorer deep-link', async () => {
    const fire = vi.fn(() => Promise.resolve(OK_RESULT))
    renderCard(makeDescriptor({ fire }))
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(screen.getByText(/HTTP 201 · email · sent/)).toBeInTheDocument())
    // The fire runs with the trusted tenant context.
    expect(fire).toHaveBeenCalledWith({ tenantId: 'acme' })
    // The success summary uses the mono, neutral styling (ok branch).
    const summary = screen.getByText(/HTTP 201 · email · sent/)
    expect(summary).toHaveClass('font-mono')
    expect(summary).toHaveClass('text-white/55')
    expect(screen.getByRole('link', { name: /View in Explorer/ })).toHaveAttribute(
      'href',
      '/explorer?x=1',
    )
    expect(toastSuccess).toHaveBeenCalledWith('Demo fire fired', { description: 'HTTP 201' })
    expect(toastError).not.toHaveBeenCalled()
  })

  /** An expected-error 4xx is the expected outcome — success toast, amber summary. */
  it('treats an isExpectedError 4xx as the expected outcome', async () => {
    const descriptor = makeDescriptor({
      isExpectedError: true,
      fire: vi.fn(() =>
        Promise.resolve<TriggerResult>({
          ...OK_RESULT,
          ok: false,
          status: 429,
          channel: 'otp',
          verb: 'cooldown_blocked',
        }),
      ),
    })
    renderCard(descriptor)
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    const summary = await screen.findByText(/HTTP 429 · otp · cooldown_blocked/)
    // A non-ok result still shows the summary, but in the amber (warning) colour.
    expect(summary).toHaveClass('text-amber-400')
    expect(toastSuccess).toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  /** An unexpected error status toasts an error naming the status (but still shows the summary). */
  it('toasts an error for an unexpected failure status', async () => {
    const descriptor = makeDescriptor({
      fire: vi.fn(() => Promise.resolve<TriggerResult>({ ...OK_RESULT, ok: false, status: 500 })),
    })
    renderCard(descriptor)
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Demo fire returned 500'))
    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument()
  })

  /** A thrown fire is caught and toasts the error message; no result is shown. */
  it('catches a thrown fire and shows no result', async () => {
    const descriptor = makeDescriptor({ fire: vi.fn(() => Promise.reject(new Error('boom'))) })
    renderCard(descriptor)
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Demo fire failed', { description: 'boom' }),
    )
    expect(screen.queryByText(/View in Explorer/)).toBeNull()
  })

  /** A non-Error rejection falls back to the generic network message. */
  it('falls back to a network message on a non-Error rejection', async () => {
    const descriptor = makeDescriptor({ fire: vi.fn(() => Promise.reject('nope')) })
    renderCard(descriptor)
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Demo fire failed', { description: 'Network error' }),
    )
  })

  /** While the fire is in flight the button shows "Firing…" and is disabled. */
  it('shows the in-flight firing state while the fire is pending', async () => {
    let resolveFire!: (value: TriggerResult) => void
    const descriptor = makeDescriptor({
      fire: vi.fn(() => new Promise<TriggerResult>((resolve) => (resolveFire = resolve))),
    })
    renderCard(descriptor)
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    const button = screen.getByRole('button')
    await waitFor(() => expect(button).toBeDisabled())
    expect(button).toHaveTextContent('Firing…')
    // Resolving the fire clears the in-flight state: the button re-enables and reads "Fire".
    resolveFire(OK_RESULT)
    await waitFor(() => expect(button).not.toBeDisabled())
    expect(button).toHaveTextContent('Fire')
  })
})
