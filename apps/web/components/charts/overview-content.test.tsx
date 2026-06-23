/**
 * @fileoverview Unit tests for {@link OverviewContent}.
 *
 * Mocks the data hooks and renders inside a nuqs adapter, asserting the
 * composition wires the health strip, delivery line, and breakdown row
 * (channels, provider mix, top purposes) from the shared filter.
 *
 * @module components/charts/overview-content.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

vi.mock('@/hooks/use-aggregate', () => ({
  useAggregate: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
}))
vi.mock('@/hooks/use-facets', () => ({
  useFacets: vi.fn(() => ({
    facets: {
      channel: [],
      verb: [],
      provider: [],
      purpose: [{ value: 'login', count: 3 }],
      source: [],
    },
    isLoading: false,
    isError: false,
  })),
}))

import { OverviewContent } from './overview-content'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Render under a memory-backed nuqs adapter. */
function renderOverview(): void {
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams="" hasMemory onUrlUpdate={vi.fn()}>
      {children}
    </NuqsTestingAdapter>
  )
  render(<OverviewContent />, { wrapper })
}

describe('OverviewContent', () => {
  /** Composes the breakdown row with the top-purposes deep-link. */
  it('renders the breakdown panels and the top-purposes link', () => {
    renderOverview()
    expect(screen.getByText('Top purposes')).toBeInTheDocument()
    expect(screen.getByText('No channel activity yet.')).toBeInTheDocument()
    expect(screen.getByText('No provider activity yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /login/ })).toHaveAttribute(
      'href',
      '/explorer?purpose=login&range=15m',
    )
  })
})
