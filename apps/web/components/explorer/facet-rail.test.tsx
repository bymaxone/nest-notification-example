/**
 * @fileoverview Component tests for {@link FacetRail}.
 *
 * Mocks `useFacets` to drive the loading, error, empty, and populated states, and
 * renders inside a nuqs adapter so a facet click writes the matching URL filter
 * (covering every field arm) and an ⌥/Alt-click on an active value clears it.
 *
 * @module components/explorer/facet-rail.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

import type { FacetsResult } from '@/lib/types'

const useFacetsMock = vi.fn()
vi.mock('@/hooks/use-facets', () => ({ useFacets: () => useFacetsMock() }))

const { FacetRail } = await import('./facet-rail')

/** A fully-populated facet result. */
const FACETS: FacetsResult = {
  channel: [{ value: 'email', count: 2 }],
  verb: [{ value: 'sent', count: 2 }],
  provider: [{ value: 'nodemailer', count: 2 }],
  purpose: [{ value: 'login', count: 2 }],
  source: [{ value: 'interceptor', count: 1 }],
}

/** Set the mocked facets state. */
function setFacets(over: { facets?: FacetsResult; isLoading?: boolean; isError?: boolean }): void {
  useFacetsMock.mockReturnValue({
    facets: { channel: [], verb: [], provider: [], purpose: [], source: [] },
    isLoading: false,
    isError: false,
    ...over,
  })
}

/** Render the rail under a nuqs adapter, returning the render result + URL-update spy. */
function renderRail(
  search = '',
): ReturnType<typeof render> & { onUrlUpdate: ReturnType<typeof vi.fn> } {
  const onUrlUpdate = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={onUrlUpdate}>
      {children}
    </NuqsTestingAdapter>
  )
  return Object.assign(render(<FacetRail />, { wrapper }), { onUrlUpdate })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('FacetRail', () => {
  /** Loading renders skeletons. */
  it('renders skeletons while loading', () => {
    setFacets({ isLoading: true })
    const { container } = renderRail()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  /** The error state shows a message. */
  it('renders an error message on failure', () => {
    setFacets({ isError: true })
    renderRail()
    expect(screen.getByText('Failed to load facet counts.')).toBeInTheDocument()
  })

  /** Empty facets render the "No values" note per section. */
  it('renders the no-values note for empty facets', () => {
    setFacets({})
    renderRail()
    expect(screen.getAllByText('No values').length).toBe(5)
  })

  /** Clicking a value in each field writes the matching URL filter. */
  it('applies a positive filter for every facet field on click', async () => {
    setFacets({ facets: FACETS })
    const { onUrlUpdate } = renderRail()
    for (const value of ['email', 'sent', 'nodemailer', 'login', 'interceptor']) {
      fireEvent.click(screen.getByText(value))
    }
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
  })

  /** Alt-clicking an active value clears that field. */
  it('clears a field on Alt-click of the active value', async () => {
    setFacets({ facets: FACETS })
    const { onUrlUpdate } = renderRail('?channel=email')
    const active = screen.getByText('email')
    fireEvent.click(active, { altKey: true })
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
  })
})
