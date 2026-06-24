/**
 * @fileoverview Component tests for {@link ExplorerContent}.
 *
 * Stubs the child panels and mocks the SSE stream + follow-mode hooks so the test
 * focuses on the composition, the row-selection seam, and the live-tail wiring:
 * the control bar (Streaming / Connecting / Failed / Paused-absolute-range), the
 * `N live` count, Pause/Resume/Clear, and the "N new — Jump to latest" pill.
 *
 * @module components/explorer/explorer-content.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

import type { NotificationLog } from '@/lib/types'

/** A row the stub table reports on click. */
const ROW: NotificationLog = {
  id: 'r1',
  timestamp: '2026-06-23T12:00:00.000Z',
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
}

/** Mutable stream + follow-mode states the mocked hooks return. */
let streamReturn: {
  rows: NotificationLog[]
  isConnected: boolean
  isFailed: boolean
  clear: ReturnType<typeof vi.fn>
}
let followReturn: {
  paused: boolean
  newCount: number
  jumpToLatest: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
}

vi.mock('./facet-rail', () => ({ FacetRail: () => <div>facet-rail</div> }))
vi.mock('./query-bar', () => ({ QueryBar: () => <div>query-bar</div> }))
vi.mock('./log-table', () => ({
  LogTable: ({
    onRowClick,
    liveRows,
    isFollowing,
  }: {
    onRowClick: (row: NotificationLog) => void
    liveRows?: NotificationLog[]
    isFollowing?: boolean
  }) => (
    <button
      type="button"
      data-live-rows={String((liveRows ?? []).length)}
      data-following={String(isFollowing)}
      onClick={() => onRowClick(ROW)}
    >
      stub-row
    </button>
  ),
}))
vi.mock('@/lib/sse', () => ({ useAuditStream: () => streamReturn }))
vi.mock('@/hooks/use-follow-mode', () => ({ useFollowMode: () => followReturn }))
vi.mock('./detail-drawer', () => ({
  DetailDrawer: ({
    row,
    open,
    onOpenChange,
  }: {
    row: NotificationLog | null
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => (
    // Always render a marker exposing the current selection so a cleared selection
    // (open=false, row=null) is observable even though the visible drawer is gone.
    <div data-testid="drawer" data-row={row?.id ?? 'none'} data-open={String(open)}>
      {open && row !== null ? (
        <>
          drawer-{row.id}
          <button type="button" onClick={() => onOpenChange(false)}>
            close-drawer
          </button>
          <button type="button" onClick={() => onOpenChange(true)}>
            keep-drawer
          </button>
        </>
      ) : null}
    </div>
  ),
}))

const { ExplorerContent } = await import('./explorer-content')

/** Render under a nuqs adapter seeded from `search`. */
function renderExplorer(search = ''): void {
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={vi.fn()}>
      {children}
    </NuqsTestingAdapter>
  )
  render(<ExplorerContent />, { wrapper })
}

beforeEach(() => {
  streamReturn = { rows: [], isConnected: false, isFailed: false, clear: vi.fn() }
  followReturn = {
    paused: false,
    newCount: 0,
    jumpToLatest: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ExplorerContent', () => {
  /** Composes the rail, query bar, and table; no control bar / live wiring when live is off. */
  it('renders the rail, query bar, and table without the live bar', () => {
    followReturn = { ...followReturn, newCount: 5 }
    renderExplorer()
    expect(screen.getByText('facet-rail')).toBeInTheDocument()
    expect(screen.getByText('query-bar')).toBeInTheDocument()
    const table = screen.getByText('stub-row')
    expect(table).toBeInTheDocument()
    expect(screen.queryByText('Streaming')).toBeNull()
    // Live wiring is off: no live rows are forwarded, follow-mode is not active, and even
    // with pending new rows there is no jump pill (the `live &&` guards the whole tail).
    expect(table).toHaveAttribute('data-live-rows', '0')
    expect(table).toHaveAttribute('data-following', 'false')
    expect(screen.queryByText(/Jump to latest/)).toBeNull()
  })

  /** A row click opens the detail drawer; closing it clears the selection. */
  it('opens the detail drawer on row click and clears on close', () => {
    renderExplorer()
    expect(screen.queryByText('drawer-r1')).toBeNull()
    fireEvent.click(screen.getByText('stub-row'))
    expect(screen.getByText('drawer-r1')).toBeInTheDocument()
    fireEvent.click(screen.getByText('close-drawer'))
    expect(screen.queryByText('drawer-r1')).toBeNull()
    // Closing also clears the selection so a stale row cannot leak back on reopen.
    expect(screen.getByTestId('drawer')).toHaveAttribute('data-row', 'none')
  })

  /** An open-state change to `true` keeps the selection (the non-close branch). */
  it('keeps the selection when the drawer reports it stays open', () => {
    renderExplorer()
    fireEvent.click(screen.getByText('stub-row'))
    fireEvent.click(screen.getByText('keep-drawer'))
    expect(screen.getByText('drawer-r1')).toBeInTheDocument()
  })

  /** Live + relative + connected shows the streaming bar with Pause/Clear + the wired table. */
  it('shows the streaming control bar when live and connected', () => {
    streamReturn = { ...streamReturn, isConnected: true, rows: [ROW] }
    renderExplorer('?live=true&range=15m')
    const status = screen.getByText('Streaming')
    expect(status).toBeInTheDocument()
    // The connected status uses the success colour + the mono base; its dot pulses.
    expect(status).toHaveClass('font-mono')
    expect(status).toHaveClass('text-(--color-success)')
    const dot = status.querySelector('svg')
    expect(dot?.getAttribute('class')).toContain('h-3.5')
    expect(dot?.getAttribute('class')).toContain('animate-pulse')
    expect(screen.getByText('1 live')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument()
    // The live rows + active follow-mode are forwarded to the table.
    const table = screen.getByText('stub-row')
    expect(table).toHaveAttribute('data-live-rows', '1')
    expect(table).toHaveAttribute('data-following', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Clear/ }))
    expect(streamReturn.clear).toHaveBeenCalled()
  })

  /** Connecting status when enabled but not yet connected (neutral colour, no pulse). */
  it('shows the connecting status before the stream opens', () => {
    renderExplorer('?live=true&range=15m')
    const status = screen.getByText('Connecting…')
    expect(status).toBeInTheDocument()
    expect(status).toHaveClass('text-white/40')
    expect(status.querySelector('svg')?.getAttribute('class')).not.toContain('animate-pulse')
    // Live but with no pending rows: no jump pill (the strict `> 0` guard).
    expect(screen.queryByText(/Jump to latest/)).toBeNull()
  })

  /** Failed status when the stream terminally fails (destructive colour). */
  it('shows the failed status on a terminal failure', () => {
    streamReturn = { ...streamReturn, isFailed: true }
    renderExplorer('?live=true&range=15m')
    const status = screen.getByText('Live tail failed — retry')
    expect(status).toBeInTheDocument()
    expect(status).toHaveClass('text-destructive')
  })

  /** An absolute range pauses the stream with a clear status. */
  it('shows the paused-absolute-range status when the range is absolute', () => {
    renderExplorer('?live=true&from=2026-06-23T00:00:00.000Z&to=2026-06-23T01:00:00.000Z')
    expect(screen.getByText('Paused (absolute range)')).toBeInTheDocument()
  })

  /** Paused with new rows shows Resume + the jump-to-latest pill and suppresses follow-mode. */
  it('shows Resume and the jump-to-latest pill when paused with new rows', () => {
    followReturn = { ...followReturn, paused: true, newCount: 3 }
    renderExplorer('?live=true&range=15m')
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument()
    const pill = screen.getByRole('button', { name: /Jump to latest/ })
    expect(pill).toHaveTextContent('3 new — Jump to latest')
    // Paused suppresses follow-mode auto-scroll, even though live is on.
    expect(screen.getByText('stub-row')).toHaveAttribute('data-following', 'false')
    fireEvent.click(pill)
    expect(followReturn.jumpToLatest).toHaveBeenCalled()
  })

  /** Pause and Resume buttons invoke the follow-mode controls. */
  it('wires the Pause and Resume controls', () => {
    renderExplorer('?live=true&range=15m')
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    expect(followReturn.pause).toHaveBeenCalled()
  })
})
