/**
 * @fileoverview Unit tests for {@link useAuditStream} and {@link RingBuffer}.
 *
 * Drives a fake `EventSource` (open / message / error / close) and a
 * controllable `requestAnimationFrame` queue so every branch is exercised
 * deterministically: the disabled gate, the open/error connection states
 * (terminal CLOSED vs transparent CONNECTING retry), keep-alive and malformed
 * frames, the rAF-flushed ring buffer, the idle auto-stop, `clear()`, and
 * effect cleanup. Fake timers drive the idle interval.
 *
 * @module lib/sse.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

import { RingBuffer, useAuditStream } from './sse'
import type { AuditFilter } from './api-client'
import type { RbacRole } from './filters'

/**
 * Minimal `EventSource` test double — exposes the handler slots the hook
 * assigns plus a mutable `readyState`, so a test can emit open/message/error
 * and inspect `close()`.
 */
class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static last: FakeEventSource | null = null

  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: (() => void) | null = null
  readyState = FakeEventSource.CONNECTING
  closeCount = 0

  constructor(public readonly url: string) {
    FakeEventSource.last = this
  }

  close(): void {
    this.closeCount += 1
    this.readyState = FakeEventSource.CLOSED
  }

  /** Emit a message event as the browser's `onmessage` would. */
  emit(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
}

/** The current EventSource instance under test. */
function source(): FakeEventSource {
  if (!FakeEventSource.last) throw new Error('no EventSource constructed')
  return FakeEventSource.last
}

/** Pending rAF callbacks keyed by handle, drained explicitly per test. */
const rafQueue = new Map<number, FrameRequestCallback>()
let rafSeq = 0

/** Drain all queued rAF callbacks (mimics a frame tick). */
function flushRaf(): void {
  const callbacks = [...rafQueue.entries()]
  rafQueue.clear()
  for (const [, cb] of callbacks) cb(performance.now())
}

/** A minimal valid filter. */
const filter: AuditFilter = { role: 'admin', tenantId: 'acme' }

beforeEach(() => {
  FakeEventSource.last = null
  rafQueue.clear()
  rafSeq = 0
  vi.useFakeTimers()
  // Stub global EventSource to use our fake.
  vi.stubGlobal('EventSource', FakeEventSource)
  // Stub requestAnimationFrame / cancelAnimationFrame.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafSeq
    rafQueue.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafQueue.delete(id)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  cleanup()
  vi.clearAllMocks()
})

// ── RingBuffer ──────────────────────────────────────────────────────────────

describe('RingBuffer', () => {
  /** Items below capacity are retained in order. */
  it('retains items within capacity', () => {
    const buf = new RingBuffer<number>(3)
    buf.pushMany([1, 2])
    expect(buf.snapshot()).toEqual([1, 2])
  })

  /** Items exceeding capacity evict the oldest. */
  it('drops oldest items when capacity is exceeded', () => {
    const buf = new RingBuffer<number>(3)
    buf.pushMany([1, 2, 3, 4])
    expect(buf.snapshot()).toEqual([2, 3, 4])
  })

  /** Clear empties the buffer. */
  it('clears all items', () => {
    const buf = new RingBuffer<number>(10)
    buf.pushMany([1, 2, 3])
    buf.clear()
    expect(buf.snapshot()).toEqual([])
  })

  /** Snapshot returns a defensive copy — mutations don't affect the internal buffer. */
  it('snapshot returns a defensive copy', () => {
    const buf = new RingBuffer<number>(10)
    buf.pushMany([1])
    const snap = buf.snapshot()
    snap.push(99)
    expect(buf.snapshot()).toEqual([1])
  })
})

// ── useAuditStream ──────────────────────────────────────────────────────────

describe('useAuditStream', () => {
  /** When disabled, no EventSource is constructed and connected stays false. */
  it('does not open a connection when disabled', () => {
    renderHook(() => useAuditStream(filter, false))
    expect(FakeEventSource.last).toBeNull()
  })

  /** When enabled, an EventSource is constructed at the proxy URL. */
  it('opens a connection to the audit stream proxy when enabled', () => {
    renderHook(() => useAuditStream(filter, true))
    expect(FakeEventSource.last).toBeTruthy()
    expect(source().url).toContain('/api/audit/stream')
    expect(source().url).toContain('role=admin')
  })

  /** When the filter omits `role`, the fallback default "viewer" is used in the URL. */
  it('defaults role to viewer when filter.role is undefined', () => {
    renderHook(() => useAuditStream({ tenantId: 'acme' }, true))
    expect(source().url).toContain('role=viewer')
  })

  /** onopen sets connected = true. */
  it('sets connected to true on open', async () => {
    const { result } = renderHook(() => useAuditStream(filter, true))
    await act(() => {
      source().onopen?.()
    })
    expect(result.current.isConnected).toBe(true)
    expect(result.current.isFailed).toBe(false)
  })

  /** An error with CLOSED readyState marks the stream as failed. */
  it('marks failed on a terminal CLOSED error', async () => {
    const { result } = renderHook(() => useAuditStream(filter, true))
    await act(() => {
      source().readyState = FakeEventSource.CLOSED
      source().onerror?.()
    })
    expect(result.current.isConnected).toBe(false)
    expect(result.current.isFailed).toBe(true)
  })

  /** An error with CONNECTING readyState (retry) does not mark failed. */
  it('does not mark failed on a CONNECTING (retry) error', async () => {
    const { result } = renderHook(() => useAuditStream(filter, true))
    await act(() => {
      source().readyState = FakeEventSource.CONNECTING
      source().onerror?.()
    })
    expect(result.current.isFailed).toBe(false)
  })

  /** An empty-data event (keep-alive ping) is ignored. */
  it('ignores empty-data keep-alive pings', async () => {
    const { result } = renderHook(() => useAuditStream(filter, true))
    await act(() => {
      source().emit('')
    })
    flushRaf()
    expect(result.current.rows).toHaveLength(0)
  })

  /** A malformed JSON frame is silently skipped. */
  it('skips malformed JSON frames', async () => {
    const { result } = renderHook(() => useAuditStream(filter, true))
    await act(() => {
      source().emit('{not-json')
    })
    flushRaf()
    expect(result.current.rows).toHaveLength(0)
  })

  /** A valid row frame is parsed and flushed into the buffer. */
  it('adds a valid row to the buffer after rAF flush', async () => {
    const { result } = renderHook(() => useAuditStream(filter, true))
    const row = {
      id: 'r1',
      tenantId: 'acme',
      channel: 'email',
      verb: 'send',
      recipient: 'a@b.com',
      status: 'success',
      errorCode: null,
      createdAt: '2026-06-23T00:00:00.000Z',
    }
    await act(() => {
      source().emit(JSON.stringify(row))
    })
    await act(() => {
      flushRaf()
    })
    expect(result.current.rows).toHaveLength(1)
    expect(result.current.rows[0]!.id).toBe('r1')
  })

  /** clear() empties the buffer and rows state. */
  it('clear() empties rows', async () => {
    const { result } = renderHook(() => useAuditStream(filter, true))
    const row = {
      id: 'r1',
      tenantId: 'acme',
      channel: 'email',
      verb: 'send',
      recipient: null,
      status: 'success',
      errorCode: null,
      createdAt: '2026-06-23T00:00:00.000Z',
    }
    await act(() => {
      source().emit(JSON.stringify(row))
    })
    await act(() => {
      flushRaf()
    })
    expect(result.current.rows).toHaveLength(1)
    await act(() => {
      result.current.clear()
    })
    expect(result.current.rows).toHaveLength(0)
  })

  /** Disabling the stream closes the EventSource and clears state. */
  it('closes the EventSource when disabled', async () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAuditStream(filter, enabled),
      { initialProps: { enabled: true } },
    )
    const es = source()
    await act(() => {
      rerender({ enabled: false })
    })
    expect(es.closeCount).toBeGreaterThan(0)
  })

  /** The idle timer closes the connection after IDLE_STOP_MS with no data. */
  it('closes the connection after an idle period', async () => {
    renderHook(() => useAuditStream(filter, true))
    const es = source()
    // Advance past the idle stop threshold (5min + check interval)
    await act(() => {
      vi.advanceTimersByTime(6 * 60_000)
    })
    expect(es.closeCount).toBeGreaterThan(0)
  })

  /** Cleanup on unmount closes the EventSource. */
  it('closes the EventSource on unmount', async () => {
    const { unmount } = renderHook(() => useAuditStream(filter, true))
    const es = source()
    await act(() => {
      unmount()
    })
    expect(es.closeCount).toBeGreaterThan(0)
  })

  /** clear() cancels a pending rAF before clearing the buffer. */
  it('clear() cancels a pending rAF frame', async () => {
    const { result } = renderHook(() => useAuditStream(filter, true))
    const row = {
      id: 'r1',
      tenantId: 'acme',
      channel: 'otp',
      verb: 'generate',
      recipient: null,
      status: 'success',
      errorCode: null,
      createdAt: '2026-06-23T00:00:00.000Z',
    }
    // Emit but do NOT flush rAF — a pending rAF frame exists
    await act(() => {
      source().emit(JSON.stringify(row))
    })
    // clear() should cancel the rAF and clear pending
    await act(() => {
      result.current.clear()
    })
    // Flushing after clear should not add the row back
    flushRaf()
    expect(result.current.rows).toHaveLength(0)
  })

  /**
   * The effect cleanup cancels a pending rAF when one exists at unmount time.
   * Exercises the `if (rafRef.current)` branch inside the cleanup returned by
   * `useEffect` — distinct from the `clear()` function which has its own guard.
   */
  it('cancels a pending rAF frame on unmount', async () => {
    const { unmount } = renderHook(() => useAuditStream(filter, true))
    const row = {
      id: 'r1',
      tenantId: 'acme',
      channel: 'email',
      verb: 'send',
      recipient: null,
      status: 'success',
      errorCode: null,
      createdAt: '2026-06-23T00:00:00.000Z',
    }
    // Emit without flushing rAF — a pending frame is queued in rafQueue.
    await act(() => {
      source().emit(JSON.stringify(row))
    })
    // The rAF should be pending.
    expect(rafQueue.size).toBeGreaterThan(0)
    // Unmount triggers the effect cleanup which should cancel the pending rAF.
    await act(() => {
      unmount()
    })
    // After cleanup + our stub cancelAnimationFrame, rafQueue is empty.
    expect(rafQueue.size).toBe(0)
  })

  /** Filter change resets the buffer and starts a new stream. */
  it('resets and reopens when the filter changes', async () => {
    const { result, rerender } = renderHook(
      ({ f }: { f: AuditFilter }) => useAuditStream(f, true),
      { initialProps: { f: { role: 'admin' as RbacRole } } },
    )
    const first = source()
    const row = {
      id: 'r1',
      tenantId: '',
      channel: 'email',
      verb: 'send',
      recipient: null,
      status: 'success',
      errorCode: null,
      createdAt: '2026-06-23T00:00:00.000Z',
    }
    await act(() => {
      first.emit(JSON.stringify(row))
    })
    await act(() => {
      flushRaf()
    })
    expect(result.current.rows).toHaveLength(1)
    // Changing the filter resets
    await act(() => {
      rerender({ f: { role: 'viewer' as RbacRole } })
    })
    expect(result.current.rows).toHaveLength(0)
  })
})
