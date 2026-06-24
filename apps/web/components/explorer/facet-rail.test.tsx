/**
 * @fileoverview Component tests for {@link FacetRail}.
 *
 * Mocks `useFacets` to drive the loading, error, empty, and populated states, and
 * renders inside a nuqs adapter so a facet click writes the matching URL filter
 * (asserting the exact key/value for every field arm), an ⌥/Alt-click on an active
 * value clears it, a plain click on an active value re-applies it, and the active
 * row carries its highlight class + title while inactive rows carry theirs.
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

/** Each facet value paired with the URL key its click must write. */
const FIELD_WRITES: ReadonlyArray<[value: string, key: string]> = [
  ['email', 'channel'],
  ['sent', 'verb'],
  ['nodemailer', 'provider'],
  ['login', 'purpose'],
  ['interceptor', 'source'],
]

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

/** The `<button>` wrapping a facet value's label. */
function facetButton(value: string): HTMLButtonElement {
  const button = screen.getByText(value).closest('button')
  if (!button) throw new Error(`no facet button for ${value}`)
  return button as HTMLButtonElement
}

/** The single `searchParams` written by the most recent URL update. */
function lastWrite(onUrlUpdate: ReturnType<typeof vi.fn>): URLSearchParams {
  const calls = onUrlUpdate.mock.calls
  return calls[calls.length - 1]![0].searchParams as URLSearchParams
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

  /** Every section heading renders its human label. */
  it('renders each facet section heading', () => {
    setFacets({ facets: FACETS })
    renderRail()
    for (const label of ['Channel', 'Verb', 'Provider', 'Purpose', 'Source']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  /** Each facet row renders its value and count. */
  it('renders the value and count for a facet row', () => {
    setFacets({ facets: FACETS })
    renderRail()
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('nodemailer')).toBeInTheDocument()
    // The interceptor source row carries its count badge.
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  /** Clicking a value in each field writes exactly that field's key/value to the URL. */
  it('applies the matching positive filter for every facet field', async () => {
    for (const [value, key] of FIELD_WRITES) {
      const { onUrlUpdate } = renderRail()
      fireEvent.click(facetButton(value))
      await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
      expect(lastWrite(onUrlUpdate).get(key)).toBe(value)
      cleanup()
      vi.clearAllMocks()
    }
  })

  /** Alt-clicking an active value clears that field (writes the empty value). */
  it('clears a field on Alt-click of the active value', async () => {
    setFacets({ facets: FACETS })
    const { onUrlUpdate } = renderRail('?channel=email')
    fireEvent.click(facetButton('email'), { altKey: true })
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    // Clearing a default-empty param removes it from the URL entirely.
    expect(lastWrite(onUrlUpdate).get('channel')).toBeNull()
  })

  /** A plain click on the active value re-applies it (the `&&` guard, not `||`). */
  it('re-applies the active value on a plain (non-alt) click', async () => {
    setFacets({ facets: FACETS })
    const { onUrlUpdate } = renderRail('?channel=email')
    fireEvent.click(facetButton('email'))
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastWrite(onUrlUpdate).get('channel')).toBe('email')
  })

  /** Alt-clicking an INACTIVE value still applies it (clears only when active). */
  it('applies (does not clear) an Alt-click on an inactive value', async () => {
    setFacets({ facets: FACETS })
    const { onUrlUpdate } = renderRail('?channel=email')
    fireEvent.click(facetButton('sent'), { altKey: true })
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastWrite(onUrlUpdate).get('verb')).toBe('sent')
  })

  /** The active row carries the highlight class + clear title; inactive rows carry theirs. */
  it('highlights the active value and labels both states', () => {
    setFacets({ facets: FACETS })
    renderRail('?channel=email')
    const active = facetButton('email')
    expect(active).toHaveClass('text-brand-500')
    expect(active).toHaveClass('rounded')
    expect(active).toHaveAttribute('title', 'Alt-click to clear this filter')
    const inactive = facetButton('sent')
    expect(inactive).toHaveClass('text-white/65')
    expect(inactive).not.toHaveClass('text-brand-500')
    expect(inactive).toHaveAttribute('title', 'Filter Verb = sent')
  })

  /** With no active filter, no row is highlighted (the `?? ''` fallback never matches). */
  it('highlights nothing when no filter is active', () => {
    setFacets({ facets: FACETS })
    renderRail()
    expect(facetButton('email')).not.toHaveClass('text-brand-500')
    expect(facetButton('email')).toHaveAttribute('title', 'Filter Channel = email')
  })
})
