/**
 * @fileoverview Unit tests for {@link ChartCard}.
 *
 * Covers the title + body, the decorative `role="img"` default vs the
 * interactive (no role) mode, and the optional action + legend footer.
 *
 * @module components/charts/chart-card.test
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { ChartCard } from './chart-card'

afterEach(cleanup)

describe('ChartCard', () => {
  /** A decorative chart is one labelled image with the title as its name. */
  it('exposes a decorative body as a labelled image by default', () => {
    render(
      <ChartCard title="Delivery rate">
        <div>body</div>
      </ChartCard>,
    )
    expect(screen.getByText('Delivery rate')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Delivery rate chart' })).toBeInTheDocument()
  })

  /** An interactive body keeps its tree (no decorative img role). */
  it('keeps an interactive body in the accessibility tree', () => {
    render(
      <ChartCard title="Channels" interactive>
        <button type="button">pick</button>
      </ChartCard>,
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByRole('button', { name: 'pick' })).toBeInTheDocument()
  })

  /** The optional action + legend nodes render. */
  it('renders the action and legend slots', () => {
    render(
      <ChartCard title="Mix" action={<span>act</span>} legend={<span>leg</span>}>
        <div>body</div>
      </ChartCard>,
    )
    expect(screen.getByText('act')).toBeInTheDocument()
    expect(screen.getByText('leg')).toBeInTheDocument()
  })
})
