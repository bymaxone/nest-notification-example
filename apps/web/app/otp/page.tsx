/**
 * @fileoverview OTP Verify page — segmented box + countdown + live verify.
 *
 * A thin Server Component shell that mounts the `'use client'` OTP verify panel
 * (the library's `useOtpInput` + `useOtpCountdown` hooks driving a real verify
 * against the backend). Marked `force-dynamic` so the URL-driven active tenant is
 * read per request.
 *
 * @module app/otp/page
 */

import { AppShell } from '@/components/layout/app-shell'
import { OtpVerifyPanel } from '@/components/otp/otp-verify-panel'

export const dynamic = 'force-dynamic'

/**
 * OTP Verify page.
 *
 * @returns The OTP verify panel inside the app shell.
 */
export default function OtpPage() {
  return (
    <AppShell>
      <OtpVerifyPanel />
    </AppShell>
  )
}
