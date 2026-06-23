/**
 * @fileoverview Unit tests for the Explorer column definitions.
 *
 * Renders the columns through a minimal TanStack-Table harness so every cell
 * renderer runs: the formatted (and invalid-fallback) time, the channel + verb
 * severity labels, the masked recipient, the present/absent purpose, the
 * provider, and the service/interceptor source badge.
 *
 * @module components/explorer/columns.test
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'

import { notificationColumns } from './columns'
import type { NotificationLog } from '@/lib/types'

/** Build an audit row, overriding only what a test needs. */
function makeRow(over: Partial<NotificationLog>): NotificationLog {
  return {
    id: 'r1',
    timestamp: '2026-06-23T09:08:07.006Z',
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

/** Render every column cell for one row via a real table instance. */
function CellRow({ row }: { row: NotificationLog }) {
  const table = useReactTable({
    data: [row],
    columns: notificationColumns,
    getCoreRowModel: getCoreRowModel(),
  })
  const tableRow = table.getRowModel().rows[0]
  if (tableRow === undefined) return null
  return (
    <div>
      {tableRow.getVisibleCells().map((cell) => (
        <span key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
      ))}
    </div>
  )
}

afterEach(cleanup)

describe('notificationColumns', () => {
  /** A service email row renders the labels, masked recipient, purpose, and service badge. */
  it('renders a service email row with severity labels and the service source', () => {
    render(<CellRow row={makeRow({})} />)
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('j***@acme.com')).toBeInTheDocument()
    expect(screen.getByText('login')).toBeInTheDocument()
    expect(screen.getByText('nodemailer')).toBeInTheDocument()
    expect(screen.getByText('service')).toBeInTheDocument()
    // Seconds + millis are timezone-independent (the hour shifts with the local offset).
    expect(screen.getByText(/^\d{2}:\d{2}:07\.006$/)).toBeInTheDocument()
  })

  /** An interceptor OTP row with no purpose renders the dash + interceptor badge. */
  it('renders an interceptor row with an em dash purpose and interceptor source', () => {
    render(
      <CellRow
        row={makeRow({
          channel: 'otp',
          verb: 'failed',
          purpose: null,
          providerName: '__interceptor__',
          timestamp: 'not-a-date',
        })}
      />,
    )
    expect(screen.getByText('OTP')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('interceptor')).toBeInTheDocument()
    expect(screen.getByText('not-a-date')).toBeInTheDocument() // invalid timestamp echoed
  })
})
