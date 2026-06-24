/**
 * @fileoverview Component tests for {@link OtpVerifyPanel}.
 *
 * Drives a mocked OTP client + stubbed box/pill children to cover: generate →
 * active box, a successful verify (offering consume), a wrong code with
 * remainingAttempts, the max-attempts lockout (no countdown, box disabled),
 * the resend cooldown gate, the generate cooldown + network-error notices, the
 * expiry message, the per-purpose length, and that the typed code never reaches
 * the URL or the rendered DOM.
 *
 * @module components/otp/otp-verify-panel.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { ReactElement, ReactNode } from 'react'

import { NOTIFICATION_ERROR_CODES } from '@bymax-one/nest-notification/shared'

const api = {
  generateOtp: vi.fn(),
  resendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  consumeOtp: vi.fn(),
}
vi.mock('@/lib/api/otp', () => ({
  generateOtp: (...args: unknown[]) => api.generateOtp(...args),
  resendOtp: (...args: unknown[]) => api.resendOtp(...args),
  verifyOtp: (...args: unknown[]) => api.verifyOtp(...args),
  consumeOtp: (...args: unknown[]) => api.consumeOtp(...args),
}))

vi.mock('./otp-input-box', () => ({
  OtpInputBox: (props: {
    length: number
    type: string
    disabled?: boolean
    onComplete: (code: string) => void
  }) => (
    <button
      type="button"
      data-testid="box"
      data-length={props.length}
      data-type={props.type}
      data-disabled={String(props.disabled)}
      disabled={props.disabled}
      onClick={() => props.onComplete('123456')}
    >
      enter code
    </button>
  ),
}))

vi.mock('./otp-countdown-pill', () => ({
  OtpCountdownPill: (props: { expiresAt: number | null; onExpired?: () => void }) => (
    <button type="button" data-testid="expire" onClick={() => props.onExpired?.()}>
      pill {String(props.expiresAt)}
    </button>
  ),
}))

const { OtpVerifyPanel } = await import('./otp-verify-panel')

const user = userEvent.setup({ pointerEventsCheck: 0 })

const pointerOriginals = {
  hasPointerCapture: Element.prototype.hasPointerCapture,
  setPointerCapture: Element.prototype.setPointerCapture,
  releasePointerCapture: Element.prototype.releasePointerCapture,
}

beforeEach(() => {
  api.generateOtp.mockResolvedValue({
    ok: true,
    data: { expiresAt: Date.now() + 60_000, cooldownSeconds: 60 },
  })
  api.resendOtp.mockResolvedValue({
    ok: true,
    data: { expiresAt: Date.now() + 60_000, cooldownSeconds: 0 },
  })
  api.verifyOtp.mockResolvedValue({ ok: true })
  api.consumeOtp.mockResolvedValue({ ok: true, data: undefined })
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

/** Render the panel under a nuqs adapter seeded with the active tenant. */
function renderPanel(search = '?tenantId=acme'): void {
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={vi.fn()}>
      {children}
    </NuqsTestingAdapter>
  )
  render(<OtpVerifyPanel />, { wrapper })
}

/** Click Generate and wait for the active box to appear. */
async function generate(): Promise<void> {
  await user.click(screen.getByRole('button', { name: /Generate/ }))
  await screen.findByTestId('box')
}

describe('OtpVerifyPanel', () => {
  /** Generate issues an email-delivered OTP and reveals the box. */
  it('generates an OTP and shows the box', async () => {
    renderPanel()
    await generate()
    expect(api.generateOtp).toHaveBeenCalledWith({
      tenantId: 'acme',
      recipient: 'demo@example.com',
      purpose: 'email_verification',
      deliverVia: 'email',
    })
  })

  /** A successful verify shows the success state, offers consume, and never leaks the code. */
  it('verifies a code, offers consume, and never renders the code', async () => {
    renderPanel()
    await generate()
    await user.click(screen.getByTestId('box'))
    await waitFor(() => expect(screen.getByText(/Code verified/)).toBeInTheDocument())
    expect(api.verifyOtp).toHaveBeenCalledWith({
      tenantId: 'acme',
      recipient: 'demo@example.com',
      purpose: 'email_verification',
      code: '123456',
    })
    expect(screen.getByRole('button', { name: 'Consume' })).toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toContain('123456')
  })

  /** A wrong code shows the localized message + the remaining attempts. */
  it('shows the localized message and remaining attempts on a wrong code', async () => {
    api.verifyOtp.mockResolvedValue({
      ok: false,
      code: NOTIFICATION_ERROR_CODES.OTP_INVALID_CODE,
      remainingAttempts: 2,
    })
    renderPanel()
    await generate()
    await user.click(screen.getByTestId('box'))
    await waitFor(() => expect(screen.getByText(/Incorrect code/)).toBeInTheDocument())
    expect(screen.getByText(/2 attempt\(s\) left/)).toBeInTheDocument()
    expect(screen.getByTestId('box')).not.toBeDisabled()
  })

  /** The max-attempts lockout disables the box and shows no countdown. */
  it('locks out on max attempts with no countdown', async () => {
    api.verifyOtp.mockResolvedValue({
      ok: false,
      code: NOTIFICATION_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED,
      remainingAttempts: null,
    })
    renderPanel()
    await generate()
    await user.click(screen.getByTestId('box'))
    await waitFor(() => expect(screen.getByText(/Too many failed attempts/)).toBeInTheDocument())
    expect(screen.queryByText(/attempt\(s\) left/)).toBeNull()
    expect(screen.getByTestId('box')).toBeDisabled()
  })

  /** The resend button is disabled while a cooldown is counting down. */
  it('disables resend during the cooldown', async () => {
    renderPanel()
    await generate()
    const resend = await screen.findByRole('button', { name: /Resend in/ })
    expect(resend).toBeDisabled()
    expect(resend).toHaveTextContent(/Resend in 0[01]:/)
  })

  /** With no cooldown the resend button is enabled and fires the resend. */
  it('enables and fires resend when the cooldown is clear', async () => {
    api.generateOtp.mockResolvedValue({
      ok: true,
      data: { expiresAt: Date.now() + 60_000, cooldownSeconds: 0 },
    })
    renderPanel()
    await generate()
    const resend = await screen.findByRole('button', { name: /^Resend$/ })
    await user.click(resend)
    expect(api.resendOtp).toHaveBeenCalled()
  })

  /** A cooldown rejection on generate surfaces the localized cooldown notice. */
  it('shows the cooldown notice when generate is throttled', async () => {
    api.generateOtp.mockResolvedValue({
      ok: false,
      code: NOTIFICATION_ERROR_CODES.OTP_COOLDOWN_ACTIVE,
      message: 'wait',
      retryAfterSeconds: 30,
    })
    renderPanel()
    await user.click(screen.getByRole('button', { name: /Generate/ }))
    await waitFor(() =>
      expect(screen.getByText(/Please wait before requesting/)).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('box')).toBeNull()
  })

  /** A network error on generate falls back to the generic message. */
  it('falls back to a generic message on a generate error', async () => {
    api.generateOtp.mockRejectedValue(new Error('offline'))
    renderPanel()
    await user.click(screen.getByRole('button', { name: /Generate/ }))
    await waitFor(() =>
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument(),
    )
  })

  /** Consuming clears the active session (the box disappears). */
  it('consumes a verified code and clears the box', async () => {
    renderPanel()
    await generate()
    await user.click(screen.getByTestId('box'))
    await user.click(await screen.findByRole('button', { name: 'Consume' }))
    await waitFor(() => expect(screen.queryByTestId('box')).toBeNull())
    expect(api.consumeOtp).toHaveBeenCalled()
  })

  /** Selecting password_reset drives the box to 8 alphanumeric slots. */
  it('drives the box length from the selected purpose', async () => {
    renderPanel()
    await user.click(screen.getByRole('combobox', { name: 'Purpose' }))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByRole('option', { name: 'Password reset' }))
    await generate()
    const box = screen.getByTestId('box')
    expect(box).toHaveAttribute('data-length', '8')
    expect(box).toHaveAttribute('data-type', 'alphanumeric')
  })

  /** An expiry surfaces the localized expired message and disables the box. */
  it('shows the expired message when the countdown elapses', async () => {
    renderPanel()
    await generate()
    await user.click(screen.getByTestId('expire'))
    await waitFor(() => expect(screen.getByText(/The code has expired/)).toBeInTheDocument())
    expect(screen.getByTestId('box')).toBeDisabled()
  })

  /** The recipient field feeds the generate request. */
  it('sends the edited recipient on generate', async () => {
    renderPanel()
    const recipient = screen.getByLabelText('Recipient')
    await user.clear(recipient)
    await user.type(recipient, 'jane@acme.com')
    await user.click(screen.getByRole('button', { name: /Generate/ }))
    await waitFor(() =>
      expect(api.generateOtp).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: 'jane@acme.com' }),
      ),
    )
  })

  /** A verify network error falls back to the generic message and resets. */
  it('falls back on a verify network error', async () => {
    api.verifyOtp.mockRejectedValue(new Error('offline'))
    renderPanel()
    await generate()
    await user.click(screen.getByTestId('box'))
    await waitFor(() =>
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument(),
    )
  })

  /** A consume network error falls back to the generic message. */
  it('falls back on a consume network error', async () => {
    api.consumeOtp.mockRejectedValue(new Error('offline'))
    renderPanel()
    await generate()
    await user.click(screen.getByTestId('box'))
    await user.click(await screen.findByRole('button', { name: 'Consume' }))
    await waitFor(() =>
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument(),
    )
  })

  /** A pending generate disables the button (the busy state). */
  it('disables the generate button while a request is in flight', async () => {
    api.generateOtp.mockReturnValue(new Promise(() => {}))
    renderPanel()
    await user.click(screen.getByRole('button', { name: /Generate/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Generate/ })).toBeDisabled())
  })

  /** A pending resend disables the resend button (the busy branch of the gate). */
  it('disables resend while a resend is in flight', async () => {
    api.generateOtp.mockResolvedValue({
      ok: true,
      data: { expiresAt: Date.now() + 60_000, cooldownSeconds: 0 },
    })
    api.resendOtp.mockReturnValue(new Promise(() => {}))
    renderPanel()
    await generate()
    const resend = await screen.findByRole('button', { name: /^Resend$/ })
    await user.click(resend)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Resend$/ })).toBeDisabled())
  })
})
