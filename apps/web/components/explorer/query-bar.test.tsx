/**
 * @fileoverview Component tests for {@link QueryBar}.
 *
 * Renders under a nuqs adapter and covers: seeding the inputs from the URL,
 * submitting via the Search button and the Enter key (and the non-Enter no-op),
 * clear-all, the focus/blur guard, and the external-sync effect that updates the
 * inputs only while not focused.
 *
 * @module components/explorer/query-bar.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

import { QueryBar } from './query-bar'

/** Render the bar under a nuqs adapter, returning the render result + URL spy. */
function renderBar(
  search = '',
): ReturnType<typeof render> & { onUrlUpdate: ReturnType<typeof vi.fn> } {
  const onUrlUpdate = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={onUrlUpdate}>
      {children}
    </NuqsTestingAdapter>
  )
  return Object.assign(render(<QueryBar />, { wrapper }), { onUrlUpdate })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('QueryBar', () => {
  /** The inputs seed from the URL filter state. */
  it('seeds the recipient and purpose inputs from the URL', () => {
    renderBar('?recipient=j***@acme.com&purpose=login')
    expect(screen.getByLabelText('Recipient search')).toHaveValue('j***@acme.com')
    expect(screen.getByLabelText('Purpose search')).toHaveValue('login')
  })

  /** Typing + Search writes the recipient/purpose to the URL. */
  it('writes recipient/purpose on Search', async () => {
    const { onUrlUpdate } = renderBar()
    fireEvent.change(screen.getByLabelText('Recipient search'), { target: { value: 'k***@a.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
  })

  /** Pressing Enter submits; a non-Enter key does not. */
  it('submits on Enter and ignores other keys', async () => {
    const { onUrlUpdate } = renderBar()
    const input = screen.getByLabelText('Purpose search')
    fireEvent.keyDown(input, { key: 'a' })
    expect(onUrlUpdate).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
  })

  /** Clear-all resets the inputs and the URL filters. */
  it('clears all filters', async () => {
    const { onUrlUpdate } = renderBar('?recipient=j***@acme.com&purpose=login')
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByLabelText('Recipient search')).toHaveValue('')
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
  })

  /** Both inputs wire focus, change, blur, and key handlers. */
  it('exercises focus/change/blur/key handlers on both inputs', async () => {
    const { onUrlUpdate } = renderBar()
    const recipient = screen.getByLabelText('Recipient search')
    const purpose = screen.getByLabelText('Purpose search')
    fireEvent.focus(purpose)
    fireEvent.change(purpose, { target: { value: 'login' } })
    fireEvent.keyDown(recipient, { key: 'x' }) // recipient non-Enter no-op
    fireEvent.keyDown(recipient, { key: 'Enter' }) // recipient Enter submits
    fireEvent.keyDown(purpose, { key: 'Enter' }) // purpose Enter submits
    fireEvent.blur(purpose)
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(purpose).toHaveValue('login')
  })

  /** While an input is focused, an external URL change does not overwrite typing. */
  it('does not overwrite the focused input on an external sync', async () => {
    const { onUrlUpdate } = renderBar('?recipient=seed')
    const input = screen.getByLabelText('Recipient search')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'typing' } })
    // Submitting updates the URL while still focused; the sync effect must not clobber it.
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(input).toHaveValue('typing')
    fireEvent.blur(input)
    expect(input).toHaveValue('typing')
  })
})
