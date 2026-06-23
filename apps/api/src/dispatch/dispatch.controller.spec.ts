/**
 * Unit tests for {@link DispatchController}.
 *
 * `NotificationService` is mocked and a fake `ResolvedNotificationOptions` +
 * provider/storage/renderer doubles are injected directly (no DI container). Covers the
 * dispatch façade for both channels (with all payload optionals supplied and with none —
 * exercising both arms of every exactOptional-safe spread), the EMAIL_MISSING_BODY and
 * CHANNEL_DISABLED propagation, `GET /channels`, and `GET /config/status` (including the
 * otp-present/absent and masking-active/identity branches).
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { NotificationException } from '@bymax-one/nest-notification'
import type {
  IEmailProvider,
  IEmailTemplateRenderer,
  IOtpStorage,
  NotificationService,
  ResolvedNotificationOptions,
} from '@bymax-one/nest-notification'

import { DispatchController } from './dispatch.controller.js'

/** Mocked surface of `NotificationService` the controller touches. */
interface MockNotification {
  dispatch: ReturnType<typeof jest.fn>
  getEnabledChannels: ReturnType<typeof jest.fn>
}

/** Build a fake `ResolvedNotificationOptions` for the config-status route. */
function buildOptions(over: {
  otp?: { consumeOnVerify: boolean }
  mask: (recipient: string) => string
}): ResolvedNotificationOptions {
  return {
    global: { redisNamespace: 'notification', defaultLocale: 'en' },
    ...(over.otp !== undefined ? { otp: over.otp } : {}),
    audit: { swallowErrors: true, maskRecipient: over.mask },
  } as unknown as ResolvedNotificationOptions
}

/** Build a `DispatchController` with a mock service + fake injected tokens. */
function buildController(options: ResolvedNotificationOptions): {
  controller: DispatchController
  notification: MockNotification
} {
  const notification: MockNotification = { dispatch: jest.fn(), getEnabledChannels: jest.fn() }
  const provider = { name: 'capture' } as unknown as IEmailProvider
  const storage = { name: 'memory' } as unknown as IOtpStorage
  const renderer = { name: 'default-interpolation' } as unknown as IEmailTemplateRenderer
  const controller = new DispatchController(
    notification as unknown as NotificationService,
    options,
    provider,
    storage,
    renderer,
  )
  return { controller, notification }
}

const TENANT = 'acme'
const MASKING = buildOptions({ otp: { consumeOnVerify: true }, mask: () => 'masked' })

describe('DispatchController.dispatch', () => {
  let ctx: ReturnType<typeof buildController>

  beforeEach(() => {
    ctx = buildController(MASKING)
  })

  it('builds an email DispatchInput with every supplied optional + trusted tenant', async () => {
    /**
     * Scenario: an email dispatch with all envelope optionals.
     * Contract: the controller injects the header tenant and forwards each optional —
     * covers the email branch + the "present" arm of every email-payload spread.
     */
    ctx.notification.dispatch.mockReturnValue(
      Promise.resolve({ channel: 'email', messageId: 'm-1' }),
    )

    const result = await ctx.controller.dispatch(TENANT, {
      channel: 'email',
      payload: {
        to: 'jane@acme.com',
        template: 'welcome',
        data: { name: 'Jane' },
        locale: 'pt-BR',
        subject: 'Hi',
        html: '<p>Hi</p>',
        text: 'Hi',
        from: 'noreply@acme.com',
        fromName: 'Acme',
        replyTo: 'support@acme.com',
        tags: [{ name: 'k', value: 'v' }],
      },
    })

    expect(ctx.notification.dispatch).toHaveBeenCalledWith({
      channel: 'email',
      tenantId: TENANT,
      payload: {
        to: 'jane@acme.com',
        template: 'welcome',
        data: { name: 'Jane' },
        locale: 'pt-BR',
        subject: 'Hi',
        html: '<p>Hi</p>',
        text: 'Hi',
        from: 'noreply@acme.com',
        fromName: 'Acme',
        replyTo: 'support@acme.com',
        tags: [{ name: 'k', value: 'v' }],
      },
    })
    expect(result).toEqual({ channel: 'email', messageId: 'm-1' })
  })

  it('builds a minimal email DispatchInput (no optionals) keeping it exactOptional-safe', async () => {
    /** Scenario: email dispatch with only `to`. Contract: covers the "absent" email spreads. */
    ctx.notification.dispatch.mockReturnValue(
      Promise.resolve({ channel: 'email', messageId: 'm-2' }),
    )

    await ctx.controller.dispatch(TENANT, { channel: 'email', payload: { to: 'jane@acme.com' } })

    expect(ctx.notification.dispatch).toHaveBeenCalledWith({
      channel: 'email',
      tenantId: TENANT,
      payload: { to: 'jane@acme.com' },
    })
  })

  it('builds an otp DispatchInput with every supplied optional + trusted tenant', async () => {
    /**
     * Scenario: an otp dispatch with all optionals.
     * Contract: covers the otp branch + the "present" arm of every otp-payload spread.
     */
    ctx.notification.dispatch.mockReturnValue(
      Promise.resolve({ channel: 'otp', result: { valid: true } }),
    )

    const result = await ctx.controller.dispatch(TENANT, {
      channel: 'otp',
      payload: {
        recipient: 'jane@acme.com',
        purpose: 'login',
        action: 'verify',
        code: '123456',
        deliverVia: 'manual',
        emailTemplate: 'otp_code',
        emailData: { name: 'Jane' },
        locale: 'pt-BR',
      },
    })

    expect(ctx.notification.dispatch).toHaveBeenCalledWith({
      channel: 'otp',
      tenantId: TENANT,
      payload: {
        recipient: 'jane@acme.com',
        purpose: 'login',
        action: 'verify',
        code: '123456',
        deliverVia: 'manual',
        emailTemplate: 'otp_code',
        emailData: { name: 'Jane' },
        locale: 'pt-BR',
      },
    })
    expect(result).toEqual({ channel: 'otp', result: { valid: true } })
  })

  it('builds a minimal otp DispatchInput (no optionals) keeping it exactOptional-safe', async () => {
    /** Scenario: otp dispatch with only recipient + purpose. Contract: covers "absent" otp spreads. */
    ctx.notification.dispatch.mockReturnValue(
      Promise.resolve({ channel: 'otp', result: undefined }),
    )

    await ctx.controller.dispatch(TENANT, {
      channel: 'otp',
      payload: { recipient: 'jane@acme.com', purpose: 'login' },
    })

    expect(ctx.notification.dispatch).toHaveBeenCalledWith({
      channel: 'otp',
      tenantId: TENANT,
      payload: { recipient: 'jane@acme.com', purpose: 'login' },
    })
  })

  it('propagates EMAIL_MISSING_BODY so the filter maps it to 400', async () => {
    /** Scenario: email payload with neither template nor subject+html. Contract: propagate. */
    ctx.notification.dispatch.mockReturnValue(
      Promise.reject(new NotificationException('EMAIL_MISSING_BODY')),
    )

    await expect(
      ctx.controller.dispatch(TENANT, { channel: 'email', payload: { to: 'jane@acme.com' } }),
    ).rejects.toBeInstanceOf(NotificationException)
  })

  it('propagates CHANNEL_DISABLED so the filter maps it to 501', async () => {
    /** Scenario: dispatch to a channel whose service is absent. Contract: propagate. */
    ctx.notification.dispatch.mockReturnValue(
      Promise.reject(new NotificationException('CHANNEL_DISABLED')),
    )

    await expect(
      ctx.controller.dispatch(TENANT, {
        channel: 'otp',
        payload: { recipient: 'jane@acme.com', purpose: 'login' },
      }),
    ).rejects.toBeInstanceOf(NotificationException)
  })
})

describe('DispatchController.channels / configStatus', () => {
  it('lists the enabled channels from the service', () => {
    /** Scenario: channel discovery. Contract: forward getEnabledChannels verbatim. */
    const { controller, notification } = buildController(MASKING)
    notification.getEnabledChannels.mockReturnValue(['email', 'otp'])

    expect(controller.channels()).toEqual(['email', 'otp'])
  })

  it('reports the resolved config: adapters, flags, active masking (no secrets)', () => {
    /**
     * Scenario: otp configured (consumeOnVerify true) + a non-identity masker.
     * Contract: the snapshot carries adapter names + flags; maskRecipient is `true`
     * (detected via a fixed probe) and no function/secret is exposed.
     */
    const { controller, notification } = buildController(MASKING)
    notification.getEnabledChannels.mockReturnValue(['email', 'otp'])

    expect(controller.configStatus()).toEqual({
      channels: ['email', 'otp'],
      provider: 'capture',
      storage: 'memory',
      renderer: 'default-interpolation',
      consumeOnVerify: true,
      swallowErrors: true,
      maskRecipient: true,
      defaultLocale: 'en',
    })
  })

  it('defaults consumeOnVerify to false and reports identity masking as inactive', () => {
    /**
     * Scenario: otp section absent + an identity masker.
     * Contract: `otp?.consumeOnVerify ?? false` → false (otp-absent branch); maskRecipient
     * is `false` (identity probe branch). Covers the remaining config-status branches.
     */
    const { controller, notification } = buildController(
      buildOptions({ mask: (recipient) => recipient }),
    )
    notification.getEnabledChannels.mockReturnValue(['email'])

    expect(controller.configStatus()).toEqual({
      channels: ['email'],
      provider: 'capture',
      storage: 'memory',
      renderer: 'default-interpolation',
      consumeOnVerify: false,
      swallowErrors: true,
      maskRecipient: false,
      defaultLocale: 'en',
    })
  })
})
