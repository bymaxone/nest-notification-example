/**
 * @fileoverview Unit tests for {@link TopBar}.
 *
 * Covers the loading skeleton, the empty state, and the rendered rows as
 * click-to-filter links built by `hrefFor`.
 *
 * @module components/charts/top-bar.test
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { TopBar } from './top-bar'
import type { FacetValue } from '@/lib/types'

const ROWS: FacetValue[] = [
  { value: 'login', count: 5 },
  { value: 'password_reset', count: 2 },
]

afterEach(cleanup)

describe('TopBar', () => {
  /** Loading renders skeletons, not rows. */
  it('renders skeletons while loading', () => {
    const { container } = render(
      <TopBar title="Top purposes" rows={[]} hrefFor={(v) => `/explorer?purpose=${v}`} loading />,
    )
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  /** An empty list shows the action note. */
  it('shows an empty note for no rows', () => {
    render(<TopBar title="Top purposes" rows={[]} hrefFor={(v) => `/explorer?purpose=${v}`} />)
    expect(screen.getByText('No data yet.')).toBeInTheDocument()
  })

  /** Each row is a link built by hrefFor. */
  it('renders each row as a deep-link', () => {
    render(<TopBar title="Top purposes" rows={ROWS} hrefFor={(v) => `/explorer?purpose=${v}`} />)
    const link = screen.getByRole('link', { name: /login/ })
    expect(link).toHaveAttribute('href', '/explorer?purpose=login')
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
