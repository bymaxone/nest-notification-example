/**
 * @fileoverview Unit tests for the chart series metadata.
 *
 * Verifies every verb carries colour + icon + label, the delivery series is the
 * sent/failed pair, and the palette helper wraps around its bounded list.
 *
 * @module lib/chart-series.test
 */
import { describe, expect, it } from 'vitest'

import { DELIVERY_SERIES, PALETTE, VERB_SERIES, colorForIndex } from './chart-series'

describe('VERB_SERIES', () => {
  /** Every verb descriptor carries a colour, icon, and label. */
  it('describes every verb with colour + icon + label', () => {
    for (const series of Object.values(VERB_SERIES)) {
      expect(series.color).toMatch(/^#/)
      expect(series.label.length).toBeGreaterThan(0)
      expect(series.icon).toBeDefined()
    }
  })
})

describe('DELIVERY_SERIES', () => {
  /** The delivery line plots sent then failed. */
  it('is the sent/failed pair', () => {
    expect(DELIVERY_SERIES.map((s) => s.key)).toEqual(['sent', 'failed'])
  })
})

describe('colorForIndex', () => {
  /** Indexes within the palette return their colour. */
  it('returns the palette colour for an in-range index', () => {
    expect(colorForIndex(0)).toBe(PALETTE[0])
    expect(colorForIndex(2)).toBe(PALETTE[2])
  })

  /** Indexes past the end wrap around. */
  it('wraps around the palette', () => {
    expect(colorForIndex(PALETTE.length)).toBe(PALETTE[0])
  })

  /** A negative index lands out of range and falls back to the default colour. */
  it('falls back to a default colour for an out-of-range index', () => {
    expect(colorForIndex(-1)).toBe('#60a5fa')
  })
})
