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

  /** Each series renders its label, a coloured swatch, and a matching coloured icon. */
  it('renders a labelled row per series', () => {
    render(<ChartLegend items={DELIVERY_SERIES} />)
    const list = screen.getByRole('list', { name: 'Chart legend' })
    expect(list).toBeInTheDocument()
    expect(list).toHaveClass('flex-wrap')
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    const sentRow = screen.getByText('Sent').closest('li')
    // The swatch background + the icon colour both carry the series colour inline.
    const swatch = sentRow?.querySelector('span[aria-hidden="true"]')
    expect((swatch as HTMLElement).style.background).not.toBe('')
    expect(sentRow?.querySelector('svg')?.style.color).not.toBe('')
  })
})
