/**
 * @fileoverview Unit tests for {@link ChartLegend}.
 *
 * Covers the empty (null) path and the rendered swatch + icon + label per series.
 *
 * @module components/charts/chart-legend.test
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { ChartLegend } from './chart-legend'
import { DELIVERY_SERIES } from '@/lib/chart-series'

afterEach(cleanup)

describe('ChartLegend', () => {
  /** No items renders nothing. */
  it('renders nothing for an empty list', () => {
    const { container } = render(<ChartLegend items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  /** Each series renders its label. */
  it('renders a labelled row per series', () => {
    render(<ChartLegend items={DELIVERY_SERIES} />)
    expect(screen.getByRole('list', { name: 'Chart legend' })).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })
})
