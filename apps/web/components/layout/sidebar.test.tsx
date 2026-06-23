/**
 * @fileoverview Component tests for {@link Sidebar} — the nav landmark, the
 * active/inactive branch per route (exact root match vs prefix match for the
 * sub-routes), the mobile open/closed visibility branch, and the optional
 * `onNavClick` close handler (present vs absent).
 *
 * `next/navigation`'s `usePathname` is mocked so each test pins the current
 * route and asserts which item carries `aria-current="page"`.
 *
 * @module components/layout/sidebar.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/** Mutable pathname the mocked `usePathname` returns; set per test before render. */
let currentPathname = '/'
/** Mutable query string the mocked `useSearchParams` returns; set per test before render. */
let currentSearch = ''

vi.mock('next/navigation', () => ({
  usePathname: (): string => currentPathname,
  useSearchParams: (): URLSearchParams => new URLSearchParams(currentSearch),
}))

// Imported after the mock so the component binds the mocked navigation module.
const { Sidebar } = await import('./sidebar')

beforeEach(() => {
  currentPathname = '/'
  currentSearch = ''
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** All seven notification console destinations. */
const ALL_LABELS = [
  'Overview',
  'Trigger Center',
  'Audit Explorer',
  'OTP Verify',
  'Providers & Templates',
  'Roadmap',
  'Settings',
] as const

describe('Sidebar', () => {
  /** The rail renders as a labelled navigation landmark holding every destination. */
  it('renders a Main navigation landmark with all seven links', () => {
    render(<Sidebar isOpen={false} />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav).toBeInTheDocument()
    for (const label of ALL_LABELS) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  /** The root route uses exact matching, so only Overview is current at `/`. */
  it('marks only Overview active on the exact root route', () => {
    currentPathname = '/'
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Trigger Center' })).not.toHaveAttribute('aria-current')
  })

  /** A non-root pathname must NOT mark the exact root item active. */
  it('does not mark Overview active when the route is not the root', () => {
    currentPathname = '/trigger'
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Trigger Center' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  /** Each non-exact item is active on its own exact href. */
  it.each([
    ['/trigger', 'Trigger Center'],
    ['/explorer', 'Audit Explorer'],
    ['/otp', 'OTP Verify'],
    ['/providers', 'Providers & Templates'],
    ['/roadmap', 'Roadmap'],
    ['/settings', 'Settings'],
  ])('marks %s active for its exact route', (path, label) => {
    currentPathname = path
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  })

  /** A nested sub-route activates its parent via the `startsWith(href + '/')` branch. */
  it('marks a non-exact item active for a nested sub-route', () => {
    currentPathname = '/explorer/details'
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: 'Audit Explorer' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
  })

  /** With no matching route every item is inactive. */
  it('marks no item active for an unmatched route', () => {
    currentPathname = '/nowhere'
    render(<Sidebar isOpen={false} />)
    for (const label of ALL_LABELS) {
      expect(screen.getByRole('link', { name: label })).not.toHaveAttribute('aria-current')
    }
  })

  /**
   * A path that starts with a nav href but is not a true sub-route (no `/` separator)
   * must NOT activate the parent. Kills the `item.href + '/'` → `item.href + ''`
   * StringLiteral mutation on the `startsWith` guard.
   */
  it('does not mark Audit Explorer active for a path that only shares a prefix', () => {
    currentPathname = '/explorerx'
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: 'Audit Explorer' })).not.toHaveAttribute('aria-current')
  })

  /** When `onNavClick` is provided, clicking a link invokes it (mobile close). */
  it('calls onNavClick when a link is clicked', async () => {
    const onNavClick = vi.fn()
    const user = userEvent.setup()
    render(<Sidebar isOpen onNavClick={onNavClick} />)
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(onNavClick).toHaveBeenCalledTimes(1)
  })

  /** Without `onNavClick`, clicking a link must not throw (absent-handler branch). */
  it('renders clickable links when onNavClick is omitted', async () => {
    const user = userEvent.setup()
    render(<Sidebar isOpen />)
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  /** With no active filter state the links stay bare (empty-query branch). */
  it('keeps bare hrefs when there is no active query state', () => {
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })

  /**
   * The active filter query (the nuqs URL state) is carried onto every destination
   * so navigating between pages preserves the lens instead of resetting it.
   */
  it('appends the active query string to every nav href', () => {
    currentSearch = 'live=true&tenantId=acme'
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/?live=true&tenantId=acme',
    )
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings?live=true&tenantId=acme',
    )
  })

  /**
   * When open, the rail resolves to a visible `flex` display (no `hidden`). Kills the
   * `'flex'` → "" StringLiteral mutation.
   */
  it('resolves the nav to a visible flex display when open', () => {
    render(<Sidebar isOpen />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav.className).toMatch(/ flex$/)
    expect(nav.className).not.toContain('hidden')
  })

  /**
   * When closed, the rail is `hidden` on mobile and `lg:flex` on desktop. Kills the
   * `'hidden lg:flex'` → "" StringLiteral mutation.
   */
  it('resolves the nav to hidden (lg:flex) when closed', () => {
    render(<Sidebar isOpen={false} />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav.className).toContain('hidden')
    expect(nav.className).toContain('lg:flex')
    expect(nav.className).not.toMatch(/ flex$/)
  })
})
