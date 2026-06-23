/**
 * Unit tests for the trusted-tenant resolution.
 *
 * Covers {@link resolveTenantId} (single header, multi-value header, absent header,
 * empty array, blank/whitespace-only single value, and a blank first multi-value
 * entry) and {@link tenantIdFactory} (the decorator factory pulling the header off
 * the execution context) — proving the tenant is derived only from the
 * `x-tenant-id` header and defaults to `'default'`, never from the request body and
 * never as a blank value.
 */
import type { ExecutionContext } from '@nestjs/common'
import { describe, expect, it } from '@jest/globals'

import { DEFAULT_TENANT_ID, resolveTenantId, tenantIdFactory } from './tenant-id.decorator.js'

/** Build an `ExecutionContext` whose request carries the given headers. */
function buildContext(headers: Record<string, string | string[] | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext
}

describe('resolveTenantId', () => {
  it('returns the header value when a single string is present', () => {
    /** A plain `x-tenant-id: acme` header resolves to the tenant `acme`. */
    expect(resolveTenantId('acme')).toBe('acme')
  })

  it('trims surrounding whitespace from a single header value', () => {
    /** A padded `x-tenant-id:  acme ` header resolves to the trimmed tenant `acme`. */
    expect(resolveTenantId('  acme ')).toBe('acme')
  })

  it('collapses a multi-value header to its first entry', () => {
    /** A repeated header arrives as an array; only the first value is trusted. */
    expect(resolveTenantId(['acme', 'globex'])).toBe('acme')
  })

  it('falls back to the default tenant for a blank single header value', () => {
    /** An empty-string header value must resolve to `default`, never propagate ''. */
    expect(resolveTenantId('')).toBe(DEFAULT_TENANT_ID)
  })

  it('falls back to the default tenant for a whitespace-only single header value', () => {
    /** A whitespace-only header value must resolve to `default`, never propagate it. */
    expect(resolveTenantId('   ')).toBe(DEFAULT_TENANT_ID)
  })

  it('falls back to the default tenant when the first multi-value entry is blank', () => {
    /** A multi-value header whose first entry is blank must still resolve to `default`. */
    expect(resolveTenantId(['  ', 'globex'])).toBe(DEFAULT_TENANT_ID)
  })

  it('falls back to the default tenant when the header is absent', () => {
    /** An undefined header must resolve to the `default` tenant, not throw or 401. */
    expect(resolveTenantId(undefined)).toBe(DEFAULT_TENANT_ID)
    expect(resolveTenantId(undefined)).toBe('default')
  })

  it('falls back to the default tenant for an empty header array', () => {
    /** An empty array (header present but valueless) must still resolve to `default`. */
    expect(resolveTenantId([])).toBe('default')
  })
})

describe('tenantIdFactory', () => {
  it('reads the x-tenant-id header from the execution context', () => {
    /**
     * The factory must derive the tenant from the request's `x-tenant-id` header,
     * proving the trusted source is the header and nothing else.
     */
    const ctx = buildContext({ 'x-tenant-id': 'acme' })

    expect(tenantIdFactory(undefined, ctx)).toBe('acme')
  })

  it('defaults to the default tenant when the header is missing', () => {
    /** With no `x-tenant-id` header, the factory resolves to `default`. */
    const ctx = buildContext({})

    expect(tenantIdFactory(undefined, ctx)).toBe('default')
  })
})
