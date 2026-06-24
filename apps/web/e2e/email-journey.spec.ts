/**
 * @fileoverview Live email journey — raw + template sends land in Mailpit.
 *
 * Fires the Trigger Center "Send email" card (raw `EmailService.send`) and a registered
 * template send (`/email/send-template`), asserting each message actually arrives in the
 * Mailpit inbox. Proves the zero-credential email path delivers real, addressable mail
 * through both the raw and the template-render code paths.
 *
 * @module e2e/email-journey.spec
 */
import { expect, test } from '@playwright/test'

import { clearMailpit, waitForEmail } from './fixtures/mailpit'

/** The running API origin (the test-stack API). */
const API_URL = 'http://localhost:3001'

/** The demo recipient the Trigger Center "Send email" card targets. */
const DEMO_RECIPIENT = 'demo@example.com'

test.describe('Email live journey', () => {
  test.beforeEach(async () => {
    // Clear the inbox so each assertion polls only the mail this test produced.
    await clearMailpit()
  })

  test('the Send email card delivers a raw message to Mailpit', async ({ page }) => {
    // Fire the raw-send card and confirm the message reaches the inbox — protects the
    // EmailService.send → SMTP → Mailpit hop end-to-end through the real console UI.
    await page.goto('/trigger')
    const card = page.getByTestId('trigger-send-email')
    await card.getByRole('button', { name: /fire/i }).click()
    await expect(card.getByText(/HTTP 2\d\d/)).toBeVisible()

    await waitForEmail({ to: DEMO_RECIPIENT, subject: 'Hello from the console' })
  })

  test('a registered template send delivers to Mailpit', async ({ page }) => {
    // Send the 'welcome' template to a unique recipient and confirm it lands — protects the
    // template-render → send path (a unique address proves the mail is this run's, not seeded).
    const recipient = `tmpl-${Date.now().toString()}@example.test`
    const res = await page.request.post(`${API_URL}/email/send-template`, {
      headers: { 'x-tenant-id': 'acme' },
      data: { to: recipient, template: 'welcome', data: { name: 'Demo' } },
    })
    expect(res.ok()).toBeTruthy()

    await waitForEmail({ to: recipient })
  })
})
