/**
 * @fileoverview Unit tests for {@link useFollowMode}.
 *
 * Drives a real scroll container (configurable scroll geometry) and a growing
 * row count to cover: pinned auto-scroll, scroll-up pause + newCount
 * accumulation, the non-positive-delta no-op, jumpToLatest/pause/resume, the
 * at-bottom newCount reset, and the null-ref safety arms.
 *
 * @module hooks/use-follow-mode.test
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'

import { useFollowMode } from './use-follow-mode'

/** Create a scroll container with the given geometry, attached to the document. */
function makeContainer(
  scrollHeight: number,
  clientHeight: number,
  scrollTop: number,
): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: scrollTop })
  document.body.appendChild(el)
  return el
}

/** Wrap an element (or null) in a ref object. */
function refOf(el: HTMLDivElement | null): RefObject<HTMLDivElement | null> {
  return { current: el }
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('useFollowMode', () => {
  /** Pinned to the bottom, a new row auto-scrolls the container to the bottom. */
  it('auto-scrolls to the bottom on new rows when pinned', () => {
    const el = makeContainer(1000, 800, 200) // at bottom (1000-200-800=0 < 48)
    const ref = refOf(el)
    const { rerender, result } = renderHook(({ count }) => useFollowMode(ref, count), {
      initialProps: { count: 0 },
    })
    expect(result.current.paused).toBe(false)
    rerender({ count: 1 })
    expect(el.scrollTop).toBe(1000)
  })

  /** Scrolled up: follow pauses and new rows accumulate the newCount. */
  it('pauses and accumulates newCount when scrolled up', () => {
    const el = makeContainer(1000, 200, 0) // far from bottom
    const ref = refOf(el)
    const { rerender, result } = renderHook(({ count }) => useFollowMode(ref, count), {
      initialProps: { count: 0 },
    })
    act(() => {
      fireEvent.scroll(el)
    })
    expect(result.current.paused).toBe(true)
    rerender({ count: 2 })
    expect(result.current.newCount).toBe(2)
  })

  /** A non-positive delta (count unchanged) is a no-op. */
  it('ignores a non-positive row delta', () => {
    const el = makeContainer(1000, 800, 200)
    const ref = refOf(el)
    const { rerender, result } = renderHook(({ count }) => useFollowMode(ref, count), {
      initialProps: { count: 3 },
    })
    rerender({ count: 3 })
    expect(result.current.newCount).toBe(0)
  })

  /** Scrolling back to the bottom clears the accumulated newCount. */
  it('clears newCount when scrolled back to the bottom', () => {
    const el = makeContainer(1000, 200, 0)
    const ref = refOf(el)
    const { rerender, result } = renderHook(({ count }) => useFollowMode(ref, count), {
      initialProps: { count: 0 },
    })
    act(() => {
      fireEvent.scroll(el)
    })
    rerender({ count: 1 })
    expect(result.current.newCount).toBe(1)
    // Back to the bottom: 1000 - 800 - 200 = 0 < 48 → pinned again, newCount clears.
    Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: 800 })
    act(() => {
      fireEvent.scroll(el)
    })
    expect(result.current.newCount).toBe(0)
  })

  /** jumpToLatest scrolls to the bottom and resets the newCount. */
  it('jumps to the latest and resets the count', () => {
    const el = makeContainer(1000, 200, 0)
    const ref = refOf(el)
    const { rerender, result } = renderHook(({ count }) => useFollowMode(ref, count), {
      initialProps: { count: 0 },
    })
    act(() => {
      fireEvent.scroll(el)
    })
    rerender({ count: 1 })
    act(() => {
      result.current.jumpToLatest()
    })
    expect(el.scrollTop).toBe(1000)
    expect(result.current.newCount).toBe(0)
  })

  /** pause sets paused; resume scrolls to the bottom and clears the count. */
  it('pauses and resumes explicitly', () => {
    const el = makeContainer(1000, 800, 200)
    const ref = refOf(el)
    const { result } = renderHook(({ count }) => useFollowMode(ref, count), {
      initialProps: { count: 0 },
    })
    act(() => {
      result.current.pause()
    })
    expect(result.current.paused).toBe(true)
    act(() => {
      result.current.resume()
    })
    expect(el.scrollTop).toBe(1000)
    expect(result.current.paused).toBe(false)
  })

  /** A null container ref is safe across every control + the new-row effect. */
  it('is safe when the container ref is null', () => {
    const ref = refOf(null)
    const { rerender, result } = renderHook(({ count }) => useFollowMode(ref, count), {
      initialProps: { count: 0 },
    })
    rerender({ count: 1 }) // new row with a null ref → accumulate, no throw
    expect(result.current.newCount).toBe(1)
    act(() => {
      result.current.jumpToLatest()
      result.current.resume()
    })
    expect(result.current.newCount).toBe(0)
  })
})
