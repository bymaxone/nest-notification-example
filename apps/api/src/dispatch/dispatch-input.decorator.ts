/**
 * @fileoverview Param decorator that materializes the trusted `DispatchInput` for `POST /dispatch`.
 * @layer app/dispatch
 *
 * The library's `NotificationAuditInterceptor` records a `sent`/`failed` audit row only when one
 * of `context.getArgs()` is shaped like a `DispatchInput` (`channel` + string `tenantId` +
 * `payload`). For an HTTP `APP_INTERCEPTOR`, NestJS builds that context from the host arguments
 * `[req, res, next]` — NOT the mapped handler params — so a handler taking `@Body()` + `@TenantId()`
 * never presents a matching argument and the Explorer's `__interceptor__` source stays empty.
 *
 * This decorator closes that gap: it parses the body against {@link dispatchSchema}, injects the
 * trusted `x-tenant-id` (never the body — the forged-tenant vector stays closed), and then exposes
 * the dispatch shape (`channel`/`tenantId`/`payload`) on the request object itself — which IS the
 * first host argument the interceptor inspects — so every HTTP dispatch produces a real interceptor
 * row. The row stays masked and code-free: the interceptor records only the channel, masked
 * recipient, and purpose — never the dispatched payload (which an OTP `verify` carries a code in).
 * The fields are attached per-request, only on `/dispatch`, so no other route is ever mis-audited.
 *
 * @module
 */
import { BadRequestException, type ExecutionContext, createParamDecorator } from '@nestjs/common'
import type {
  DispatchInput,
  EmailDispatchPayload,
  OtpDispatchPayload,
} from '@bymax-one/nest-notification'

import { resolveTenantId } from '../common/tenant-id.decorator.js'
import { MAX_REPORTED_ISSUES } from '../common/zod-validation.pipe.js'
import {
  type DispatchDto,
  type EmailDispatchPayloadDto,
  type OtpDispatchPayloadDto,
  dispatchSchema,
} from './dto/dispatch.dto.js'

/**
 * The request surface this decorator reads and augments: the body + tenant header it reads, plus
 * the dispatch fields it attaches so the library's audit interceptor (which inspects the HTTP host
 * argument) can record the `__interceptor__` boundary row.
 */
interface DispatchRequest {
  /** The parsed JSON request body (validated against {@link dispatchSchema}). */
  body: unknown
  /** Request headers — only the trusted `x-tenant-id` is consulted. */
  headers: Record<string, string | string[] | undefined>
  /** Channel exposed for the interceptor's `isDispatchInput` narrowing. */
  channel?: DispatchInput['channel']
  /** Trusted tenant exposed for the interceptor's `isDispatchInput` narrowing. */
  tenantId?: string
  /** Dispatch payload exposed for the interceptor's `isDispatchInput` narrowing. */
  payload?: DispatchInput['payload']
}

/**
 * Builds an `EmailDispatchPayload` from the parsed DTO, adding each optional field ONLY when
 * supplied (exactOptionalPropertyTypes-safe).
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
 * Builds an `OtpDispatchPayload` from the parsed DTO, adding each optional field ONLY when
 * supplied (exactOptionalPropertyTypes-safe).
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
 * @param tenantId - The trusted tenant id (resolved from `x-tenant-id`).
 * @param dto - The parsed dispatch body.
 * @returns The library dispatch input.
 */
export function toDispatchInput(tenantId: string, dto: DispatchDto): DispatchInput {
  if (dto.channel === 'email') {
    return { channel: 'email', tenantId, payload: toEmailDispatchPayload(dto.payload) }
  }
  return { channel: 'otp', tenantId, payload: toOtpDispatchPayload(dto.payload) }
}

/**
 * Parse a raw `/dispatch` body and pair it with the trusted tenant into a `DispatchInput`.
 *
 * Validates with {@link dispatchSchema} (a `BadRequestException` carrying bounded `{ path, message }`
 * issues on failure — never echoing the rejected value), then resolves the tenant from the trusted
 * `x-tenant-id` header so a body-forged tenant is ignored.
 *
 * @param body - The raw request body.
 * @param tenantHeader - The raw `x-tenant-id` header value.
 * @returns The trusted, fully-formed dispatch input.
 * @throws {BadRequestException} When the body fails schema validation.
 */
export function buildDispatchInput(
  body: unknown,
  tenantHeader: string | string[] | undefined,
): DispatchInput {
  const result = dispatchSchema.safeParse(body)
  if (!result.success) {
    const errors = result.error.issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    throw new BadRequestException({ message: 'Validation failed', errors })
  }
  return toDispatchInput(resolveTenantId(tenantHeader), result.data)
}

/**
 * Decorator factory: read the request body + `x-tenant-id`, returning the trusted dispatch input.
 *
 * Exported so it is unit-testable directly without an HTTP harness.
 *
 * @param _data - Unused decorator metadata.
 * @param ctx - The NestJS execution context for the current request.
 * @returns The trusted dispatch input the handler (and the interceptor) receive.
 * @throws {BadRequestException} When the body fails schema validation.
 */
export function dispatchInputFactory(_data: unknown, ctx: ExecutionContext): DispatchInput {
  const request = ctx.switchToHttp().getRequest<DispatchRequest>()
  const input = buildDispatchInput(request.body, request.headers['x-tenant-id'])
  // Expose the dispatch shape on the request — the first host argument the library's audit
  // interceptor narrows on — so the masked `__interceptor__` boundary row is recorded.
  request.channel = input.channel
  request.tenantId = input.tenantId
  request.payload = input.payload
  return input
}

/**
 * Param decorator injecting the trusted {@link DispatchInput} for `POST /dispatch`.
 *
 * The handler argument it produces is the shape the library's `NotificationAuditInterceptor`
 * narrows on, so every HTTP dispatch records a masked, code-free `__interceptor__` audit row.
 */
export const DispatchInputParam = createParamDecorator(dispatchInputFactory)
