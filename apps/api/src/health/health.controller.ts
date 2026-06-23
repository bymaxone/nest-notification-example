/**
 * Liveness endpoint for `apps/api`.
 *
 * Layer: app/health. A self-contained controller with no provider dependencies so
 * the liveness probe responds even before the feature modules are initialised.
 *
 * @module
 */
import { Controller, Get } from '@nestjs/common'

/** Liveness controller mounted at the application root. */
@Controller()
export class HealthController {
  /**
   * Liveness probe.
   *
   * @returns A constant `{ status: 'ok' }` payload served with HTTP 200.
   */
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' }
  }
}
