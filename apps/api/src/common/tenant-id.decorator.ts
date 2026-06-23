/**
 * Trusted tenant resolution for `apps/api`.
 *
 * Layer: app/common. The tenant identifier ALWAYS comes from the trusted
 * `x-tenant-id` request header — never the request body. A missing OR blank
 * header resolves to `'default'` (the request is not rejected). The resolution
 * logic lives in a pure helper so it is unit-testable at 100% without an HTTP
 * harness, and the param decorator delegates to it.
 *
 * @module
 */
import { type ExecutionContext, createParamDecorator } from '@nestjs/common'

/** The fallback tenant used when the `x-tenant-id` header is absent. */
export const DEFAULT_TENANT_ID = 'default'

/**
 * Resolve the trusted tenant id from a raw `x-tenant-id` header value.
 *
 * A multi-value header collapses to its first entry; the candidate is trimmed and
 * an absent, empty-array, blank, or whitespace-only value resolves to
 * {@link DEFAULT_TENANT_ID} so a blank tenant id is never propagated downstream.
 * The body is never consulted.
 *
 * @param header - The raw header value (`string`, `string[]`, or `undefined`).
 * @returns The resolved, trimmed tenant id, defaulting to {@link DEFAULT_TENANT_ID}.
 */
export function resolveTenantId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header
  const trimmed = candidate?.trim()
  return trimmed ? trimmed : DEFAULT_TENANT_ID
}

/**
 * Decorator factory: read the `x-tenant-id` header from the execution context and
 * resolve it via {@link resolveTenantId}. Exported so it can be unit-tested directly
 * without standing up an HTTP request.
 *
 * @param _data - Unused decorator metadata.
 * @param ctx - The NestJS execution context for the current request.
 * @returns The trusted tenant id for the request.
 */
export function tenantIdFactory(_data: unknown, ctx: ExecutionContext): string {
  const request = ctx
    .switchToHttp()
    .getRequest<{ headers: Record<string, string | string[] | undefined> }>()
  return resolveTenantId(request.headers['x-tenant-id'])
}

/**
 * Param decorator that injects the trusted tenant id derived from the
 * `x-tenant-id` header. Delegates to {@link tenantIdFactory}.
 */
export const TenantId = createParamDecorator(tenantIdFactory)
