/**
 * @fileoverview HTTP controller for the unified dispatch façade + introspection reads.
 * @layer app/dispatch
 *
 * `POST /dispatch` is the ONE route audited by the `NotificationAuditInterceptor` (an
 * `APP_INTERCEPTOR` from the root module): the interceptor records the entry using the
 * resolver-derived tenant, which OVERRIDES any tenant a caller might forge in the body —
 * so this controller never re-implements auditing, it only passes the header-derived
 * `tenantId` into the service input. `GET /channels` lists the enabled channels;
 * `GET /config/status` exposes a read-only view of the resolved module config (no
 * secrets) so the console can prove which adapters/flags are wired.
 *
 * @module
 */
import { Body, Controller, Get, Inject, Post } from '@nestjs/common'
import {
  BYMAX_NOTIFICATION_EMAIL_PROVIDER,
  BYMAX_NOTIFICATION_OPTIONS,
  BYMAX_NOTIFICATION_OTP_STORAGE,
  BYMAX_NOTIFICATION_TEMPLATE_RENDERER,
  NotificationService,
  type DispatchInput,
  type DispatchResult,
  type EmailDispatchPayload,
  type IEmailProvider,
  type IEmailTemplateRenderer,
  type IOtpStorage,
  type NotificationChannel,
  type OtpDispatchPayload,
  type ResolvedNotificationOptions,
} from '@bymax-one/nest-notification'

import { TenantId } from '../common/tenant-id.decorator.js'
import {
  type DispatchDto,
  type EmailDispatchPayloadDto,
  type OtpDispatchPayloadDto,
  dispatchSchema,
} from './dto/dispatch.dto.js'

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

/**
 * Builds an `EmailDispatchPayload` from the parsed DTO, adding each optional field ONLY
 * when supplied (exactOptionalPropertyTypes-safe).
 *
 * @param dto - The parsed email dispatch payload.
 * @returns The library email dispatch payload.
 */
function toEmailDispatchPayload(dto: EmailDispatchPayloadDto): EmailDispatchPayload {
  return {
    to: dto.to,
    ...(dto.template !== undefined ? { template: dto.template } : {}),
    ...(dto.data !== undefined ? { data: dto.data } : {}),
    ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
    ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
    ...(dto.html !== undefined ? { html: dto.html } : {}),
    ...(dto.text !== undefined ? { text: dto.text } : {}),
    ...(dto.from !== undefined ? { from: dto.from } : {}),
    ...(dto.fromName !== undefined ? { fromName: dto.fromName } : {}),
    ...(dto.replyTo !== undefined ? { replyTo: dto.replyTo } : {}),
    ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
  }
}

/**
 * Builds an `OtpDispatchPayload` from the parsed DTO, adding each optional field ONLY
 * when supplied (exactOptionalPropertyTypes-safe).
 *
 * @param dto - The parsed OTP dispatch payload.
 * @returns The library OTP dispatch payload.
 */
function toOtpDispatchPayload(dto: OtpDispatchPayloadDto): OtpDispatchPayload {
  return {
    recipient: dto.recipient,
    purpose: dto.purpose,
    ...(dto.action !== undefined ? { action: dto.action } : {}),
    ...(dto.code !== undefined ? { code: dto.code } : {}),
    ...(dto.deliverVia !== undefined ? { deliverVia: dto.deliverVia } : {}),
    ...(dto.emailTemplate !== undefined ? { emailTemplate: dto.emailTemplate } : {}),
    ...(dto.emailData !== undefined ? { emailData: dto.emailData } : {}),
    ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
  }
}

/**
 * Builds the discriminated `DispatchInput`, injecting the trusted header tenant.
 *
 * @param tenantId - The trusted tenant id.
 * @param dto - The parsed dispatch body.
 * @returns The library dispatch input.
 */
function toDispatchInput(tenantId: string, dto: DispatchDto): DispatchInput {
  if (dto.channel === 'email') {
    return { channel: 'email', tenantId, payload: toEmailDispatchPayload(dto.payload) }
  }
  return { channel: 'otp', tenantId, payload: toOtpDispatchPayload(dto.payload) }
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
   * @param tenantId - The trusted tenant from `x-tenant-id`.
   * @param body - Raw body validated against {@link dispatchSchema}.
   * @returns The channel-discriminated dispatch result.
   */
  @Post('dispatch')
  dispatch(@TenantId() tenantId: string, @Body() body: unknown): Promise<DispatchResult> {
    return this.notification.dispatch(toDispatchInput(tenantId, dispatchSchema.parse(body)))
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
