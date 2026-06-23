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
  /** Renders the title, value, and hint. */
  it('renders the title, value, and hint', () => {
    render(
      <StatTile title="DELIVERED" value="42" hint="sent in window" icon={Send} color="#22c55e" />,
    )
    expect(screen.getByText('DELIVERED')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('sent in window')).toBeInTheDocument()
  })

  /** Without a hint, no sub-label renders. */
  it('omits the hint when not provided', () => {
    render(<StatTile title="X" value="1" icon={Send} color="#fff" />)
    expect(screen.queryByText('sent in window')).toBeNull()
  })

  /** The danger flag colours the value as destructive. */
  it('applies the destructive style when danger is set', () => {
    render(<StatTile title="FAILURES" value="3" icon={Send} color="#ef4444" danger />)
    expect(screen.getByText('3')).toHaveClass('text-destructive')
  })
})
