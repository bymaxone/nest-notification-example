/**
 * @fileoverview Component tests for {@link OtpCountdownPill}.
 *
 * Covers the active countdown (formatted remainder), the expired state, the
 * null-expiry branch (renders nothing), and that the optional onExpired callback
 * is forwarded to the hook.
 *
 * @module components/otp/otp-countdown-pill.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { OtpCountdownPill } from './otp-countdown-pill'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('OtpCountdownPill', () => {
  /** A future expiry renders the formatted remaining time. */
  it('renders the formatted countdown for an active OTP', () => {
    render(<OtpCountdownPill expiresAt={Date.now() + 90_000} />)
    expect(screen.getByText(/Expires in 01:30/)).toBeInTheDocument()
  })

  /** An expiry in the past renders the expired badge. */
  it('renders the expired state at zero', () => {
    render(<OtpCountdownPill expiresAt={Date.now() - 1000} />)
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  /** A null expiry renders nothing (no active OTP). */
  it('renders nothing when no OTP is active', () => {
    const { container } = render(<OtpCountdownPill expiresAt={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  /** The onExpired callback fires when an already-expired OTP mounts. */
  it('forwards onExpired to the hook', () => {
    const onExpired = vi.fn()
    render(<OtpCountdownPill expiresAt={Date.now() - 1000} onExpired={onExpired} />)
    expect(onExpired).toHaveBeenCalled()
  })
})
