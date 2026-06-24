/**
 * Unit tests for {@link ZodValidationPipe}.
 *
 * Covers the success path (returns the parsed, typed data) and the failure path
 * (throws `BadRequestException` carrying `message: 'Validation failed'` plus a bounded
 * `{ path, message }` issue list — never the rejected value).
 */
import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from '@jest/globals'
import { z } from 'zod'

import { MAX_REPORTED_ISSUES, ZodValidationPipe } from './zod-validation.pipe.js'

describe('ZodValidationPipe', () => {
  it('returns the parsed data when validation succeeds', () => {
    /** A valid payload passes through and yields the schema-typed, defaulted output. */
    const schema = z.object({ name: z.string(), count: z.number().default(1) })
    const pipe = new ZodValidationPipe(schema)

    expect(pipe.transform({ name: 'acme' })).toEqual({ name: 'acme', count: 1 })
  })

  it('throws BadRequestException with a bounded issue list on failure', () => {
    /**
     * A failing payload must raise `BadRequestException` whose response carries
     * `message: 'Validation failed'` and an `errors` array of `{ path, message }` —
     * proving the rejected value itself is never echoed back.
     */
    const schema = z.object({ name: z.string() })
    const pipe = new ZodValidationPipe(schema)

    let caught: unknown
    try {
      pipe.transform({ name: 123 })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(BadRequestException)
    const response = (caught as BadRequestException).getResponse() as {
      message: string
      errors: Array<{ path: string; message: string }>
    }
    expect(response.message).toBe('Validation failed')
    expect(response.errors[0]?.path).toBe('name')
    expect(typeof response.errors[0]?.message).toBe('string')
  })

  it('dot-joins a nested issue path so the failing field is fully qualified', () => {
    /**
     * A nested schema failure must report the full path (`outer.inner`), proving the path
     * segments are joined with a dot — a blanked separator would collapse them to `outerinner`.
     */
    const schema = z.object({ outer: z.object({ inner: z.string() }) })
    const pipe = new ZodValidationPipe(schema)

    let caught: unknown
    try {
      pipe.transform({ outer: { inner: 123 } })
    } catch (error) {
      caught = error
    }

    const response = (caught as BadRequestException).getResponse() as {
      errors: Array<{ path: string; message: string }>
    }
    expect(response.errors[0]?.path).toBe('outer.inner')
  })

  it('caps the reported issues at the documented maximum', () => {
    /**
     * A payload that violates many fields must not produce an unbounded error list;
     * the pipe slices the issues to {@link MAX_REPORTED_ISSUES}.
     */
    const shape: Record<string, z.ZodString> = {}
    for (let index = 0; index < MAX_REPORTED_ISSUES + 5; index += 1) {
      shape[`field${index}`] = z.string()
    }
    const pipe = new ZodValidationPipe(z.object(shape))

    let caught: unknown
    try {
      pipe.transform({})
    } catch (error) {
      caught = error
    }

    const response = (caught as BadRequestException).getResponse() as {
      errors: Array<{ path: string; message: string }>
    }
    expect(response.errors).toHaveLength(MAX_REPORTED_ISSUES)
  })
})
