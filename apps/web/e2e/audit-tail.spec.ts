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

/** Same-origin SSE proxy path the console's `EventSource` connects to (the Next.js route). */
const STREAM_PATH = '/api/audit/stream'

test.describe('Audit live-tail journey', () => {
  test('a freshly-triggered delivery streams into the Explorer', async ({ page }) => {
    // With the live tail on, fire a send to a unique recipient and assert its masked audit row
    // streams in — protects the live SSE pipeline (the row can only appear via the stream).
    const recipient = `tail-${Date.now().toString()}@example.test`
    const maskedRecipient = recipient.replace(/^(.).*(@.*)$/, '$1***$2')

    // Arm the wait for the SSE stream response BEFORE navigating, so the connection can never be
    // missed. `waitForResponse` on the long-lived stream resolves the moment its response HEADERS
    // arrive — i.e. the API accepted the stream and registered the live subscription server-side —
    // which is the reliable "safe to trigger" signal. Triggering the send before the stream is
    // open would race the audit event ahead of the subscription, so it would neither be streamed
    // nor appear in the initial snapshot (taken at page load), and the masked row would never show.
    const streamOpen = page.waitForResponse(
      (response) => response.url().includes(STREAM_PATH) && response.status() === 200,
      { timeout: 30_000 },
    )

    await page.goto('/explorer?tenantId=acme&live=true')
    await expect(page.getByRole('button', { name: /live/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await streamOpen

    const res = await page.request.post(`${API_URL}/email/send`, {
      headers: { 'x-tenant-id': 'acme' },
      data: { to: recipient, subject: 'Live tail', html: '<p>tail</p>' },
    })
    expect(res.ok()).toBeTruthy()

    await expect(page.getByText(maskedRecipient)).toBeVisible({ timeout: 30_000 })
  })
})
