/**
 * @fileoverview Query schema for the `GET /debug/key` route.
 * @layer app/dto
 *
 * Validates the `recipient` query parameter. The trusted `tenantId` is NOT in the schema
 * — the controller derives it from the `x-tenant-id` header.
 *
 * @module
 */
import { z } from 'zod'

/** Schema for `GET /debug/key?recipient=…`. */
export const debugKeySchema = z.object({ recipient: z.email() })

/** Parsed query of `GET /debug/key`. */
export type DebugKeyDto = z.infer<typeof debugKeySchema>
