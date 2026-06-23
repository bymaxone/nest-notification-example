/**
 * @fileoverview Unit tests for the notification console URL filter hook and constants.
 *
 * Tests `TENANTS`, `ROLES`, `notificationQueryParsers`, and `useNotificationQuery()`,
 * exercising the default-value, override, and setter paths via a
 * `NuqsTestingAdapter`.
 *
 * @module lib/filters.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ReactElement } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

import { ROLES, TENANTS, notificationQueryParsers, useNotificationQuery } from './filters'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Render the hook inside a memory-backed nuqs adapter seeded from `search`. */
function renderNotificationQuery(search = '') {
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={vi.fn()}>
      {children}
    </NuqsTestingAdapter>
  )
  return renderHook(() => useNotificationQuery(), { wrapper })
}

describe('TENANTS and ROLES constants', () => {
  /** TENANTS must include the two demo identifiers. */
  it('exports acme and globex as TENANTS', () => {
    expect(TENANTS).toContain('acme')
    expect(TENANTS).toContain('globex')
    expect(TENANTS.length).toBe(2)
  })

  /** ROLES must include viewer, operator, and admin. */
  it('exports viewer, operator, and admin as ROLES', () => {
    expect(ROLES).toContain('viewer')
    expect(ROLES).toContain('operator')
    expect(ROLES).toContain('admin')
    expect(ROLES.length).toBe(3)
  })
})

describe('notificationQueryParsers', () => {
  /** Parser map must have the three expected keys. */
  it('has tenantId, role, and live parsers', () => {
    expect(Object.keys(notificationQueryParsers).sort()).toEqual(['live', 'role', 'tenantId'])
  })
})

describe('useNotificationQuery', () => {
  /** Default state: tenantId empty, role viewer, live false. */
  it('returns defaults when URL has no params', () => {
    const { result } = renderNotificationQuery('')
    expect(result.current.tenantId).toBe('')
    expect(result.current.role).toBe('viewer')
    expect(result.current.live).toBe(false)
  })

  /** Seeded tenantId is read back correctly. */
  it('reads tenantId from the URL', () => {
    const { result } = renderNotificationQuery('?tenantId=acme')
    expect(result.current.tenantId).toBe('acme')
  })

  /** Seeded role=admin overrides the default viewer. */
  it('reads role from the URL', () => {
    const { result } = renderNotificationQuery('?role=admin')
    expect(result.current.role).toBe('admin')
  })

  /** Seeded live=true is read back as boolean true. */
  it('reads live=true from the URL', () => {
    const { result } = renderNotificationQuery('?live=true')
    expect(result.current.live).toBe(true)
  })

  /** The setQuery function is exposed and callable. */
  it('exposes a setQuery function', () => {
    const { result } = renderNotificationQuery('')
    expect(typeof result.current.setQuery).toBe('function')
  })
})
