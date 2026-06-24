/**
 * @fileoverview Component tests for {@link OtpInputBox}.
 *
 * Covers the accessibility attributes, the numeric vs text inputMode branch, the
 * paste-on-first-slot distribution (firing onComplete), arrow/backspace
 * navigation, the disabled state, and the imperative reset via the reset token.
 *
 * @module components/otp/otp-input-box.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OtpInputBox } from './otp-input-box'

const user = userEvent.setup()

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Read the slot inputs in order. */
function slots(): HTMLInputElement[] {
  return screen.getAllByLabelText(/Character/) as HTMLInputElement[]
}

describe('OtpInputBox', () => {
  /** Each slot carries the one-time-code accessibility + numeric input attributes. */
  it('renders accessible numeric slots', () => {
    render(<OtpInputBox length={6} type="numeric" onComplete={vi.fn()} />)
    const inputs = slots()
    expect(inputs).toHaveLength(6)
    expect(inputs[0]).toHaveAttribute('autocomplete', 'one-time-code')
    expect(inputs[0]).toHaveAttribute('inputmode', 'numeric')
    expect(inputs[0]).toHaveAttribute('maxlength', '1')
    expect(inputs[0]).toHaveAttribute('aria-label', 'Character 1')
  })

  /** A non-numeric character class uses the text inputMode. */
  it('uses the text inputMode for alphanumeric codes', () => {
    render(<OtpInputBox length={8} type="alphanumeric" onComplete={vi.fn()} />)
    expect(slots()[0]).toHaveAttribute('inputmode', 'text')
    expect(slots()).toHaveLength(8)
  })

  /** Pasting into the first slot distributes the code and fires onComplete. */
  it('distributes a paste on the first slot and completes', async () => {
    const onComplete = vi.fn()
    render(<OtpInputBox length={6} type="numeric" onComplete={onComplete} />)
    await user.click(slots()[0]!)
    await user.paste('123456')
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('123456'))
  })

  /** A paste on a non-first slot does NOT distribute (handler is on slot 0 only). */
  it('does not distribute a paste on a later slot', async () => {
    const onComplete = vi.fn()
    render(<OtpInputBox length={6} type="numeric" onComplete={onComplete} />)
    await user.click(slots()[2]!)
    await user.paste('123456')
    expect(onComplete).not.toHaveBeenCalled()
    expect(slots()[0]!.value).toBe('')
  })

  /** Arrow and Backspace keys navigate and clear the previous slot. */
  it('navigates with arrows and clears the previous slot on Backspace', () => {
    render(<OtpInputBox length={6} type="numeric" onComplete={vi.fn()} />)
    const inputs = slots()
    fireEvent.change(inputs[0]!, { target: { value: '1' } })
    expect(inputs[0]!.value).toBe('1')
    fireEvent.keyDown(inputs[1]!, { key: 'ArrowLeft' })
    fireEvent.keyDown(inputs[0]!, { key: 'ArrowRight' })
    // Backspace on an empty slot clears and refocuses the previous one.
    fireEvent.keyDown(inputs[1]!, { key: 'Backspace' })
    expect(inputs[0]!.value).toBe('')
  })

  /** The disabled flag disables every slot. */
  it('disables every slot when disabled', () => {
    render(<OtpInputBox length={6} type="numeric" onComplete={vi.fn()} disabled />)
    expect(slots()[0]).toBeDisabled()
  })

  /** Bumping the reset token clears the box. */
  it('clears the box when the reset token changes', () => {
    const { rerender } = render(
      <OtpInputBox length={6} type="numeric" onComplete={vi.fn()} resetToken={0} />,
    )
    fireEvent.change(slots()[0]!, { target: { value: '1' } })
    expect(slots()[0]!.value).toBe('1')
    rerender(<OtpInputBox length={6} type="numeric" onComplete={vi.fn()} resetToken={1} />)
    expect(slots()[0]!.value).toBe('')
  })
})
