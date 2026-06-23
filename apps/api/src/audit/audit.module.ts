/**
 * @fileoverview Wires the audit read-API: query endpoints, the SSE live tail, and the event bus.
 * @layer app/audit
 *
 * Declares the read controllers and provides the shared cursor codec + `where` compiler and the
 * in-process event bus. `AuditEventBus` is exported so the library write path
 * (`PrismaNotificationLogRepository`, constructed in `notification.config.ts`) can inject it to
 * broadcast freshly-persisted rows to the live tail.
 *
 * @module
 */
import { Module } from '@nestjs/common'

import { AuditController } from './audit.controller.js'
import { AuditSseController } from './audit-sse.controller.js'
import { AuditReadService } from './audit-read.service.js'
import { AuditEventBus } from './audit-event.bus.js'

/** Composes the `/audit/*` read-API and exports the live-tail event bus. */
@Module({
  controllers: [AuditController, AuditSseController],
  providers: [AuditReadService, AuditEventBus],
  exports: [AuditEventBus],
})
export class AuditModule {}
