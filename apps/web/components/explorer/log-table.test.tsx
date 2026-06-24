/**
 * @fileoverview Component tests for {@link LogTable} — the virtualized Explorer grid.
 *
 * The data boundary (`@/hooks/use-audit-logs`) is mocked so each test drives one
 * render branch: error (generic + ApiError status), loading skeletons, empty,
 * populated rows (historical + highlighted live), the loading-older footer, the
 * keyset-prefetch scroll guard (fire + each guard + the follow-mode suppression),
 * an out-of-bounds virtual row, and the empty-header-groups guard. The virtualizer
 * + table are mocked so rows mount deterministically in jsdom.
 *
 * @module components/explorer/log-table.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'

import { ApiError, type AuditQuery, type NotificationLog } from '@/lib/types'

/** Mutable return value the mocked `useAuditLogs` yields; reshaped per test. */
type UseLogsReturn = {
  data: { pages: { data: NotificationLog[] }[] } | undefined
  error: unknown
  fetchNextPage: ReturnType<typeof vi.fn>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
}

const fetchNextPageMock = vi.fn()
let useLogsReturn: UseLogsReturn

vi.mock('@/hooks/use-audit-logs', () => ({
  useAuditLogs: (): UseLogsReturn => useLogsReturn,
}))

/** When set, the virtualizer yields exactly these indices (for an out-of-bounds row). */
let forcedVirtualIndices: number[] | null = null

interface VirtualizerOptions {
  count: number
  getScrollElement: () => HTMLElement | null
  estimateSize: (index: number) => number
}

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: VirtualizerOptions) => {
    const { count } = options
    options.getScrollElement()
    const size = options.estimateSize(0)
    const indices = forcedVirtualIndices ?? Array.from({ length: count }, (_, i) => i)
    return {
      getTotalSize: () => count * size,
      getVirtualItems: () =>
        indices.map((index) => ({ index, key: index, size, start: index * size })),
    }
  },
}))

/** When true, the wrapped real table reports zero header groups (drives the `?.` guard). */
let forceEmptyHeaderGroups = false

vi.mock('@tanstack/react-table', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-table')>()
  return {
    ...actual,
    useReactTable: (options: Parameters<typeof actual.useReactTable>[0]) => {
      const table = actual.useReactTable(options)
      return forceEmptyHeaderGroups ? { ...table, getHeaderGroups: () => [] } : table
    },
  }
})

const { LogTable } = await import('./log-table')

const query = { role: 'viewer' } as AuditQuery

/** Build a sample audit row. */
function makeRow(over: Partial<NotificationLog> = {}): NotificationLog {
  return {
    id: `r-${Math.random()}`,
    timestamp: '2026-06-23T01:02:03.045Z',
    tenantId: 'acme',
    channel: 'email',
    verb: 'sent',
    recipient: 'j***@acme.com',
    purpose: 'login',
    providerName: 'nodemailer',
    messageId: null,
    errorMessage: null,
    userId: null,
    metadata: null,
    ...over,
  }
}

beforeEach(() => {
  fetchNextPageMock.mockReset()
  forcedVirtualIndices = null
  forceEmptyHeaderGroups = false
  useLogsReturn = {
    data: { pages: [{ data: [] }] },
    error: null,
    fetchNextPage: fetchNextPageMock,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Set the scroll geometry on the container and fire a scroll event. */
function scrollTo(
  el: HTMLElement,
  scrollHeight: number,
  clientHeight: number,
  scrollTop: number,
): void {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(el, 'scrollTop', { configurable: true, value: scrollTop })
  fireEvent.scroll(el)
}

describe('LogTable', () => {
  /** The sticky header renders every column heading. */
  it('renders the column headers', () => {
    render(<LogTable query={query} onRowClick={vi.fn()} />)
    for (const header of [
      'Time',
      'Channel',
      'Verb',
      'Recipient',
      'Purpose',
      'Provider',
      'Source',
    ]) {
      expect(screen.getByText(header)).toBeInTheDocument()
    }
  })

  /** A generic error (no rows) shows the failure copy without a status. */
  it('renders the error state for a non-ApiError', () => {
    useLogsReturn = { ...useLogsReturn, error: new Error('boom'), data: { pages: [{ data: [] }] } }
    render(<LogTable query={query} onRowClick={vi.fn()} />)
    expect(screen.getByText(/Failed to load audit logs\./)).toBeInTheDocument()
  })

  /** An ApiError surfaces its HTTP status. */
  it('includes the HTTP status for an ApiError', () => {
    useLogsReturn = { ...useLogsReturn, error: new ApiError(503, 'down'), data: { pages: [] } }
    render(<LogTable query={query} onRowClick={vi.fn()} />)
    expect(screen.getByText(/Failed to load audit logs \(503\)\./)).toBeInTheDocument()
  })

  /** The loading branch wins over empty/error copy. */
  it('renders the loading branch without empty or error copy', () => {
    useLogsReturn = { ...useLogsReturn, isLoading: true, data: undefined }
    const { container } = render(<LogTable query={query} onRowClick={vi.fn()} />)
    expect(screen.queryByText(/No events match/)).not.toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(12)
  })

  /** With no rows the empty-state copy shows. */
  it('renders the empty state when there are no rows', () => {
    render(<LogTable query={query} onRowClick={vi.fn()} />)
    expect(screen.getByText(/No events match this query/)).toBeInTheDocument()
  })

  /** An undefined data result still renders the empty state. */
  it('treats an undefined data result as empty', () => {
    useLogsReturn = { ...useLogsReturn, data: undefined }
    render(<LogTable query={query} onRowClick={vi.fn()} />)
    expect(screen.getByText(/No events match this query/)).toBeInTheDocument()
  })

  /** Populated rows render and a click fires onRowClick. */
  it('renders rows and calls onRowClick with the clicked row', async () => {
    const target = makeRow({ id: 'r-click', recipient: 'k***@acme.com' })
    useLogsReturn = { ...useLogsReturn, data: { pages: [{ data: [target] }] } }
    const onRowClick = vi.fn()
    render(<LogTable query={query} onRowClick={onRowClick} />)
    await userEvent.click(screen.getByText('k***@acme.com'))
    expect(onRowClick).toHaveBeenCalledWith(target)
  })

  /** Live rows append after historical rows and carry the highlight class. */
  it('appends and highlights live rows', () => {
    const historical = makeRow({ id: 'h1', recipient: 'hist***@a.com' })
    const live = makeRow({ id: 'l1', recipient: 'live***@a.com' })
    useLogsReturn = { ...useLogsReturn, data: { pages: [{ data: [historical] }] } }
    render(<LogTable query={query} onRowClick={vi.fn()} liveRows={[live]} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]?.className).not.toContain('bg-brand-500')
    expect(buttons[1]?.className).toContain('bg-brand-500')
  })

  /** An empty liveRows array adds no rows. */
  it('treats an empty liveRows array the same as none', () => {
    useLogsReturn = { ...useLogsReturn, data: { pages: [{ data: [makeRow()] }] } }
    render(<LogTable query={query} onRowClick={vi.fn()} liveRows={[]} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  /** The loading-older footer appears only while fetching the next page. */
  it('shows the loading-older footer when fetching the next page', () => {
    useLogsReturn = {
      ...useLogsReturn,
      data: { pages: [{ data: [makeRow()] }] },
      isFetchingNextPage: true,
    }
    render(<LogTable query={query} onRowClick={vi.fn()} />)
    expect(screen.getByText('Loading older events…')).toBeInTheDocument()
  })

  /** Not following: a near-bottom user scroll prefetches the next page once. */
  it('prefetches the next page when scrolled near the bottom', () => {
    const scrollRef = createRef<HTMLDivElement>()
    useLogsReturn = {
      ...useLogsReturn,
      data: { pages: [{ data: [makeRow()] }] },
      hasNextPage: true,
    }
    render(<LogTable query={query} onRowClick={vi.fn()} scrollRef={scrollRef} />)
    scrollTo(scrollRef.current!, 1000, 800, 100)
    expect(fetchNextPageMock).toHaveBeenCalledTimes(1)
  })

  /** Following: a programmatic auto-scroll to the bottom must NOT prefetch. */
  it('suppresses the prefetch while follow-mode auto-scrolls to the bottom', () => {
    const scrollRef = createRef<HTMLDivElement>()
    useLogsReturn = {
      ...useLogsReturn,
      data: { pages: [{ data: [makeRow()] }] },
      hasNextPage: true,
    }
    render(<LogTable query={query} onRowClick={vi.fn()} scrollRef={scrollRef} isFollowing />)
    scrollTo(scrollRef.current!, 1000, 800, 100)
    expect(fetchNextPageMock).not.toHaveBeenCalled()
  })

  /** Far from the bottom: the distance guard blocks the prefetch. */
  it('does not prefetch when far from the bottom', () => {
    const scrollRef = createRef<HTMLDivElement>()
    useLogsReturn = {
      ...useLogsReturn,
      data: { pages: [{ data: [makeRow()] }] },
      hasNextPage: true,
    }
    render(<LogTable query={query} onRowClick={vi.fn()} scrollRef={scrollRef} />)
    scrollTo(scrollRef.current!, 5000, 800, 0)
    expect(fetchNextPageMock).not.toHaveBeenCalled()
  })

  /** Already fetching: the in-flight guard blocks the prefetch. */
  it('does not prefetch while a next-page fetch is in flight', () => {
    const scrollRef = createRef<HTMLDivElement>()
    useLogsReturn = {
      ...useLogsReturn,
      data: { pages: [{ data: [makeRow()] }] },
      hasNextPage: true,
      isFetchingNextPage: true,
    }
    render(<LogTable query={query} onRowClick={vi.fn()} scrollRef={scrollRef} />)
    scrollTo(scrollRef.current!, 1000, 800, 100)
    expect(fetchNextPageMock).not.toHaveBeenCalled()
  })

  /** No next page: the hasNextPage guard blocks the prefetch. */
  it('does not prefetch when there is no next page', () => {
    const scrollRef = createRef<HTMLDivElement>()
    useLogsReturn = {
      ...useLogsReturn,
      data: { pages: [{ data: [makeRow()] }] },
      hasNextPage: false,
    }
    render(<LogTable query={query} onRowClick={vi.fn()} scrollRef={scrollRef} />)
    scrollTo(scrollRef.current!, 1000, 800, 100)
    expect(fetchNextPageMock).not.toHaveBeenCalled()
  })

  /** A virtual item with no backing row renders nothing. */
  it('skips a virtual row with no backing table row', () => {
    useLogsReturn = { ...useLogsReturn, data: { pages: [{ data: [makeRow()] }] } }
    forcedVirtualIndices = [0, 1]
    render(<LogTable query={query} onRowClick={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  /** With error AND rows present, rows render (not the error banner). */
  it('renders rows (not the error banner) when both error and rows are present', () => {
    useLogsReturn = {
      ...useLogsReturn,
      error: new Error('next-page-failed'),
      data: { pages: [{ data: [makeRow({ recipient: 'partial***@a.com' })] }] },
    }
    render(<LogTable query={query} onRowClick={vi.fn()} />)
    expect(screen.getByText('partial***@a.com')).toBeInTheDocument()
    expect(screen.queryByText(/Failed to load audit logs/)).not.toBeInTheDocument()
  })

  /** With no header groups the header guard renders no cells and does not throw. */
  it('renders no header cells when the table reports no header groups', () => {
    forceEmptyHeaderGroups = true
    render(<LogTable query={query} onRowClick={vi.fn()} />)
    expect(screen.queryByText('Time')).not.toBeInTheDocument()
  })
})
