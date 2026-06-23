/**
 * @fileoverview HTTP controller for transactional email sends.
 * @layer app/email
 *
 * A thin surface over the library's `EmailService`: it parses each route's Zod DTO,
 * derives the trusted `tenantId` from the `x-tenant-id` header (never the body), and
 * returns the provider's `{ messageId }`. Rendering, HTML-escaping (html body only), the
 * locale fallback, and the attachment-size guard ALL live in the library — never here.
 * An oversize attachment makes `EmailService.send` throw `EMAIL_ATTACHMENTS_TOO_LARGE`,
 * which propagates to the global exception filter and surfaces as HTTP 413.
 *
 * @module
 */
import { Body, Controller, Post } from '@nestjs/common'
import {
  EmailService,
  type EmailSendInput,
  type EmailSendTemplateInput,
} from '@bymax-one/nest-notification'

import { TenantId } from '../common/tenant-id.decorator.js'
import {
  type EmailSendDto,
  type EmailSendTemplateDto,
  emailSendSchema,
  emailSendTemplateSchema,
} from './dto/email.dto.js'

/**
 * Builds an `EmailSendInput` from the trusted tenant + parsed DTO, adding each optional
 * envelope field ONLY when supplied (exactOptionalPropertyTypes-safe).
 *
 * @param tenantId - The trusted tenant id.
 * @param dto - The parsed raw-send body.
 * @returns The service input for `EmailService.send`.
 */
function toSendInput(tenantId: string, dto: EmailSendDto): EmailSendInput {
  return {
    tenantId,
    to: dto.to,
    subject: dto.subject,
    html: dto.html,
    ...(dto.text !== undefined ? { text: dto.text } : {}),
    ...(dto.from !== undefined ? { from: dto.from } : {}),
    ...(dto.fromName !== undefined ? { fromName: dto.fromName } : {}),
    ...(dto.replyTo !== undefined ? { replyTo: dto.replyTo } : {}),
    ...(dto.cc !== undefined ? { cc: dto.cc } : {}),
    ...(dto.bcc !== undefined ? { bcc: dto.bcc } : {}),
    ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
    ...(dto.attachments !== undefined ? { attachments: dto.attachments } : {}),
  }
}

/**
 * Builds an `EmailSendTemplateInput` from the trusted tenant + parsed DTO, adding each
 * optional field ONLY when supplied (exactOptionalPropertyTypes-safe).
 *
 * @param tenantId - The trusted tenant id.
 * @param dto - The parsed template-send body.
 * @returns The service input for `EmailService.sendTemplate`.
 */
function toTemplateInput(tenantId: string, dto: EmailSendTemplateDto): EmailSendTemplateInput {
  return {
    tenantId,
    to: dto.to,
    template: dto.template,
    data: dto.data,
    ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
    ...(dto.from !== undefined ? { from: dto.from } : {}),
    ...(dto.fromName !== undefined ? { fromName: dto.fromName } : {}),
    ...(dto.replyTo !== undefined ? { replyTo: dto.replyTo } : {}),
    ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
  }
}

/** REST controller exposing raw and template email sends. */
@Controller('email')
export class EmailController {
  constructor(private readonly email: EmailService) {}

  /**
   * Send an email whose subject/html the caller already produced.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id`.
   * @param body - Raw body validated against {@link emailSendSchema}.
   * @returns The provider's `{ messageId }`.
   */
  @Post('send')
  send(@TenantId() tenantId: string, @Body() body: unknown): Promise<{ messageId: string }> {
    return this.email.send(toSendInput(tenantId, emailSendSchema.parse(body)))
  }

  /**
   * Render a template (with an `en` fallback) and send the result.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id`.
   * @param body - Raw body validated against {@link emailSendTemplateSchema}.
   * @returns The provider's `{ messageId }`.
   */
  @Post('send-template')
  sendTemplate(
    @TenantId() tenantId: string,
    @Body() body: unknown,
  ): Promise<{ messageId: string }> {
    return this.email.sendTemplate(toTemplateInput(tenantId, emailSendTemplateSchema.parse(body)))
  }
}
