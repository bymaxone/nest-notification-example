/**
 * @fileoverview Unit tests for {@link StatTile}.
 *
 * Covers the value + title, the optional hint, and the danger ring state.
 *
 * @module components/charts/stat-tile.test
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Send } from 'lucide-react'

import { StatTile } from './stat-tile'

afterEach(cleanup)

describe('StatTile', () => {
  /** Renders the title, value, and hint; the default (no danger) keeps the neutral styling. */
  it('renders the title, value, and hint', () => {
    const { container } = render(
      <StatTile title="DELIVERED" value="42" hint="sent in window" icon={Send} color="#22c55e" />,
    )
    expect(screen.getByText('DELIVERED')).toBeInTheDocument()
    const value = screen.getByText('42')
    expect(value).toBeInTheDocument()
    expect(screen.getByText('sent in window')).toBeInTheDocument()
    // Default danger=false → the value is foreground (not destructive) and the card has no ring.
    expect(value).toHaveClass('text-2xl')
    expect(value).toHaveClass('text-foreground')
    expect(value).not.toHaveClass('text-destructive')
    expect(container.firstElementChild).toHaveClass('min-w-40')
    expect(container.firstElementChild).not.toHaveClass('ring-1')
    // The icon carries its inline accent colour.
    expect(container.querySelector('svg')?.style.color).not.toBe('')
  })

  /** Without a hint, no sub-label renders (the value is the body's only child). */
  it('omits the hint when not provided', () => {
    render(<StatTile title="X" value="1" icon={Send} color="#fff" />)
    expect(screen.queryByText('sent in window')).toBeNull()
    expect(screen.getByText('1').parentElement?.childElementCount).toBe(1)
  })

  /** The danger flag colours the value destructive and rings the card. */
  it('applies the destructive style when danger is set', () => {
    const { container } = render(
      <StatTile title="FAILURES" value="3" icon={Send} color="#ef4444" danger />,
    )
    expect(screen.getByText('3')).toHaveClass('text-destructive')
    expect(container.firstElementChild).toHaveClass('ring-1')
    expect(container.firstElementChild).toHaveClass('ring-destructive/60')
  })
})
