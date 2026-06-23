/**
 * @fileoverview OTP Verify page — one-time-passcode input and countdown.
 *
 * A thin Server Component shell with a placeholder body. The full OTP input
 * panel (using `useOtpInput` and `useOtpCountdown` from the library's React
 * subpath) will be added in a later iteration.
 *
 * @module app/otp/page
 */

import { AppShell } from '@/components/layout/app-shell'

export const dynamic = 'force-dynamic'

/**
 * OTP Verify page.
 *
 * @returns The OTP Verify placeholder inside the app shell.
 */
export default function OtpPage() {
  return (
    <AppShell>
      <section className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-white/55">OTP Verify — coming in a later iteration.</p>
      </section>
    </AppShell>
  )
}
