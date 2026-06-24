/**
 * @fileoverview Unit tests for {@link ChannelBadges}.
 *
 * Mocks `useAggregate` to drive the error, loading, empty, and data states; the
 * data state renders click-to-filter links — covering both a known channel (with
 * icon + label) and an unknown dimension value (fallback label, no icon).
 *
 * @module components/charts/channel-badges.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { ChannelBadges } from './channel-badges'
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

describe('ChannelBadges', () => {
  /** The error state shows a failure note. */
  it('renders an error note on failure', () => {
    setAgg({ isError: true })
    render(<ChannelBadges query={QUERY} />)
    expect(screen.getByText(/Failed to load channels/)).toBeInTheDocument()
  })

  /** The loading state shows skeletons. */
  it('renders skeletons while loading', () => {
    setAgg({ isLoading: true })
    const { container } = render(<ChannelBadges query={QUERY} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  /** An empty series shows the empty note. */
  it('renders the empty state for no channels', () => {
    setAgg({})
    render(<ChannelBadges query={QUERY} />)
    expect(screen.getByText(/No channel activity/)).toBeInTheDocument()
  })

  /** A known channel renders its label + deep-link; an unknown value falls back. */
  it('renders click-to-filter badges for known and unknown channels', () => {
    setAgg({
      data: [
        { bucket: 'b1', dimension: 'email', n: 5 },
        { bucket: 'b1', dimension: 'mystery', n: 1 },
      ],
    })
    render(<ChannelBadges query={QUERY} />)
    const emailLink = screen.getByRole('link', { name: /Email/ })
    expect(emailLink).toHaveAttribute('href', '/explorer?channel=email&range=15m')
    expect(screen.getByText('mystery')).toBeInTheDocument()
  })
})
