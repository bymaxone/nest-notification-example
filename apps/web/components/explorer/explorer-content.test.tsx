/**
 * @fileoverview Component tests for {@link ExplorerContent}.
 *
 * Stubs the three child panels so the test focuses on the composition and the
 * row-selection seam: the rail + query bar + table render, and a row click
 * surfaces the selection caption (replaced by the detail drawer in a later
 * iteration).
 *
 * @module components/explorer/explorer-content.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('./facet-rail', () => ({ FacetRail: () => <div>facet-rail</div> }))
vi.mock('./query-bar', () => ({ QueryBar: () => <div>query-bar</div> }))
vi.mock('./log-table', () => ({
  LogTable: ({ onRowClick }: { onRowClick: (row: NotificationLog) => void }) => (
    <button type="button" onClick={() => onRowClick(ROW)}>
      stub-row
    </button>
  ),
}))

const { ExplorerContent } = await import('./explorer-content')

/** Render under a nuqs adapter. */
function renderExplorer(): void {
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams="" hasMemory onUrlUpdate={vi.fn()}>
      {children}
    </NuqsTestingAdapter>
  )
  render(<ExplorerContent />, { wrapper })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ExplorerContent', () => {
  /** Composes the rail, query bar, and table. */
  it('renders the rail, query bar, and table', () => {
    renderExplorer()
    expect(screen.getByText('facet-rail')).toBeInTheDocument()
    expect(screen.getByText('query-bar')).toBeInTheDocument()
    expect(screen.getByText('stub-row')).toBeInTheDocument()
  })

  /** A row click surfaces the selection caption. */
  it('selects a row on click', () => {
    renderExplorer()
    expect(screen.queryByText(/Selected sent/)).toBeNull()
    fireEvent.click(screen.getByText('stub-row'))
    expect(screen.getByText(/Selected sent · j\*\*\*@acme.com/)).toBeInTheDocument()
  })
})
