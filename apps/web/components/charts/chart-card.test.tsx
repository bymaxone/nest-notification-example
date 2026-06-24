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
  /** A decorative chart is one labelled image; no action/legend slots when omitted. */
  it('exposes a decorative body as a labelled image by default', () => {
    const { container } = render(
      <ChartCard title="Delivery rate">
        <div>body</div>
      </ChartCard>,
    )
    expect(screen.getByText('Delivery rate')).toBeInTheDocument()
    const content = screen.getByRole('img', { name: 'Delivery rate chart' })
    // The wrapper card flexes vertically and the body grows; with no legend it has no bottom pad.
    expect(container.firstElementChild).toHaveClass('flex-col')
    expect(content).toHaveClass('flex-1')
    expect(content).not.toHaveClass('pb-3')
    // No action node → the header holds only the title; no legend → no footer row.
    expect(screen.getByText('Delivery rate').parentElement?.childElementCount).toBe(1)
    expect(container.firstElementChild?.childElementCount).toBe(2)
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

  /** The optional action + legend nodes render, and the legend adds the footer padding. */
  it('renders the action and legend slots', () => {
    const { container } = render(
      <ChartCard title="Mix" action={<span>act</span>} legend={<span>leg</span>}>
        <div>body</div>
      </ChartCard>,
    )
    expect(screen.getByText('act')).toBeInTheDocument()
    expect(screen.getByText('leg')).toBeInTheDocument()
    // A legend present → the body gains `pb-3` and the card gains the footer row (3 children).
    expect(screen.getByRole('img', { name: 'Mix chart' })).toHaveClass('pb-3')
    expect(container.firstElementChild?.childElementCount).toBe(3)
  })
})
