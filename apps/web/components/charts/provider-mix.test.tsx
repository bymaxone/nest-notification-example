/**
 * @fileoverview Unit tests for {@link ProviderMix}.
 *
 * Mocks `useAggregate` to drive the error, loading, empty, and data states; the
 * data state renders the donut and a legend listing each provider slice.
 *
 * @module components/charts/provider-mix.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { ProviderMix } from './provider-mix'
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

describe('ProviderMix', () => {
  /** The error state shows a failure note. */
  it('renders an error note on failure', () => {
    setAgg({ isError: true })
    render(<ProviderMix query={QUERY} />)
    expect(screen.getByText(/Failed to load provider mix/)).toBeInTheDocument()
  })

  /** The loading state shows a skeleton. */
  it('renders a skeleton while loading', () => {
    setAgg({ isLoading: true })
    const { container } = render(<ProviderMix query={QUERY} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  /** An empty series shows the empty note. */
  it('renders the empty state for no slices', () => {
    setAgg({})
    render(<ProviderMix query={QUERY} />)
    expect(screen.getByText(/No provider activity/)).toBeInTheDocument()
  })

  /** A populated series renders the donut with a legend per provider. */
  it('renders the donut with a provider legend', () => {
    setAgg({
      data: [
        { bucket: 'b1', dimension: 'nodemailer', n: 4 },
        { bucket: 'b1', dimension: '__interceptor__', n: 2 },
      ],
    })
    render(<ProviderMix query={QUERY} />)
    expect(screen.getByText('Provider mix')).toBeInTheDocument()
    expect(screen.getByText('nodemailer')).toBeInTheDocument()
    expect(screen.getByText('__interceptor__')).toBeInTheDocument()
  })
})
