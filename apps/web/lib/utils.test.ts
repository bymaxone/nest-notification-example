/**
 * @fileoverview Unit tests for the {@link cn} class-merge utility.
 *
 * Verifies deduplication of conflicting Tailwind utilities and transparent
 * pass-through of non-conflicting values — covers every branch of `clsx` +
 * `tailwind-merge` integration.
 *
 * @module lib/utils.test
 */
import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  /** A single class string is returned unchanged. */
  it('returns a single class string', () => {
    expect(cn('foo')).toBe('foo')
  })

  /** Multiple non-conflicting classes are joined with a space. */
  it('joins multiple non-conflicting classes', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center')
  })

  /** The later conflicting Tailwind utility wins (tailwind-merge dedup). */
  it('deduplicates conflicting Tailwind utilities — last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  /** Falsy values (undefined, false, null) are filtered out by clsx. */
  it('filters out falsy values', () => {
    expect(cn('base', undefined, false, null, 'extra')).toBe('base extra')
  })

  /** Object notation — keys with truthy values are included. */
  it('includes truthy object keys', () => {
    expect(cn({ active: true, hidden: false })).toBe('active')
  })

  /** Nested arrays are flattened by clsx before tailwind-merge dedup. */
  it('flattens nested arrays', () => {
    expect(cn(['a', 'b'], ['c'])).toBe('a b c')
  })

  /** An empty argument list yields an empty string. */
  it('returns an empty string for no arguments', () => {
    expect(cn()).toBe('')
  })
})
