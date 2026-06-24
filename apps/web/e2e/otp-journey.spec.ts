/**
 * @fileoverview Live OTP journey — generate → Mailpit → verify against the running stack.
 *
 * Drives the real OTP Verify page: generate an email-delivered code, read the actual code
 * back out of Mailpit, type it into the segmented box, and assert the live verify succeeds.
 * Proves the end-to-end OTP path (issue → SMTP → inbox → verify) wires the library hooks to
 * a real backend — the code is never read from the DOM, a URL, or a log.
 *
 * @module e2e/otp-journey.spec
 */
import { expect, test } from '@playwright/test'

import { clearMailpit, extractOtp, waitForEmail } from './fixtures/mailpit'

/** The demo recipient the OTP page issues codes to. */
const DEMO_RECIPIENT = 'demo@example.com'

test.describe('OTP live journey', () => {
  test.beforeEach(async () => {
    // Start from an empty inbox so the polled OTP belongs to THIS run, not a leftover.
    await clearMailpit()
  })

  test('generate → Mailpit → verify lands a verified code', async ({ page }) => {
    // Generate an email OTP, pull the real 6-digit code from Mailpit, enter it, and assert the
    // success state — protects the full issue-deliver-verify round-trip against a regression in
    // any single hop (controller, transport, or the box→verify wiring).
    await page.goto('/otp')
    const generateButton = page.getByRole('button', { name: /generate/i })
    await expect(generateButton).toBeEnabled()
    // `next dev` compiles /otp on first hit, so the SSR Generate button can be in the DOM before
    // React wires its handler — a bare click would no-op and no code would be issued. Retry the
    // click until the generate request actually succeeds, then poll Mailpit for the code.
    // `POST /otp/generate` returns 201 Created, so accept any 2xx (`ok()`), not just 200.
    await expect(async () => {
      await generateButton.click()
      await page.waitForResponse(
        (response) => response.url().includes('/otp/generate') && response.ok(),
        { timeout: 5_000 },
      )
    }).toPass({ timeout: 30_000 })

    const body = await waitForEmail({ to: DEMO_RECIPIENT })
    const code = extractOtp(body)
    expect(code).toMatch(/^\d{6}$/)

    const box = page.getByRole('group', { name: 'One-time code' })
    await box.getByRole('textbox').first().click()
    await page.keyboard.type(code, { delay: 30 })

    await expect(page.getByText('Code verified.')).toBeVisible()
  })
})
