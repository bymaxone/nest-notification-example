/**
 * @fileoverview Unit tests for the `useAggregate` chart-data query.
 *
 * Drives a mocked `fetchAggregate` and asserts the hook keys by group-by +
 * query, returns the series, and forwards the dimension to the client.
 *
 * @module hooks/use-aggregate.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

import * as auditApi from '@/lib/audit-api'
import type { AggregateBucket } from '@/lib/types'
import { useAggregate } from './use-aggregate'

/** A one-bucket series. */
const SERIES: AggregateBucket[] = [{ bucket: '2026-06-23T12:00:00.000Z', dimension: 'sent', n: 3 }]

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

describe('useAggregate', () => {
  /** Returns the series and forwards the group-by dimension. */
  it('fetches the series for the given dimension', async () => {
    const fetchAggregate = vi.spyOn(auditApi, 'fetchAggregate').mockResolvedValue(SERIES)
    const wrapper = makeWrapper()

    const { result } = renderHook(() => useAggregate('verb', { tenantId: 'acme' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(SERIES)
    expect(fetchAggregate).toHaveBeenCalledWith({ tenantId: 'acme' }, 'verb')
  })
})
