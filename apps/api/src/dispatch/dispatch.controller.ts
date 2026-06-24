/**
 * @fileoverview HTTP controller for the unified dispatch façade + introspection reads.
 * @layer app/dispatch
 *
 * `POST /dispatch` is the ONE route audited by the `NotificationAuditInterceptor` (an
 * `APP_INTERCEPTOR` from the root module). The handler takes a single {@link DispatchInputParam}
 * argument — the trusted, header-tenant `DispatchInput` the interceptor narrows on — so every HTTP
 * dispatch records a masked, code-free `__interceptor__` audit row. The interceptor's
 * resolver-derived tenant OVERRIDES any tenant a caller might forge in the body, so this controller
 * never re-implements auditing. `GET /channels` lists the enabled channels; `GET /config/status`
 * exposes a read-only view of the resolved module config (no secrets) so the console can prove
 * which adapters/flags are wired.
 *
 * @module
 */
import { Controller, Get, Inject, Post } from '@nestjs/common'
import {
  BYMAX_NOTIFICATION_EMAIL_PROVIDER,
  BYMAX_NOTIFICATION_OPTIONS,
  BYMAX_NOTIFICATION_OTP_STORAGE,
  BYMAX_NOTIFICATION_TEMPLATE_RENDERER,
  NotificationService,
  type DispatchInput,
  type DispatchResult,
  type IEmailProvider,
  type IEmailTemplateRenderer,
  type IOtpStorage,
  type NotificationChannel,
  type ResolvedNotificationOptions,
} from '@bymax-one/nest-notification'

import { DispatchInputParam } from './dispatch-input.decorator.js'

/** A fixed, non-PII sample used only to detect whether a recipient masker is active. */
const MASK_PROBE = 'probe@example.com'

/** Read-only view of the resolved module config exposed by `GET /config/status`. */
export interface NotificationConfigStatus {
  channels: NotificationChannel[]
  provider: string
  storage: string
  renderer: string
  consumeOnVerify: boolean
  swallowErrors: boolean
  maskRecipient: boolean
  defaultLocale: string
}

/** REST controller exposing the dispatch façade, channel discovery, and config introspection. */
@Controller()
export class DispatchController {
  constructor(
    private readonly notification: NotificationService,
    @Inject(BYMAX_NOTIFICATION_OPTIONS) private readonly options: ResolvedNotificationOptions,
    @Inject(BYMAX_NOTIFICATION_EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    @Inject(BYMAX_NOTIFICATION_OTP_STORAGE) private readonly otpStorage: IOtpStorage,
    @Inject(BYMAX_NOTIFICATION_TEMPLATE_RENDERER) private readonly renderer: IEmailTemplateRenderer,
  ) {}

  /**
   * Dispatch a notification through the channel named in the body. This is the
   * interceptor-audited route — the audited tenant is resolver-derived.
   *
   * The single argument is the trusted {@link DispatchInput} built by {@link DispatchInputParam}
   * (body validated, tenant taken from `x-tenant-id`); exposing exactly this shape is what lets the
   * `NotificationAuditInterceptor` record the `__interceptor__` row for the HTTP boundary.
   *
   * @param input - The trusted, header-tenant dispatch input.
   * @returns The channel-discriminated dispatch result.
   */
  @Post('dispatch')
  dispatch(@DispatchInputParam() input: DispatchInput): Promise<DispatchResult> {
    return this.notification.dispatch(input)
  }

  /**
   * List the channels whose service is configured and ready.
   *
   * @returns The enabled channels (e.g. `['email', 'otp']`).
   */
  @Get('channels')
  channels(): NotificationChannel[] {
    return this.notification.getEnabledChannels()
  }

  /**
   * Read-only introspection of the resolved module config — adapters and flags, no
   * secrets. `maskRecipient` reports whether a non-identity masker is active (detected by
   * applying it to a fixed, non-PII probe), never the masker itself.
   *
   * @returns The resolved-config snapshot.
   */
  @Get('config/status')
  configStatus(): NotificationConfigStatus {
    const { audit, otp, global } = this.options
    return {
      channels: this.notification.getEnabledChannels(),
      provider: this.emailProvider.name,
      storage: this.otpStorage.name,
      renderer: this.renderer.name,
      consumeOnVerify: otp?.consumeOnVerify ?? false,
      swallowErrors: audit.swallowErrors,
      maskRecipient: audit.maskRecipient(MASK_PROBE) !== MASK_PROBE,
      defaultLocale: global.defaultLocale,
    }
  }
}
