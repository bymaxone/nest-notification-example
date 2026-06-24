/**
 * @fileoverview Unit tests for {@link DeliveryRateLine}.
 *
 * Mocks `useAggregate` to drive the error, loading, empty, and data states, and
 * mocks `recharts` with prop-capturing probes so the data state can assert the
 * exact chart configuration (series keys + stroke colours, disabled dots and
 * animation, the integer-only Y axis, the grid orientation, the axis ticks, and
 * the negative left margin) — none of which Recharts renders observably in jsdom.
 *
 * @module components/charts/delivery-rate-line.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

import type { AggregateBucket, AuditQuery } from '@/lib/types'

/** Render a Recharts stand-in that exposes its props as JSON for assertions. */
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
  LineChart: probe('LineChart'),
  CartesianGrid: probe('CartesianGrid'),
  XAxis: probe('XAxis'),
  YAxis: probe('YAxis'),
  Tooltip: probe('Tooltip'),
  Line: probe('Line'),
}))

const mockAgg = vi.fn()
vi.mock('@/hooks/use-aggregate', () => ({ useAggregate: (...args: unknown[]) => mockAgg(...args) }))

const { DeliveryRateLine } = await import('./delivery-rate-line')

/** Set the mocked hook return, defaulting the unset states. */
function setAgg(over: { data?: AggregateBucket[]; isLoading?: boolean; isError?: boolean }): void {
  mockAgg.mockReturnValue({ data: undefined, isLoading: false, isError: false, ...over })
}

const QUERY: AuditQuery = { role: 'viewer' }

/** Parse the captured props of the first probe with the given Recharts name. */
function propsOf(name: string, index = 0): Record<string, unknown> {
  const nodes = document.querySelectorAll(`[data-rc="${name}"]`)
  const node = nodes[index]
  if (!node) throw new Error(`no ${name}[${index}] probe`)
  return JSON.parse(node.getAttribute('data-props') ?? '{}') as Record<string, unknown>
}

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

  /** The panel reads the verb-grouped aggregate for the active query. */
  it('reads the verb-grouped aggregate series', () => {
    setAgg({})
    render(<DeliveryRateLine query={QUERY} />)
    expect(mockAgg).toHaveBeenCalledWith('verb', QUERY)
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

  /** Each series line is configured with its key, stroke, no dots, and no animation. */
  it('configures the sent and failed lines', () => {
    setAgg({ data: [{ bucket: 'b1', dimension: 'sent', n: 3 }] })
    render(<DeliveryRateLine query={QUERY} />)
    const sent = propsOf('Line', 0)
    const failed = propsOf('Line', 1)
    expect(sent.dataKey).toBe('sent')
    expect(sent.stroke).toBe('#22c55e')
    expect(sent.dot).toBe(false)
    expect(sent.isAnimationActive).toBe(false)
    expect(sent.strokeWidth).toBe(2)
    expect(failed.dataKey).toBe('failed')
    expect(failed.stroke).toBe('#ef4444')
    expect(failed.dot).toBe(false)
    expect(failed.isAnimationActive).toBe(false)
  })

  /** The grid, axes, and chart margin carry their non-default configuration. */
  it('configures the grid, axes, and margin', () => {
    setAgg({ data: [{ bucket: 'b1', dimension: 'sent', n: 3 }] })
    render(<DeliveryRateLine query={QUERY} />)
    expect(propsOf('CartesianGrid').vertical).toBe(false)
    expect(propsOf('YAxis').allowDecimals).toBe(false)
    expect(propsOf('XAxis').dataKey).toBe('time')
    expect(propsOf('XAxis').tick).toEqual({ fontSize: 10, fill: 'rgba(255,255,255,0.4)' })
    expect(propsOf('YAxis').tick).toEqual({ fontSize: 10, fill: 'rgba(255,255,255,0.4)' })
    expect(propsOf('LineChart').margin).toEqual({ top: 8, right: 12, bottom: 0, left: -16 })
  })
})
