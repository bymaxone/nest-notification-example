/**
 * @fileoverview Isolated module probe for v0.2-rejected library startup paths.
 * @layer api/admin
 *
 * Compiles throwaway DI containers with rejected options, captures the library's real
 * startup-rejection error messages, and discards the containers. The running
 * application's module is never touched.
 */
import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import type { DynamicModule } from '@nestjs/common'

import type { RoadmapRejectionResult } from './dto/roadmap-rejection.result.js'

/**
 * Compiles a throwaway module in an isolated DI container to capture the library's
 * real startup-rejection message, then discards the container. The running app's
 * module is never mutated.
 *
 * Both `forRoot` (synchronous validation) and `forRootAsync` (synchronous
 * `assertUseFactory`) throw inside `buildModule()`, so the single try/catch wrapping
 * that call captures both rejection forms.
 *
 * @param attempt - Which v0.2-rejected surface is being probed.
 * @param buildModule - Returns the DynamicModule whose construction the library rejects.
 * @returns The captured outcome — `rejected: true` plus the verbatim error when it
 * throws, `rejected: false` (no error text) when construction unexpectedly succeeds.
 */
export async function attemptConfigure(
  attempt: RoadmapRejectionResult['attempt'],
  buildModule: () => DynamicModule,
): Promise<RoadmapRejectionResult> {
  let moduleRef: TestingModule | undefined
  try {
    const dynamicModule = buildModule()
    moduleRef = await Test.createTestingModule({ imports: [dynamicModule] }).compile()
    await moduleRef.init()
    return { attempt, rejected: false, errorName: '', errorMessage: '' }
  } catch (caught: unknown) {
    const err = caught instanceof Error ? caught : new Error(String(caught))
    return { attempt, rejected: true, errorName: err.name, errorMessage: err.message }
  } finally {
    await moduleRef?.close()
  }
}
