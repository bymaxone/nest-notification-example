/**
 * @fileoverview Mailpit polling helpers for the live Playwright journeys.
 *
 * The zero-credential email path delivers through SMTP into Mailpit; these helpers
 * read the captured mail back via Mailpit's HTTP API so a journey can assert the
 * OTP/email actually left the building. `waitForEmail` polls until a message
 * matching the recipient (and optional subject) arrives or the deadline elapses;
 * `extractOtp` pulls the 6-digit code out of the rendered body.
 *
 * @module e2e/fixtures/mailpit
 */

/** Mailpit HTTP API base — overridable so CI/test can point at the test-stack port. */
const MAILPIT_URL = process.env['MAILPIT_URL'] ?? 'http://127.0.0.1:8025'

/** A Mailpit message summary as returned by `GET /api/v1/messages`. */
interface MailpitMessage {
  /** Mailpit message id used to fetch the full body. */
  ID: string
  /** Recipients of the message. */
  To: Array<{ Address: string }>
  /** The message subject. */
  Subject: string
}

/** The `GET /api/v1/messages` envelope. */
interface MailpitMessagesResponse {
  /** The most-recent messages, newest first. */
  messages: MailpitMessage[]
}

/** The `GET /api/v1/message/:id` body. */
interface MailpitMessageDetail {
  /** Rendered HTML body (empty when the message is text-only). */
  HTML: string
  /** Plain-text body. */
  Text: string
}

/** A criterion that narrows which captured message a journey is waiting for. */
export interface MailMatch {
  /** Recipient address the message must be addressed to (case-insensitive). */
  to: string
  /** Optional case-insensitive substring the subject must contain. */
  subject?: string
}

/** Resolve after `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Whether a captured message satisfies the match criterion. */
function matches(message: MailpitMessage, criteria: MailMatch): boolean {
  const toMatch = message.To.some((t) => t.Address.toLowerCase() === criteria.to.toLowerCase())
  if (!toMatch) return false
  if (criteria.subject === undefined) return true
  return message.Subject.toLowerCase().includes(criteria.subject.toLowerCase())
}

/**
 * Poll Mailpit until a message matching `criteria` arrives, then return its body.
 *
 * @param criteria - The recipient (and optional subject) to wait for.
 * @param timeoutMs - Maximum wait before giving up (default 15s).
 * @returns The matching message's HTML body (falling back to its text body).
 * @throws When no matching message arrives within the timeout, or Mailpit errors.
 */
export async function waitForEmail(criteria: MailMatch, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`)
    if (!res.ok) throw new Error(`Mailpit list failed: ${res.status.toString()}`)
    const data = (await res.json()) as MailpitMessagesResponse
    const match = data.messages.find((message) => matches(message, criteria))
    if (match) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`)
      if (!detail.ok) throw new Error(`Mailpit detail failed: ${detail.status.toString()}`)
      const body = (await detail.json()) as MailpitMessageDetail
      return body.HTML !== '' ? body.HTML : body.Text
    }
    await sleep(250)
  }
  throw new Error(`No email to '${criteria.to}' arrived within ${timeoutMs.toString()}ms`)
}

/**
 * Clear every captured message so a journey reads only its own mail.
 *
 * @throws When the delete request fails.
 */
export async function clearMailpit(): Promise<void> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Mailpit clear failed: ${res.status.toString()}`)
}

/**
 * Extract the first 6-digit OTP from an email body.
 *
 * @param body - The rendered HTML or text body.
 * @returns The 6-digit OTP string.
 * @throws When no 6-digit code is present.
 */
export function extractOtp(body: string): string {
  const match = body.match(/\b(\d{6})\b/)
  if (match?.[1]) return match[1]
  throw new Error('Could not extract a 6-digit OTP from the email body')
}
