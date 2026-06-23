/**
 * Reusable NestJS pipe that validates a value against a Zod schema.
 *
 * Layer: app/common. Wraps `schema.safeParse(value)` and throws a structured
 * `BadRequestException` on failure. Generic over `TSchema` so each endpoint supplies
 * its own schema without losing inference on the validated output. The error never
 * echoes the rejected value — only a bounded list of `{ path, message }` issues.
 *
 * @module
 */
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'

/** Maximum number of validation issues reported, so a hostile payload cannot bloat the error. */
export const MAX_REPORTED_ISSUES = 10

/**
 * Parse `value` with `schema`; throw `BadRequestException` on failure.
 *
 * @typeParam TSchema - The Zod schema type.
 */
@Injectable()
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  /**
   * Validate and transform the incoming value.
   *
   * @param value - Raw value from the request (query params, body, etc.).
   * @returns The parsed, fully-defaulted output value.
   * @throws {BadRequestException} When schema validation fails; carries a bounded
   *   `errors` list of `{ path, message }` — never the rejected value.
   */
  transform(value: unknown): ReturnType<TSchema['parse']> {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      const errors = result.error.issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      throw new BadRequestException({ message: 'Validation failed', errors })
    }
    return result.data as ReturnType<TSchema['parse']>
  }
}
