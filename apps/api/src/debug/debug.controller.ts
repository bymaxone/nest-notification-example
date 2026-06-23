/**
 * @fileoverview Dev-only debug controller exposing the derived OTP storage key.
 * @layer app/debug
 *
 * `GET /debug/key` returns the opaque `sha256(tenantId:recipient)` storage-key fragment
 * the OTP backend uses, so the console's Inspect-OTP panel can prove keys are HASHED —
 * never the plaintext recipient and never the code. Two tenants that share a recipient
 * derive distinct keys (the tenant is part of the digest input), so a key can never be
 * reversed to a recipient nor collide across tenants.
 *
 * @module
 */
import { Controller, Get, Query } from '@nestjs/common'
import { hashTenantRecipient } from '@bymax-one/nest-notification'

import { TenantId } from '../common/tenant-id.decorator.js'
import { debugKeySchema } from './dto/debug.dto.js'

/** REST controller exposing the hashed OTP storage key for inspection. */
@Controller('debug')
export class DebugController {
  /**
   * Derive the opaque storage key for `(tenantId, recipient)`.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id`.
   * @param query - Raw query validated against {@link debugKeySchema}.
   * @returns `{ key }` — a 64-hex SHA-256 digest, never the code or plaintext recipient.
   */
  @Get('key')
  key(@TenantId() tenantId: string, @Query() query: unknown): { key: string } {
    const { recipient } = debugKeySchema.parse(query)
    return { key: hashTenantRecipient(tenantId, recipient) }
  }
}
