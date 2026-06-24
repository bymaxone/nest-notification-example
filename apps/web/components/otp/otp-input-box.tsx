/**
 * @fileoverview OtpInputBox — a segmented OTP entry box over `useOtpInput`.
 *
 * Renders N design-system inputs driven by the library's `useOtpInput` hook
 * (auto-advance, Backspace/Arrow navigation, clipboard distribution). The hook is
 * state/UX only — this wrapper never verifies the code; it surfaces the completed
 * code to the parent via `onComplete`. The plaintext code lives solely in the
 * hook's local state. Each slot honors `autoComplete="one-time-code"` + an
 * `inputMode` matching the character class, and the paste handler is on slot 0.
 *
 * @module components/otp/otp-input-box
 */

'use client'

import { useEffect } from 'react'
import {
  useOtpInput,
  type OtpInputType,
  type UseOtpInputOptions,
  type UseOtpInputState,
} from '@bymax-one/nest-notification/react'

import { Input } from '@/components/ui/input'

/** Props for {@link OtpInputBox}. */
export interface OtpInputBoxProps {
  /** Number of single-character slots. */
  length: number
  /** Character class each slot accepts (drives `inputMode`). */
  type: OtpInputType
  /** Fired (deferred) once every slot is filled — the parent verifies the code. */
  onComplete: (code: string) => void
  /** Disables every slot (e.g. while verifying or after a lockout). */
  disabled?: boolean
  /** Bump this to imperatively clear the box (after a generate or a wrong code). */
  resetToken?: number
}

/**
 * A segmented OTP input box wired to `useOtpInput`.
 *
 * @param props - {@link OtpInputBoxProps}.
 * @returns The row of single-character slots.
 */
export function OtpInputBox({
  length,
  type,
  onComplete,
  disabled = false,
  resetToken = 0,
}: OtpInputBoxProps) {
  const options: UseOtpInputOptions = { length, type, onComplete }
  const otp: UseOtpInputState = useOtpInput(options)
  const { reset } = otp

  // Clear (and refocus) the box whenever the parent bumps the reset token.
  useEffect(() => {
    reset()
  }, [reset, resetToken])

  const inputMode = type === 'numeric' ? 'numeric' : 'text'

  return (
    <div className="flex items-center gap-2" role="group" aria-label="One-time code">
      {otp.values.map((value, index) => (
        <Input
          key={`otp-slot-${index}`}
          ref={otp.refs[index]}
          value={value}
          onChange={otp.onChange(index)}
          onKeyDown={otp.onKeyDown(index)}
          onPaste={index === 0 ? otp.onPaste : undefined}
          maxLength={1}
          inputMode={inputMode}
          autoComplete="one-time-code"
          aria-label={`Digit ${index + 1}`}
          disabled={disabled}
          className="h-12 w-12 px-0 text-center font-mono text-lg"
        />
      ))}
    </div>
  )
}
