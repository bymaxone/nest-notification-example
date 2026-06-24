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
import type { ReactElement, ReactNode } from 'react'

import type { AggregateBucket, AuditQuery } from '@/lib/types'

/** Render a Recharts stand-in exposing its props as JSON for assertions. */
function probe(name: string) {
  return (props: Record<string, unknown>): ReactElement => {
    const { children, ...rest } = props
    return (
      <div data-rc={name} data-props={JSON.stringify(rest)}>
        {children as ReactNode}
      </div>
    )
  }
}

vi.mock('recharts', () => ({
  ResponsiveContainer: probe('ResponsiveContainer'),
  PieChart: probe('PieChart'),
  Pie: probe('Pie'),
  Cell: probe('Cell'),
  Tooltip: probe('Tooltip'),
}))

const mockAgg = vi.fn()
vi.mock('@/hooks/use-aggregate', () => ({ useAggregate: (...a: unknown[]) => mockAgg(...a) }))

const { ProviderMix } = await import('./provider-mix')

/** Set the mocked hook return, defaulting the unset states. */
function setAgg(over: { data?: AggregateBucket[]; isLoading?: boolean; isError?: boolean }): void {
  mockAgg.mockReturnValue({ data: undefined, isLoading: false, isError: false, ...over })
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

  /** A populated series renders the donut with a legend + a coloured cell per provider. */
  it('renders the donut with a provider legend', () => {
    setAgg({
      data: [
        { bucket: 'b1', dimension: 'nodemailer', n: 4 },
        { bucket: 'b1', dimension: '__interceptor__', n: 2 },
      ],
    })
    render(<ProviderMix query={QUERY} />)
    // The panel reads the provider-grouped aggregate for the active query.
    expect(mockAgg).toHaveBeenCalledWith('provider', QUERY)
    expect(screen.getByText('Provider mix')).toBeInTheDocument()
    expect(screen.getByText('nodemailer')).toBeInTheDocument()
    expect(screen.getByText('__interceptor__')).toBeInTheDocument()
    // The donut disables animation and renders one filled cell per slice.
    const pie = JSON.parse(
      document.querySelector('[data-rc="Pie"]')?.getAttribute('data-props') ?? '{}',
    ) as Record<string, unknown>
    expect(pie.isAnimationActive).toBe(false)
    const cells = Array.from(document.querySelectorAll('[data-rc="Cell"]'))
    expect(cells).toHaveLength(2)
    for (const cell of cells) {
      const props = JSON.parse(cell.getAttribute('data-props') ?? '{}') as Record<string, unknown>
      expect(props.fill).toMatch(/^#/)
    }
  })
})
