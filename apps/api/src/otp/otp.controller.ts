/**
 * @fileoverview HTTP controller for the OTP lifecycle.
 * @layer app/otp
 *
 * A thin surface over the library's `OtpService`: it parses each route's Zod DTO, derives
 * the trusted `tenantId` from the `x-tenant-id` header (never the body), and translates
 * the result to HTTP. `verify` NEVER throws for a wrong/missing/exhausted code — it
 * returns a discriminated `OtpVerifyResult` that {@link mapOtpVerifyResult} maps to a
 * status set via `@Res({ passthrough: true })` so interceptors still run. The
 * generate/resend cooldown propagates `OTP_COOLDOWN_ACTIVE` to the global exception
 * filter, which attaches the `Retry-After` header; the verify `max_attempts` 429 has no
 * cooldown and therefore no `Retry-After`.
 *
 * @module
 */
import { Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common'
import {
  OtpService,
  type OtpGenerateInput,
  type OtpGenerateResult,
  type OtpStatusResult,
} from '@bymax-one/nest-notification'
import type { Response } from 'express'

import { TenantId } from '../common/tenant-id.decorator.js'
import {
  type OtpGenerateDto,
  otpConsumeSchema,
  otpGenerateSchema,
  otpResendSchema,
  otpStatusSchema,
  otpVerifySchema,
} from './dto/otp.dto.js'
import { mapOtpVerifyResult } from './otp-verify-mapping.js'

/**
 * Builds an `OtpGenerateInput` from the trusted tenant + parsed DTO, including each
 * optional field ONLY when it was supplied — keeping the spread `exactOptionalProperty
 * Types`-safe (the input's optionals do not admit an explicit `undefined`).
 *
 * @param tenantId - The trusted tenant id.
 * @param dto - The parsed generate/resend body.
 * @returns The service input for `generate` / `resend`.
 */
function toGenerateInput(tenantId: string, dto: OtpGenerateDto): OtpGenerateInput {
  return {
    tenantId,
    recipient: dto.recipient,
    purpose: dto.purpose,
    ...(dto.deliverVia !== undefined ? { deliverVia: dto.deliverVia } : {}),
    ...(dto.emailTemplate !== undefined ? { emailTemplate: dto.emailTemplate } : {}),
    ...(dto.emailData !== undefined ? { emailData: dto.emailData } : {}),
    ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
  }
}

/** REST controller exposing the full OTP lifecycle over HTTP. */
@Controller('otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  /**
   * Generate and (optionally) deliver an OTP.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id`.
   * @param body - Raw body validated against {@link otpGenerateSchema}.
   * @returns The expiry timestamp and resend cooldown length.
   */
  @Post('generate')
  generate(@TenantId() tenantId: string, @Body() body: unknown): Promise<OtpGenerateResult> {
    return this.otp.generate(toGenerateInput(tenantId, otpGenerateSchema.parse(body)))
  }

  /**
   * Resend an OTP — a functional alias of generate that shares the cooldown lock.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id`.
   * @param body - Raw body validated against {@link otpResendSchema}.
   * @returns The expiry timestamp and resend cooldown length.
   */
  @Post('resend')
  resend(@TenantId() tenantId: string, @Body() body: unknown): Promise<OtpGenerateResult> {
    return this.otp.resend(toGenerateInput(tenantId, otpResendSchema.parse(body)))
  }

  /**
   * Verify a guessed code. Never throws on a wrong/missing/exhausted code — the mapped
   * status (200/401/404/429) is set on the passthrough response and the body returned.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id`.
   * @param body - Raw body validated against {@link otpVerifySchema}.
   * @param res - Express response (passthrough — interceptors still run).
   * @returns The mapped verification body (never the code).
   */
  @Post('verify')
  async verify(
    @TenantId() tenantId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const input = otpVerifySchema.parse(body)
    const result = await this.otp.verify({ tenantId, ...input })
    const mapped = mapOtpVerifyResult(result)
    // max_attempts → 429 carries NO Retry-After here: verify has no cooldown to wait on.
    res.status(mapped.status)
    return mapped.body
  }

  /**
   * Consume (delete) an OTP and clear its cooldown. Idempotent → 204 No Content.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id`.
   * @param body - Raw body validated against {@link otpConsumeSchema}.
   */
  @Post('consume')
  @HttpCode(204)
  async consume(@TenantId() tenantId: string, @Body() body: unknown): Promise<void> {
    await this.otp.consume({ tenantId, ...otpConsumeSchema.parse(body) })
  }

  /**
   * Read the current OTP status — existence, expiry, attempt counters, cooldown — but
   * never the plaintext code.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id`.
   * @param query - Raw query validated against {@link otpStatusSchema}.
   * @returns The code-free OTP status.
   */
  @Get('status')
  status(@TenantId() tenantId: string, @Query() query: unknown): Promise<OtpStatusResult> {
    return this.otp.getStatus({ tenantId, ...otpStatusSchema.parse(query) })
  }
}
