/**
 * @fileoverview Unit tests for {@link DeliveryRateLine}.
 *
 * Mocks `useAggregate` to drive the error, loading, empty, and data states; the
 * data state renders the titled line panel with the sent/failed legend.
 *
 * @module components/charts/delivery-rate-line.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { DeliveryRateLine } from './delivery-rate-line'
import * as useAggregateModule from '@/hooks/use-aggregate'
import type { AggregateBucket, AuditQuery } from '@/lib/types'

vi.mock('@/hooks/use-aggregate')
const mockAgg = vi.mocked(useAggregateModule.useAggregate)

/** Set the mocked hook return, defaulting the unset states. */
function setAgg(over: { data?: AggregateBucket[]; isLoading?: boolean; isError?: boolean }): void {
  mockAgg.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...over,
  } as ReturnType<typeof useAggregateModule.useAggregate>)
}

const QUERY: AuditQuery = { role: 'viewer' }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DeliveryRateLine', () => {
  /** The error state shows a failure note. */
  it('renders an error note on failure', () => {
    setAgg({ isError: true })
    render(<DeliveryRateLine query={QUERY} />)
    expect(screen.getByText(/Failed to load the delivery series/)).toBeInTheDocument()
  })

  /** The loading state shows a skeleton. */
  it('renders a skeleton while loading', () => {
    setAgg({ isLoading: true })
    const { container } = render(<DeliveryRateLine query={QUERY} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  /** An empty series shows the action-oriented prompt. */
  it('renders the empty state with a Trigger Center link', () => {
    setAgg({})
    render(<DeliveryRateLine query={QUERY} />)
    expect(screen.getByText(/No delivery events to chart/)).toBeInTheDocument()
  })

  /** A populated series renders the titled chart with the sent/failed legend. */
  it('renders the chart with the delivery legend', () => {
    setAgg({
      data: [
        { bucket: '2026-06-23T10:00:00.000Z', dimension: 'sent', n: 3 },
        { bucket: '2026-06-23T10:00:00.000Z', dimension: 'failed', n: 1 },
      ],
    })
    render(<DeliveryRateLine query={QUERY} />)
    expect(screen.getByText('Delivery rate')).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })
})
