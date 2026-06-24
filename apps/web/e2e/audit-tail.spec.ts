/**
 * @fileoverview Live audit-tail journey — a fresh delivery streams into the Explorer via SSE.
 *
 * Opens the Audit Explorer with the live tail on, triggers a send to a UNIQUE recipient
 * against the running API, and asserts the masked row appears without a manual refresh.
 * Proves the SSE live tail surfaces new audit events end-to-end (API → same-origin SSE proxy
 * → table). The unique recipient guarantees the asserted row was streamed, not seeded.
 *
 * @module e2e/audit-tail.spec
 */
import { expect, test } from '@playwright/test'

/** The running API origin (the test-stack API). */
const API_URL = 'http://localhost:3001'

test.describe('Audit live-tail journey', () => {
  test('a freshly-triggered delivery streams into the Explorer', async ({ page }) => {
    // With the live tail on, fire a send to a unique recipient and assert its masked audit row
    // streams in — protects the live SSE pipeline (the row can only appear via the stream).
    const recipient = `tail-${Date.now().toString()}@example.test`
    const maskedRecipient = recipient.replace(/^(.).*(@.*)$/, '$1***$2')

    await page.goto('/explorer?tenantId=acme&live=true')
    await expect(page.getByRole('button', { name: /live/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const res = await page.request.post(`${API_URL}/email/send`, {
      headers: { 'x-tenant-id': 'acme' },
      data: { to: recipient, subject: 'Live tail', html: '<p>tail</p>' },
    })
    expect(res.ok()).toBeTruthy()

    await expect(page.getByText(maskedRecipient)).toBeVisible({ timeout: 30_000 })
  })
})
