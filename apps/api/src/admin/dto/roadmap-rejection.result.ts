/**
 * @fileoverview Response type for an isolated v0.2-rejected library startup probe.
 * @layer api/admin
 *
 * Each admin probe endpoint compiles a throwaway DI container configured with a declared
 * but not-yet-implemented option, captures the real startup-rejection error from the
 * library, and returns this structured result.
 */

/**
 * Outcome of attempting to configure a v0.2-rejected library surface in isolation.
 *
 * When `rejected` is `true` the library threw at module construction — the expected
 * outcome; when `false` the library unexpectedly accepted the configuration, which
 * indicates the probe premise no longer holds.
 */
export interface RoadmapRejectionResult {
  /** Which rejected surface was attempted. */
  readonly attempt: 'sms' | 'push' | 'async-useclass'
  /** True when the library threw at module construction (the expected outcome). */
  readonly rejected: boolean
  /** The thrown error's constructor name (e.g. `'Error'`), `''` when it did not reject. */
  readonly errorName: string
  /** The thrown error's message verbatim from the library, `''` when it did not reject. */
  readonly errorMessage: string
}
