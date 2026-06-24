/**
 * @fileoverview Unit tests for the console URL filter module.
 *
 * Covers the constants (`TENANTS`/`ROLES`/`VERBS`/`RANGE_MS`/`RANGE_PRESETS`),
 * the token narrowers (`asChannel`/`asVerb`/`asSource`), `resolveWindow`, the
 * global-controls hook (`useNotificationQuery`), and the full filter compiler
 * (`useAuditQuery`) — the relative-range window, the absolute window, every
 * present/absent filter arm, and the `isRelative` guardrail — via a
 * `NuqsTestingAdapter`.
 *
 * @module lib/filters.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

import {
  RANGE_MS,
  RANGE_PRESETS,
  ROLES,
  TENANTS,
  VERBS,
  asChannel,
  asSource,
  asVerb,
  notificationQueryParsers,
  resolveWindow,
  useAuditQuery,
  useNotificationQuery,
} from './filters'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

/** Render a hook inside a memory-backed nuqs adapter seeded from `search`. */
function renderWith<T>(hook: () => T, search = '') {
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={vi.fn()}>
      {children}
    </NuqsTestingAdapter>
  )
  return renderHook(hook, { wrapper })
}

describe('constants', () => {
  /** TENANTS / ROLES are the demo identifiers and roles. */
  it('exports the demo tenants and roles', () => {
    expect(TENANTS).toEqual(['acme', 'globex'])
    expect(ROLES).toEqual(['viewer', 'operator', 'admin'])
  })

  /** VERBS mirrors the audit verb union. */
  it('exports the six audit verbs', () => {
    expect(VERBS).toContain('sent')
    expect(VERBS).toContain('max_attempts_exceeded')
    expect(VERBS.length).toBe(6)
  })

  /** Every range preset has a millisecond value. */
  it('maps every range preset to a duration', () => {
    for (const preset of RANGE_PRESETS) expect(RANGE_MS[preset]).toBeGreaterThan(0)
  })

  /** The parser map carries the global + Explorer filter keys. */
  it('declares the global and explorer parser keys', () => {
    const keys = Object.keys(notificationQueryParsers).sort()
    expect(keys).toEqual(
      [
        'channel',
        'from',
        'id',
        'live',
        'provider',
        'purpose',
        'q',
        'range',
        'recipient',
        'role',
        'source',
        'tenantId',
        'to',
        'verb',
      ].sort(),
    )
  })
})

describe('token narrowers', () => {
  /** asChannel accepts a known channel and rejects others. */
  it('narrows a known channel and rejects an unknown one', () => {
    expect(asChannel('email')).toBe('email')
    expect(asChannel('nope')).toBeUndefined()
  })

  /** asVerb accepts a known verb and rejects others. */
  it('narrows a known verb and rejects an unknown one', () => {
    expect(asVerb('sent')).toBe('sent')
    expect(asVerb('nope')).toBeUndefined()
  })

  /** asSource accepts the two source values and rejects others. */
  it('narrows the two sources and rejects an unknown one', () => {
    expect(asSource('service')).toBe('service')
    expect(asSource('interceptor')).toBe('interceptor')
    expect(asSource('nope')).toBeUndefined()
  })
})

describe('resolveWindow', () => {
  /** A known preset yields an ISO from/to window. */
  it('resolves a known preset to an ISO window', () => {
    const window = resolveWindow('15m')
    expect(window).not.toBeNull()
    expect(new Date(window!.from).getTime()).toBeLessThan(new Date(window!.to).getTime())
  })

  /** An unknown token yields null (absolute / unset). */
  it('returns null for an unknown token', () => {
    expect(resolveWindow('')).toBeNull()
  })

  /** The bounds quantize "now" to the 30s grid, and `from` is exactly the range before `to`. */
  it('quantizes the window to the 30s grid with from = to - range', () => {
    /**
     * Scenario: a fixed "now" at 12:00:47.5.
     * Contract: `to` floors to the 30s grid (12:00:30) and `from` is exactly the 15-minute span
     * earlier — pinning the `floor(now / quantum) * quantum` math so a flipped operator is caught.
     */
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T12:00:47.500Z'))
    const window = resolveWindow('15m')
    expect(window).not.toBeNull()
    expect(window!.to).toBe('2026-06-23T12:00:30.000Z')
    expect(window!.from).toBe('2026-06-23T11:45:30.000Z')
  })
})

describe('useNotificationQuery', () => {
  /** Default global control state. */
  it('returns control defaults when URL has no params', () => {
    const { result } = renderWith(useNotificationQuery, '')
    expect(result.current.tenantId).toBe('')
    expect(result.current.role).toBe('viewer')
    expect(result.current.live).toBe(false)
    expect(typeof result.current.setQuery).toBe('function')
  })

  /** Seeded global controls are read back. */
  it('reads seeded tenant/role/live from the URL', () => {
    const { result } = renderWith(useNotificationQuery, '?tenantId=acme&role=admin&live=true')
    expect(result.current.tenantId).toBe('acme')
    expect(result.current.role).toBe('admin')
    expect(result.current.live).toBe(true)
  })
})

describe('useAuditQuery', () => {
  /** A fully-populated relative URL compiles every present arm + a relative window. */
  it('compiles every filter field and a relative window', () => {
    const { result } = renderWith(
      useAuditQuery,
      '?tenantId=acme&role=admin&live=true&range=15m&channel=email&verb=sent' +
        '&recipient=j***@acme.com&purpose=login&provider=nodemailer&source=interceptor&q=boom',
    )
    const { query } = result.current
    expect(query).toMatchObject({
      role: 'admin',
      tenantId: 'acme',
      channel: 'email',
      verb: 'sent',
      recipient: 'j***@acme.com',
      purpose: 'login',
      provider: 'nodemailer',
      source: 'interceptor',
      q: 'boom',
    })
    expect(query.from).toBeDefined()
    expect(query.to).toBeDefined()
    expect(result.current.isRelative).toBe(true)
    expect(result.current.live).toBe(true)
  })

  /** A default URL omits every absent arm and is relative (no window pinned). */
  it('omits absent fields and reports relative on an empty URL', () => {
    const { result } = renderWith(useAuditQuery, '')
    // `toStrictEqual` so a spread that leaks an `undefined`-valued key (channel/verb/source) is caught.
    expect(result.current.query).toStrictEqual({ role: 'viewer' })
    expect(result.current.isRelative).toBe(true)
    expect(result.current.selectedId).toBe('')
  })

  /** An absolute window (from/to, no range) is reported as non-relative. */
  it('uses an absolute window and reports non-relative', () => {
    const { result } = renderWith(
      useAuditQuery,
      '?from=2026-06-23T00:00:00.000Z&to=2026-06-23T01:00:00.000Z&id=row-9',
    )
    expect(result.current.query.from).toBe('2026-06-23T00:00:00.000Z')
    expect(result.current.query.to).toBe('2026-06-23T01:00:00.000Z')
    expect(result.current.isRelative).toBe(false)
    expect(result.current.selectedId).toBe('row-9')
  })

  /** An invalid channel/verb/source token is dropped (narrowers reject it). */
  it('drops invalid channel/verb/source tokens', () => {
    const { result } = renderWith(useAuditQuery, '?channel=nope&verb=nope&source=nope')
    expect(result.current.query.channel).toBeUndefined()
    expect(result.current.query.verb).toBeUndefined()
    expect(result.current.query.source).toBeUndefined()
  })

  /** The relative-range ticker advances the window each time the quantum interval fires. */
  it('advances the relative window when the quantum interval fires', () => {
    /**
     * Scenario: a relative `range=15m` with the clock advancing past two quantum ticks.
     * Contract: each interval fire bumps the tick counter, recomputing the memo so `to` advances to
     * the new quantized "now" — proving the interval, the `t + 1` updater, and the memo deps all fire.
     */
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'))
    const { result } = renderWith(useAuditQuery, '?range=15m')
    const first = result.current.query.to

    vi.setSystemTime(new Date('2026-06-23T12:00:30.000Z'))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    const second = result.current.query.to

    vi.setSystemTime(new Date('2026-06-23T12:01:00.000Z'))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    const third = result.current.query.to

    expect(second).not.toBe(first)
    expect(third).not.toBe(second)
  })

  /** An absolute window never starts the ticker, so its `to` is frozen as time passes. */
  it('does not tick (or change `to`) for an absolute window', () => {
    /**
     * Scenario: an absolute `from`/`to` (no relative preset) with the clock advancing.
     * Contract: the ticker `useEffect` early-returns for a non-relative range, so firing the timer
     * leaves the pinned `to` unchanged — proving the relative-only guard.
     */
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'))
    const { result } = renderWith(
      useAuditQuery,
      '?from=2026-06-23T00:00:00.000Z&to=2026-06-23T01:00:00.000Z',
    )
    const before = result.current.query.to

    vi.setSystemTime(new Date('2026-06-23T12:05:00.000Z'))
    act(() => {
      vi.advanceTimersByTime(5 * 60_000)
    })

    expect(result.current.query.to).toBe(before)
    expect(result.current.query.to).toBe('2026-06-23T01:00:00.000Z')
  })

  /** `isRelative` is true whenever a relative `range` is set, even alongside from/to. */
  it('reports relative when a range is set even with from/to present', () => {
    const { result } = renderWith(
      useAuditQuery,
      '?range=15m&from=2026-06-23T00:00:00.000Z&to=2026-06-23T01:00:00.000Z',
    )
    expect(result.current.isRelative).toBe(true)
  })

  /** A half-open absolute window (only `from`, or only `to`) is non-relative. */
  it.each([['?from=2026-06-23T00:00:00.000Z'], ['?to=2026-06-23T01:00:00.000Z']])(
    'reports non-relative for the half-open absolute window %s',
    (search) => {
      const { result } = renderWith(useAuditQuery, search)
      expect(result.current.isRelative).toBe(false)
    },
  )

  /** The ticker interval runs only for a relative range and is torn down on unmount. */
  it('schedules the ticker only for a relative range and clears it on unmount', () => {
    /**
     * Scenario: an absolute window vs a relative preset, comparing scheduled timer counts.
     * Contract: only a relative preset schedules the quantum interval (the effect early-returns for
     * a non-relative range), and unmount clears it — proving the relative-only guard and the cleanup.
     */
    vi.useFakeTimers()
    const absolute = renderWith(useAuditQuery, '?from=2026-06-23T00:00:00.000Z')
    const absoluteTimers = vi.getTimerCount()
    absolute.unmount()

    const relative = renderWith(useAuditQuery, '?range=15m')
    const relativeTimers = vi.getTimerCount()
    expect(relativeTimers).toBeGreaterThan(absoluteTimers)

    relative.unmount()
    expect(vi.getTimerCount()).toBeLessThan(relativeTimers)
  })
})
