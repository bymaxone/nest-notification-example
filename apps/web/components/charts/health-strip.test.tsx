/**
 * @fileoverview Unit tests for {@link HealthStrip}.
 *
 * Mocks `useAggregate` to drive the error, loading, empty, and data states —
 * including both arms of the delivery-rate and failures danger thresholds.
 *
 * @module components/charts/health-strip.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { HealthStrip } from './health-strip'
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

describe('HealthStrip', () => {
  /** The error state shows a retry message. */
  it('renders an error message on failure', () => {
    setAgg({ isError: true })
    render(<HealthStrip query={QUERY} />)
    expect(screen.getByText(/Failed to load delivery metrics/)).toBeInTheDocument()
  })

  /** The loading state shows skeleton tiles. */
  it('renders skeleton tiles while loading', () => {
    setAgg({ isLoading: true })
    const { container } = render(<HealthStrip query={QUERY} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  /** An empty window shows the action-oriented prompt. */
  it('renders the empty state with a Trigger Center link', () => {
    setAgg({})
    render(<HealthStrip query={QUERY} />)
    expect(screen.getByText(/No delivery events in this window/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Trigger Center/ })).toHaveAttribute('href', '/trigger')
  })

  /** A low delivery rate + failures trip both danger rings. */
  it('flags low delivery rate and failures as danger', () => {
    setAgg({
      data: [
        { bucket: 'b1', dimension: 'sent', n: 1 },
        { bucket: 'b1', dimension: 'failed', n: 9 },
        { bucket: 'b1', dimension: 'generated', n: 10 },
        { bucket: 'b1', dimension: 'verified', n: 8 },
      ],
    })
    render(<HealthStrip query={QUERY} />)
    expect(screen.getByText('DELIVERED')).toBeInTheDocument()
    expect(screen.getByText('80.0%')).toBeInTheDocument() // verify rate 8/10
    // A sub-90% delivery rate and any failures both flip the tile value to the destructive colour.
    expect(screen.getByText('10.0%')).toHaveClass('text-destructive') // delivery rate 1/(1+9)
    expect(screen.getByText('9')).toHaveClass('text-destructive') // failures
    expect(mockAgg).toHaveBeenCalledWith('verb', QUERY)
  })

  /** Exactly the 90% threshold is NOT danger (the boundary is strictly-less-than). */
  it('treats a delivery rate at exactly the threshold as healthy', () => {
    setAgg({
      data: [
        { bucket: 'b1', dimension: 'sent', n: 9 },
        { bucket: 'b1', dimension: 'failed', n: 1 },
      ],
    })
    render(<HealthStrip query={QUERY} />)
    expect(screen.getByText('90.0%')).toHaveClass('text-foreground')
  })

  /** A perfect window trips neither danger ring (covers the false arms). */
  it('shows a healthy window with no danger', () => {
    setAgg({ data: [{ bucket: 'b1', dimension: 'sent', n: 10 }] })
    render(<HealthStrip query={QUERY} />)
    // A 100% delivery rate and zero failures keep both tile values the normal foreground colour.
    expect(screen.getByText('100.0%')).toHaveClass('text-foreground') // delivery rate
    expect(screen.getByText('0')).toHaveClass('text-foreground') // failures
  })
})
