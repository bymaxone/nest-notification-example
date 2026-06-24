/**
 * @fileoverview Component tests for {@link TriggerCard}.
 *
 * Mocks `sonner` and drives the injected `fire` to cover: the success path (toast
 * + result summary + Explorer deep-link), an expected-error 4xx (success toast,
 * not failure), an unexpected error (error toast), and a thrown fire (catch →
 * error toast, no result) including the non-Error message fallback.
 *
 * @module components/trigger/trigger-card.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TriggerCard } from './trigger-card'
import type { TriggerResult } from '@/lib/trigger-api'
import type { TriggerDescriptor } from './trigger-grid'

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
  /** A successful fire toasts success and reveals the summary + deep-link. */
  it('fires successfully and reveals the Explorer deep-link', async () => {
    renderCard(makeDescriptor({}))
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(screen.getByText(/HTTP 201 · email · sent/)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /View in Explorer/ })).toHaveAttribute(
      'href',
      '/explorer?x=1',
    )
    expect(toastSuccess).toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  /** An expected-error 4xx is the expected outcome — success toast, summary shown. */
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
    await waitFor(() =>
      expect(screen.getByText(/HTTP 429 · otp · cooldown_blocked/)).toBeInTheDocument(),
    )
    expect(toastSuccess).toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  /** An unexpected error status toasts an error (but still shows the summary). */
  it('toasts an error for an unexpected failure status', async () => {
    const descriptor = makeDescriptor({
      fire: vi.fn(() => Promise.resolve<TriggerResult>({ ...OK_RESULT, ok: false, status: 500 })),
    })
    renderCard(descriptor)
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument()
  })

  /** A thrown fire is caught and toasts the error message; no result is shown. */
  it('catches a thrown fire and shows no result', async () => {
    const descriptor = makeDescriptor({ fire: vi.fn(() => Promise.reject(new Error('boom'))) })
    renderCard(descriptor)
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(screen.queryByText(/View in Explorer/)).toBeNull()
  })

  /** A non-Error rejection falls back to the generic network message. */
  it('falls back to a network message on a non-Error rejection', async () => {
    const descriptor = makeDescriptor({ fire: vi.fn(() => Promise.reject('nope')) })
    renderCard(descriptor)
    await userEvent.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(toastError).toHaveBeenCalled())
  })
})
