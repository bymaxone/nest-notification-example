/**
 * @fileoverview Component tests for {@link QueryBar}.
 *
 * Renders under a nuqs adapter and covers: seeding the inputs from the URL, the
 * empty-URL fallback, submitting via the Search button and the Enter key (asserting
 * the exact URL written) plus the non-Enter no-op on both inputs, clear-all, the
 * focus/blur guard, and the external-sync effect that updates the inputs only while
 * not focused. A sibling setter drives an external URL change to exercise the sync.
 *
 * @module components/explorer/query-bar.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

import { useAuditQuery } from '@/lib/filters'
import { QueryBar } from './query-bar'

/** A sibling control that mutates the URL recipient/purpose from outside the bar. */
function ExternalSetter(): ReactElement {
  const { setQuery } = useAuditQuery()
  return (
    <button type="button" onClick={() => void setQuery({ recipient: 'ext-r', purpose: 'ext-p' })}>
      external set
    </button>
  )
}

/** Render the bar (+ external setter) under a nuqs adapter, returning the URL spy. */
function renderBar(
  search = '',
): ReturnType<typeof render> & { onUrlUpdate: ReturnType<typeof vi.fn> } {
  const onUrlUpdate = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={onUrlUpdate}>
      {children}
    </NuqsTestingAdapter>
  )
  return Object.assign(
    render(
      <>
        <QueryBar />
        <ExternalSetter />
      </>,
      { wrapper },
    ),
    { onUrlUpdate },
  )
}

/** The recipient input. */
const recipientBox = (): HTMLInputElement =>
  screen.getByLabelText('Recipient search') as HTMLInputElement
/** The purpose input. */
const purposeBox = (): HTMLInputElement =>
  screen.getByLabelText('Purpose search') as HTMLInputElement
/** The most recent URL write's params. */
const lastWrite = (spy: ReturnType<typeof vi.fn>): URLSearchParams =>
  spy.mock.calls[spy.mock.calls.length - 1]![0].searchParams as URLSearchParams
/** Wait past nuqs' throttle window so a stray submit's URL write would have flushed. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 200))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('QueryBar', () => {
  /** The inputs seed from the URL filter state. */
  it('seeds the recipient and purpose inputs from the URL', () => {
    renderBar('?recipient=j***@acme.com&purpose=login')
    expect(recipientBox()).toHaveValue('j***@acme.com')
    expect(purposeBox()).toHaveValue('login')
  })

  /** With no URL filter the inputs render empty (the `?? ''` sync fallback). */
  it('renders both inputs empty when the URL has no filter', () => {
    renderBar()
    expect(recipientBox()).toHaveValue('')
    expect(purposeBox()).toHaveValue('')
  })

  /** Typing + Search writes the exact recipient/purpose to the URL. */
  it('writes the typed recipient and purpose on Search', async () => {
    const { onUrlUpdate } = renderBar()
    fireEvent.change(recipientBox(), { target: { value: 'k***@a.com' } })
    fireEvent.change(purposeBox(), { target: { value: 'reset' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastWrite(onUrlUpdate).get('recipient')).toBe('k***@a.com')
    expect(lastWrite(onUrlUpdate).get('purpose')).toBe('reset')
  })

  /** Pressing Enter in the recipient submits the typed value. */
  it('submits the recipient on Enter', async () => {
    const { onUrlUpdate } = renderBar()
    fireEvent.change(recipientBox(), { target: { value: 'r1' } })
    fireEvent.keyDown(recipientBox(), { key: 'Enter' })
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastWrite(onUrlUpdate).get('recipient')).toBe('r1')
  })

  /** A non-Enter key in the recipient never submits (even after the throttle window). */
  it('ignores a non-Enter key in the recipient', async () => {
    const { onUrlUpdate } = renderBar()
    fireEvent.change(recipientBox(), { target: { value: 'r1' } })
    fireEvent.keyDown(recipientBox(), { key: 'a' })
    await settle()
    expect(onUrlUpdate).not.toHaveBeenCalled()
  })

  /** Pressing Enter in the purpose submits the typed value. */
  it('submits the purpose on Enter', async () => {
    const { onUrlUpdate } = renderBar()
    fireEvent.change(purposeBox(), { target: { value: 'p1' } })
    fireEvent.keyDown(purposeBox(), { key: 'Enter' })
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastWrite(onUrlUpdate).get('purpose')).toBe('p1')
  })

  /** A non-Enter key in the purpose never submits (even after the throttle window). */
  it('ignores a non-Enter key in the purpose', async () => {
    const { onUrlUpdate } = renderBar()
    fireEvent.change(purposeBox(), { target: { value: 'p1' } })
    fireEvent.keyDown(purposeBox(), { key: 'x' })
    await settle()
    expect(onUrlUpdate).not.toHaveBeenCalled()
  })

  /** Clear-all resets the inputs and clears every filter from the URL. */
  it('clears all filters', async () => {
    const { onUrlUpdate } = renderBar('?recipient=j***@acme.com&purpose=login&channel=email')
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(recipientBox()).toHaveValue('')
    expect(purposeBox()).toHaveValue('')
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastWrite(onUrlUpdate).get('recipient')).toBeNull()
    expect(lastWrite(onUrlUpdate).get('channel')).toBeNull()
  })

  /** Clear-all while an input is focused still empties it (the explicit local reset). */
  it('empties a focused input on clear-all even without a re-sync', () => {
    renderBar()
    fireEvent.focus(recipientBox())
    fireEvent.change(recipientBox(), { target: { value: 'typing' } })
    fireEvent.focus(purposeBox())
    fireEvent.change(purposeBox(), { target: { value: 'typing2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(recipientBox()).toHaveValue('')
    expect(purposeBox()).toHaveValue('')
  })

  /** An external URL change re-syncs both inputs while neither is focused. */
  it('syncs both inputs from an external URL change when not focused', async () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'external set' }))
    await waitFor(() => expect(recipientBox()).toHaveValue('ext-r'))
    expect(purposeBox()).toHaveValue('ext-p')
  })

  /** A focused input is NOT overwritten by an external URL change. */
  it('does not overwrite a focused input on an external sync', async () => {
    const { onUrlUpdate } = renderBar()
    fireEvent.focus(recipientBox())
    fireEvent.change(recipientBox(), { target: { value: 'typing' } })
    fireEvent.click(screen.getByRole('button', { name: 'external set' }))
    // The external change did write the URL (the focus guard, not a no-op, blocks the sync)…
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastWrite(onUrlUpdate).get('recipient')).toBe('ext-r')
    // …yet the focused recipient keeps the in-progress text.
    expect(recipientBox()).toHaveValue('typing')
  })

  /** After blur, an external URL change resumes syncing the previously-focused input. */
  it('resumes syncing a previously-focused input after blur', async () => {
    renderBar()
    fireEvent.focus(recipientBox())
    fireEvent.change(recipientBox(), { target: { value: 'typing' } })
    fireEvent.blur(recipientBox())
    fireEvent.click(screen.getByRole('button', { name: 'external set' }))
    await waitFor(() => expect(recipientBox()).toHaveValue('ext-r'))
  })

  /** Focusing the PURPOSE input also freezes the shared focus guard. */
  it('does not overwrite a focused purpose input on an external sync', async () => {
    const { onUrlUpdate } = renderBar()
    fireEvent.focus(purposeBox())
    fireEvent.change(purposeBox(), { target: { value: 'typing-p' } })
    fireEvent.click(screen.getByRole('button', { name: 'external set' }))
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastWrite(onUrlUpdate).get('purpose')).toBe('ext-p')
    expect(purposeBox()).toHaveValue('typing-p')
  })

  /** Blurring the purpose input clears the shared guard so syncing resumes. */
  it('resumes syncing after the purpose input blurs', async () => {
    renderBar()
    fireEvent.focus(purposeBox())
    fireEvent.change(purposeBox(), { target: { value: 'typing-p' } })
    fireEvent.blur(purposeBox())
    fireEvent.click(screen.getByRole('button', { name: 'external set' }))
    await waitFor(() => expect(purposeBox()).toHaveValue('ext-p'))
  })
})
