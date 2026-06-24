/**
 * Unit tests for {@link DispatchController}.
 *
 * `NotificationService` is mocked and a fake `ResolvedNotificationOptions` +
 * provider/storage/renderer doubles are injected directly (no DI container). The handler now
 * receives a prebuilt {@link DispatchInput} (the payload-mapping spreads are unit-proven in
 * `dispatch-input.decorator.spec.ts`), so these tests cover that it forwards that input verbatim,
 * propagates a service rejection (filter-mapped), `GET /channels`, and `GET /config/status`
 * (including the otp-present/absent and masking-active/identity branches).
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { NotificationException } from '@bymax-one/nest-notification'
import type {
  DispatchInput,
  IEmailProvider,
  IEmailTemplateRenderer,
  IOtpStorage,
  NotificationService,
  ResolvedNotificationOptions,
} from '@bymax-one/nest-notification'

import { DispatchController } from './dispatch.controller.js'
import { maskRecipient } from '../notification/notification.config.js'

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

  it('forwards the prebuilt dispatch input to the service and returns its result', async () => {
    /**
     * Scenario: the decorator has already built the trusted `DispatchInput`.
     * Contract: the handler passes it verbatim to `NotificationService.dispatch` (the interceptor
     * narrows on that same argument) and returns the result — no re-mapping in the controller.
     */
    const input: DispatchInput = {
      channel: 'email',
      tenantId: TENANT,
      payload: { to: 'jane@acme.com', subject: 'Hi', html: '<p>Hi</p>' },
    }
    ctx.notification.dispatch.mockReturnValue(
      Promise.resolve({ channel: 'email', messageId: 'm-1' }),
    )

    const result = await ctx.controller.dispatch(input)

    expect(ctx.notification.dispatch).toHaveBeenCalledWith(input)
    expect(result).toEqual({ channel: 'email', messageId: 'm-1' })
  })

  it('propagates a service rejection so the filter maps the catalog code', async () => {
    /** Scenario: the service throws a catalog exception. Contract: propagate it unchanged. */
    const input: DispatchInput = {
      channel: 'otp',
      tenantId: TENANT,
      payload: { recipient: 'jane@acme.com', purpose: 'login' },
    }
    ctx.notification.dispatch.mockReturnValue(
      Promise.reject(new NotificationException('CHANNEL_DISABLED')),
    )

    await expect(ctx.controller.dispatch(input)).rejects.toBeInstanceOf(NotificationException)
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

  it('detects active masking through the real masker applied to a non-PII probe', () => {
    /**
     * Scenario: the production `maskRecipient` (which masks a real address but leaves an empty
     * string unchanged) is wired.
     * Contract: `configStatus` reports `maskRecipient: true` because the fixed `probe@example.com`
     * probe is altered by the masker — proving the probe is a real address (an empty probe would be
     * left unchanged and mis-report masking as inactive).
     */
    const { controller, notification } = buildController(
      buildOptions({ otp: { consumeOnVerify: true }, mask: maskRecipient }),
    )
    notification.getEnabledChannels.mockReturnValue(['email', 'otp'])

    expect(controller.configStatus().maskRecipient).toBe(true)
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
