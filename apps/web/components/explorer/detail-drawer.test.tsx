/**
 * @fileoverview Component tests for {@link DetailDrawer}.
 *
 * Renders under a nuqs adapter and covers: the null-row no-op, the Overview
 * fields + a "filter for" pivot (sets the query and closes), the masked Raw JSON
 * (no code field), the never-contains-code Proof green check, the unexpected
 * code-present branch, the localized error label, and the omitted purpose/error
 * rows.
 *
 * @module components/explorer/detail-drawer.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

import { DetailDrawer } from './detail-drawer'
import type { NotificationLog } from '@/lib/types'

/** Build an audit row, overriding only what a test needs. */
function makeRow(over: Partial<NotificationLog> = {}): NotificationLog {
  return {
    id: 'row-1',
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
    ...over,
  }
}

/** Render the drawer under a nuqs adapter, returning the open-state + URL spies. */
function renderDrawer(
  row: NotificationLog | null,
  open = true,
): { onOpenChange: ReturnType<typeof vi.fn>; onUrlUpdate: ReturnType<typeof vi.fn> } & ReturnType<
  typeof render
> {
  const onOpenChange = vi.fn()
  const onUrlUpdate = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams="" hasMemory onUrlUpdate={onUrlUpdate}>
      {children}
    </NuqsTestingAdapter>
  )
  const result = render(<DetailDrawer row={row} open={open} onOpenChange={onOpenChange} />, {
    wrapper,
  })
  return Object.assign(result, { onOpenChange, onUrlUpdate })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DetailDrawer', () => {
  /** A null row renders nothing. */
  it('renders nothing when no row is selected', () => {
    const { container } = renderDrawer(null)
    expect(container).toBeEmptyDOMElement()
  })

  /** The Overview tab lists the severity + scalar fields. */
  it('renders the overview fields with severity labels', () => {
    renderDrawer(makeRow({}))
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('j***@acme.com')).toBeInTheDocument()
    expect(screen.getByText('nodemailer')).toBeInTheDocument()
    expect(screen.getByText('service')).toBeInTheDocument()
    expect(screen.getByText('login')).toBeInTheDocument()
  })

  /** A "filter for" pivot sets the query and closes the drawer. */
  it('applies a filter-for pivot and closes the drawer', () => {
    const { onOpenChange } = renderDrawer(makeRow({}))
    fireEvent.click(screen.getByTitle('Filter for Channel'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  /** The Raw tab shows the masked JSON with no code field. */
  it('shows the masked raw JSON without a code field', async () => {
    renderDrawer(makeRow({}))
    await userEvent.click(screen.getByRole('tab', { name: 'Raw entry' }))
    const raw = screen.getByText(/"recipient": "j\*\*\*@acme.com"/)
    expect(raw).toBeInTheDocument()
    expect(raw.textContent).not.toContain('"code"')
  })

  /** The Proof tab renders the never-contains-code green check. */
  it('renders the never-contains-code proof', async () => {
    renderDrawer(makeRow({}))
    await userEvent.click(screen.getByRole('tab', { name: 'Proof' }))
    expect(screen.getByText('No OTP code present')).toBeInTheDocument()
    expect(screen.getByText('j***@acme.com')).toBeInTheDocument()
  })

  /** A row that unexpectedly carries a code field renders the warning branch. */
  it('renders the unexpected branch when a code field is present', async () => {
    const withCode = { ...makeRow({}), code: '123456' } as unknown as NotificationLog
    renderDrawer(withCode)
    await userEvent.click(screen.getByRole('tab', { name: 'Proof' }))
    expect(screen.getByText(/Unexpected/)).toBeInTheDocument()
  })

  /** A recognised error code is shown with its localized label. */
  it('localizes a recognised error code', () => {
    renderDrawer(makeRow({ verb: 'failed', errorMessage: 'notification.otp_invalid_code' }))
    expect(screen.getByText(/Incorrect code/)).toBeInTheDocument()
  })

  /** A null purpose and an unrecognised error omit their rows. */
  it('omits the purpose and error rows when absent/unknown', () => {
    renderDrawer(makeRow({ purpose: null, errorMessage: 'some free-text failure' }))
    expect(screen.queryByText('Purpose')).toBeNull()
    expect(screen.queryByText('Error')).toBeNull()
  })
})
