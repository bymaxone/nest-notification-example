/**
 * Ambient declaration for the slim `mjml` surface the MJML renderer uses.
 *
 * `mjml@4` ships no type definitions, and the DefinitelyTyped `@types/mjml` chain
 * resolves to a `mjml-core` v5 typing whose `mjml2html` is declared `async` — which
 * does not match the synchronous v4 runtime. Rather than pin a fragile transitive
 * `@types` version, this forward-declares only the members the renderer relies on,
 * matching the actual `mjml@4.18` runtime shape (a synchronous call returning the
 * rendered `html` plus a structured `errors` list).
 */
declare module 'mjml' {
  /** Validation strategy applied to the MJML document before rendering. */
  type MjmlValidationLevel = 'skip' | 'soft' | 'strict'

  /** The options accepted by {@link mjml2html}. */
  interface MjmlParsingOptions {
    validationLevel?: MjmlValidationLevel
  }

  /** A single validation error returned in `soft` mode. */
  interface MjmlError {
    message: string
  }

  /** The result of compiling an MJML document to HTML. */
  interface MjmlParseResults {
    html: string
    errors: MjmlError[]
  }

  /**
   * Compiles an MJML document to responsive HTML (synchronous in mjml v4).
   *
   * @param input - The MJML markup.
   * @param options - Parsing options (e.g. the validation level).
   * @returns The rendered HTML plus any validation errors.
   */
  export default function mjml2html(input: string, options?: MjmlParsingOptions): MjmlParseResults
}
