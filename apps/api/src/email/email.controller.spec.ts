/**
 * Unit tests for {@link EmailController}.
 *
 * The `EmailService` is a plain mock; the controller is constructed directly without DI.
 * Covers both routes returning `{ messageId }` (with all envelope optionals supplied and
 * with none — exercising both arms of every exactOptional-safe spread) and the oversize
 * attachment path, where the library throws `EMAIL_ATTACHMENTS_TOO_LARGE` and the
 * controller lets it propagate to the global filter (→ HTTP 413).
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { NotificationException } from '@bymax-one/nest-notification'

import { EmailController } from './email.controller.js'
import type { EmailService } from '@bymax-one/nest-notification'

/** Mocked surface of `EmailService` the controller touches. */
interface MockEmailService {
  send: ReturnType<typeof jest.fn>
  sendTemplate: ReturnType<typeof jest.fn>
}

/** Build an `EmailController` backed by a mock `EmailService`. */
function buildController(): { controller: EmailController; service: MockEmailService } {
  const service: MockEmailService = {
    send: jest.fn(),
    sendTemplate: jest.fn(),
  }
  const controller = new EmailController(service as unknown as EmailService)
  return { controller, service }
}

const TENANT = 'acme'

describe('EmailController.send', () => {
  let ctx: ReturnType<typeof buildController>

  beforeEach(() => {
    ctx = buildController()
  })

  it('forwards every supplied field and returns { messageId }', async () => {
    /**
     * Scenario: a full raw-send body with all envelope optionals set.
     * Contract: the controller adds the trusted tenant and forwards each optional —
     * covers the "present" arm of every exactOptional-safe spread; returns the messageId.
     */
    ctx.service.send.mockReturnValue(Promise.resolve({ messageId: 'm-1' }))

    const result = await ctx.controller.send(TENANT, {
      to: 'jane@acme.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      from: 'noreply@acme.com',
      fromName: 'Acme',
      replyTo: 'support@acme.com',
      cc: ['cc@acme.com'],
      bcc: 'bcc@acme.com',
      tags: [{ name: 'kind', value: 'welcome' }],
      attachments: [{ filename: 'a.txt', content: 'aGk=' }],
    })

    expect(ctx.service.send).toHaveBeenCalledWith({
      tenantId: TENANT,
      to: 'jane@acme.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      from: 'noreply@acme.com',
      fromName: 'Acme',
      replyTo: 'support@acme.com',
      cc: ['cc@acme.com'],
      bcc: 'bcc@acme.com',
      tags: [{ name: 'kind', value: 'welcome' }],
      attachments: [{ filename: 'a.txt', content: 'aGk=' }],
    })
    expect(result).toEqual({ messageId: 'm-1' })
  })

  it('omits absent optionals so the input stays exactOptional-safe', async () => {
    /**
     * Scenario: a minimal raw-send body (to + subject + html only).
     * Contract: no optional keys are added — covers the "absent" arm of every spread.
     */
    ctx.service.send.mockReturnValue(Promise.resolve({ messageId: 'm-2' }))

    await ctx.controller.send(TENANT, { to: 'jane@acme.com', subject: 'Hi', html: '<p>Hi</p>' })

    expect(ctx.service.send).toHaveBeenCalledWith({
      tenantId: TENANT,
      to: 'jane@acme.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
    })
    // Only the four required keys may be present — no absent optional (e.g. attachments) may leak
    // in as an `undefined`-valued key, which the recursive-equality matcher would silently accept.
    const input = ctx.service.send.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.keys(input).sort()).toEqual(['html', 'subject', 'tenantId', 'to'])
  })

  it('propagates EMAIL_ATTACHMENTS_TOO_LARGE so the filter maps it to 413', async () => {
    /**
     * Scenario: the library guards attachment size and throws.
     * Contract: the controller does NOT catch it — it propagates to the global filter,
     * which serializes the catalog 413. The guard lives in the library, never here.
     */
    ctx.service.send.mockReturnValue(
      Promise.reject(new NotificationException('EMAIL_ATTACHMENTS_TOO_LARGE')),
    )

    await expect(
      ctx.controller.send(TENANT, {
        to: 'jane@acme.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
        attachments: [{ filename: 'big.bin', content: 'x'.repeat(100) }],
      }),
    ).rejects.toBeInstanceOf(NotificationException)
  })
})

describe('EmailController.sendTemplate', () => {
  let ctx: ReturnType<typeof buildController>

  beforeEach(() => {
    ctx = buildController()
  })

  it('forwards every supplied field and returns { messageId }', async () => {
    /**
     * Scenario: a full template-send body with all optionals set.
     * Contract: the controller adds the trusted tenant and forwards each optional —
     * covers the "present" arm of every exactOptional-safe spread; returns the messageId.
     */
    ctx.service.sendTemplate.mockReturnValue(Promise.resolve({ messageId: 't-1' }))

    const result = await ctx.controller.sendTemplate(TENANT, {
      to: ['jane@acme.com'],
      template: 'welcome',
      data: { name: 'Jane' },
      locale: 'pt-BR',
      from: 'noreply@acme.com',
      fromName: 'Acme',
      replyTo: 'support@acme.com',
      tags: [{ name: 'kind', value: 'welcome' }],
    })

    expect(ctx.service.sendTemplate).toHaveBeenCalledWith({
      tenantId: TENANT,
      to: ['jane@acme.com'],
      template: 'welcome',
      data: { name: 'Jane' },
      locale: 'pt-BR',
      from: 'noreply@acme.com',
      fromName: 'Acme',
      replyTo: 'support@acme.com',
      tags: [{ name: 'kind', value: 'welcome' }],
    })
    expect(result).toEqual({ messageId: 't-1' })
  })

  it('omits absent optionals so the input stays exactOptional-safe', async () => {
    /**
     * Scenario: a minimal template-send body (to + template + data only).
     * Contract: no optional keys are added — covers the "absent" arm of every spread.
     */
    ctx.service.sendTemplate.mockReturnValue(Promise.resolve({ messageId: 't-2' }))

    await ctx.controller.sendTemplate(TENANT, {
      to: 'jane@acme.com',
      template: 'welcome',
      data: { name: 'Jane' },
    })

    expect(ctx.service.sendTemplate).toHaveBeenCalledWith({
      tenantId: TENANT,
      to: 'jane@acme.com',
      template: 'welcome',
      data: { name: 'Jane' },
    })
  })
})
