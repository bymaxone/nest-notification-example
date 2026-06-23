/**
 * @fileoverview useAuditStream — SSE live tail over a bounded, rAF-flushed buffer.
 *
 * Opens an `EventSource` against the same-origin proxy (`/api/audit/stream`, which
 * injects the RBAC headers an EventSource cannot set). Incoming events are
 * coalesced and flushed on `requestAnimationFrame` into a bounded ring buffer
 * (10k lines, drop-oldest) so a high-rate stream never freezes the tab. The
 * browser handles auto-reconnect + `Last-Event-ID` resume; keep-alive `ping`
 * events (empty `data`) are ignored. The stream auto-stops after a long idle.
 *
 * @module lib/sse
 */

'use client'

import { type MutableRefObject, useEffect, useRef, useState } from 'react'
import { encodeAuditQuery } from './api-client'
import type { AuditQuery, NotificationLog } from './types'

/** Ring-buffer capacity — newest 10k rows, oldest dropped. */
const BUFFER_CAPACITY = 10_000

/** Auto-stop the stream after this long with no data message (idle guardrail). */
const IDLE_STOP_MS = 5 * 60_000

/** Idle-check tick interval (ms). */
const IDLE_CHECK_MS = 30_000

/**
 * Bounded FIFO buffer that drops the oldest items past its capacity.
 *
 * @typeParam T - The buffered item type.
 */
export class RingBuffer<T> {
  private buf: T[] = []

  /**
   * @param capacity - Maximum retained items.
   */
  constructor(private readonly capacity: number) {}

  /**
   * Append items, evicting the oldest to stay within capacity.
   *
   * @param items - Items to append.
   */
  pushMany(items: T[]): void {
    this.buf.push(...items)
    if (this.buf.length > this.capacity) {
      this.buf.splice(0, this.buf.length - this.capacity)
    }
  }

  /**
   * A defensive copy of the current contents (oldest→newest).
   *
   * @returns The buffered items.
   */
  snapshot(): T[] {
    return [...this.buf]
  }

  /** Empty the buffer. */
  clear(): void {
    this.buf = []
  }
}

/** The live audit tail result. */
export interface AuditStream {
  /** Buffered live rows, oldest→newest. */
  rows: NotificationLog[]
  /** Empty the buffer (the "Clear" control). */
  clear: () => void
  /** Whether the EventSource is currently open. */
  isConnected: boolean
  /** True after a terminal connection failure (the browser will not reconnect). */
  isFailed: boolean
}

/** Internal refs threaded through the stream subscription callback. */
interface StreamRefs {
  pendingRef: MutableRefObject<NotificationLog[]>
  rafRef: MutableRefObject<number>
  buffer: RingBuffer<NotificationLog>
  setRows: (rows: NotificationLog[]) => void
  setConnected: (v: boolean) => void
  setFailed: (v: boolean) => void
}

/**
 * Open an `EventSource` at `url`, wire the RBAC-aware message handlers, and
 * start the idle-stop timer. Returns a cleanup function that closes the source,
 * clears the timer, and cancels any pending rAF frame.
 *
 * @param url - The proxy URL (including query params).
 * @param refs - Mutable state refs shared with the hook.
 * @returns A teardown function for use as the `useEffect` cleanup return.
 */
function subscribeAuditStream(url: string, refs: StreamRefs): () => void {
  const { pendingRef, rafRef, buffer, setRows, setConnected, setFailed } = refs
  const source = new EventSource(url)
  let lastDataAt = Date.now()

  source.onopen = () => {
    setConnected(true)
    setFailed(false)
  }
  source.onerror = () => {
    setConnected(false)
    if (source.readyState === EventSource.CLOSED) setFailed(true)
  }
  source.onmessage = (event: MessageEvent<string>) => {
    if (!event.data) return // keep-alive ping — ignore
    let row: NotificationLog
    try {
      row = JSON.parse(event.data) as NotificationLog
    } catch {
      return // skip malformed frames
    }
    pendingRef.current.push(row)
    lastDataAt = Date.now()
    rafRef.current ||= requestAnimationFrame(() => {
      buffer.pushMany(pendingRef.current.splice(0))
      rafRef.current = 0
      setRows(buffer.snapshot())
    })
  }

  const idleTimer = setInterval(() => {
    if (Date.now() - lastDataAt > IDLE_STOP_MS) {
      source.close()
      setConnected(false)
      clearInterval(idleTimer)
    }
  }, IDLE_CHECK_MS)

  return () => {
    source.close()
    clearInterval(idleTimer)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }
}

/**
 * Subscribe to the SSE audit live tail for a filter.
 *
 * @param filter - The active filter (sent to the proxy as query params).
 * @param enabled - Whether to open the stream (gate this on the live toggle).
 * @returns The live {@link AuditStream}.
 */
export function useAuditStream(filter: AuditQuery, enabled: boolean): AuditStream {
  const bufferRef = useRef<RingBuffer<NotificationLog> | null>(null)
  const buffer = (bufferRef.current ??= new RingBuffer<NotificationLog>(BUFFER_CAPACITY))
  const pendingRef = useRef<NotificationLog[]>([])
  const rafRef = useRef(0)
  const [rows, setRows] = useState<NotificationLog[]>([])
  const [isConnected, setConnected] = useState(false)
  const [isFailed, setFailed] = useState(false)

  const role = filter.role ?? 'viewer'
  const url = `/api/audit/stream?${encodeAuditQuery(filter)}&role=${role}`

  useEffect(() => {
    if (!enabled) {
      setConnected(false)
      setFailed(false)
      return
    }
    setFailed(false)
    buffer.clear()
    pendingRef.current = []
    setRows([])
    return subscribeAuditStream(url, {
      pendingRef,
      rafRef,
      buffer,
      setRows,
      setConnected,
      setFailed,
    })
  }, [enabled, url, buffer])

  const clear = (): void => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    pendingRef.current = []
    buffer.clear()
    setRows([])
  }

  return { rows, clear, isConnected, isFailed }
}
