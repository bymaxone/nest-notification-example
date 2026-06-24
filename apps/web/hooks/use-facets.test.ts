/**
 * @fileoverview Unit tests for the `useFacets` derived-facet hook.
 *
 * Drives a mocked `fetchLogs` and asserts the hook derives facet counts from the
 * loaded page, and surfaces the loading/error states of the underlying query.
 *
 * @module hooks/use-facets.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

import * as auditApi from '@/lib/audit-api'
import { ApiError, type NotificationLog } from '@/lib/types'
import { useFacets } from './use-facets'

/** Build an audit row, overriding only what a test needs. */
function row(over: Partial<NotificationLog>): NotificationLog {
  return {
    id: 'r1',
    timestamp: '2026-06-23T12:00:00.000Z',
    tenantId: 'acme',
    channel: 'email',
    verb: 'sent',
    recipient: 'j***@acme.com',
    purpose: null,
    providerName: 'nodemailer',
    messageId: null,
    errorMessage: null,
    userId: null,
    metadata: null,
    ...over,
  }
}

/** Build a fresh QueryClient + provider wrapper. */
function makeWrapper(): (props: { children: ReactNode }) => ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client }, children)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useFacets', () => {
  /** Derives facet counts from the loaded page (channel/source shown). */
  it('derives facet counts from the loaded rows', async () => {
    vi.spyOn(auditApi, 'fetchLogs').mockResolvedValue({
      data: [row({ channel: 'email' }), row({ channel: 'otp', providerName: '__interceptor__' })],
      nextCursor: null,
      hasMore: false,
    })
    const wrapper = makeWrapper()

    const { result } = renderHook(() => useFacets({ tenantId: 'acme' }), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.facets.channel).toContainEqual({ value: 'email', count: 1 })
    expect(result.current.facets.source).toContainEqual({ value: 'interceptor', count: 1 })
  })

  /** Surfaces the underlying error state with empty facets. */
  it('surfaces the error state with empty facets', async () => {
    vi.spyOn(auditApi, 'fetchLogs').mockRejectedValue(new ApiError(500, 'Boom'))
    const wrapper = makeWrapper()

    const { result } = renderHook(() => useFacets({ tenantId: 'acme' }), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.facets.channel).toEqual([])
  })
})
