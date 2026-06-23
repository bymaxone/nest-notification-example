/**
 * @fileoverview Unit tests for the `useAuditLogs` keyset infinite query.
 *
 * Drives a mocked `fetchLogs` to cover: the first page (no cursor) and a fetched
 * next page (cursor passed), `getNextPageParam` reading `nextCursor` (present and
 * null), and the 410 stale-cursor path that drops the cached query.
 *
 * @module hooks/use-audit-logs.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

import * as auditApi from '@/lib/audit-api'
import { ApiError, type NotificationLog, type PageResult } from '@/lib/types'
import { useAuditLogs } from './use-audit-logs'

/** A single masked, code-free audit row. */
const ROW: NotificationLog = {
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
}

/** Build a fresh QueryClient + provider wrapper (retries off for deterministic errors). */
function makeWrapper(): {
  client: QueryClient
  wrapper: (props: { children: ReactNode }) => ReactNode
} {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useAuditLogs', () => {
  /** The first page is fetched with no cursor and exposes `hasNextPage` from nextCursor. */
  it('loads the first page and reports a next page when nextCursor is present', async () => {
    const fetchLogs = vi
      .spyOn(auditApi, 'fetchLogs')
      .mockResolvedValue({ data: [ROW], nextCursor: 'c1', hasMore: true })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useAuditLogs({ tenantId: 'acme' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.pages[0]?.data).toEqual([ROW])
    expect(result.current.hasNextPage).toBe(true)
    // The first call carries no cursor (the `: query` arm of the queryFn ternary).
    expect(fetchLogs).toHaveBeenLastCalledWith({ tenantId: 'acme' })
  })

  /** fetchNextPage passes the keyset cursor; a null nextCursor ends pagination. */
  it('passes the cursor on fetchNextPage and stops when nextCursor is null', async () => {
    const fetchLogs = vi
      .spyOn(auditApi, 'fetchLogs')
      .mockImplementation(
        (query): Promise<PageResult<NotificationLog>> =>
          Promise.resolve(
            query.cursor === 'c1'
              ? { data: [ROW], nextCursor: null, hasMore: false }
              : { data: [ROW], nextCursor: 'c1', hasMore: true },
          ),
      )
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useAuditLogs({ tenantId: 'acme' }), { wrapper })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => {
      await result.current.fetchNextPage()
    })

    expect(fetchLogs).toHaveBeenCalledWith({ tenantId: 'acme', cursor: 'c1' })
    await waitFor(() => expect(result.current.hasNextPage).toBe(false))
  })

  /** A 410 (stale cursor) drops the cached query so pagination can restart. */
  it('removes the cached query on a 410 stale cursor', async () => {
    vi.spyOn(auditApi, 'fetchLogs').mockRejectedValue(new ApiError(410, 'Gone'))
    const { client, wrapper } = makeWrapper()
    const remove = vi.spyOn(client, 'removeQueries')

    const { result } = renderHook(() => useAuditLogs({ tenantId: 'acme' }), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith({ queryKey: ['audit-logs', { tenantId: 'acme' }] }),
    )
  })

  /** A non-410 error does not trigger a cache reset. */
  it('does not reset the cache on a non-410 error', async () => {
    vi.spyOn(auditApi, 'fetchLogs').mockRejectedValue(new ApiError(500, 'Boom'))
    const { client, wrapper } = makeWrapper()
    const remove = vi.spyOn(client, 'removeQueries')

    const { result } = renderHook(() => useAuditLogs({ tenantId: 'acme' }), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(remove).not.toHaveBeenCalled()
  })
})
