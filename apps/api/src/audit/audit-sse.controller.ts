/**
 * @fileoverview `GET /audit/stream` — Server-Sent Events live tail of the delivery audit log.
 * @layer app/audit/sse
 *
 * A NestJS `@Sse()` handler returning an `Observable<MessageEvent>` that merges three sources:
 * a keyset replay of rows missed since `Last-Event-ID`, the live feed from {@link AuditEventBus},
 * and a 15-second keep-alive ping. Each event's `id` is the row's keyset cursor, so a reconnect
 * resumes exactly where the client left off. Anti-buffering headers stop Nginx/CDN proxies from
 * holding the stream.
 *
 * Feedback-loop guard: this route writes NO audit row. It only reads (replay `findMany`) and
 * subscribes to the in-process bus — so the live tail can never feed itself. The global
 * `NotificationAuditInterceptor` records only dispatch-shaped calls; this handler's arguments
 * (tenant id, `Last-Event-ID`, the filter DTO) are not a `DispatchInput`, so the interceptor
 * writes nothing for a stream request. Never add per-request/per-event audit logging here.
 *
 * Tenant scope is resolved server-side from `x-tenant-id`; a cross-tenant live entry is dropped
 * before the client filter runs. No OTP code or raw recipient is ever emitted (rows are masked
 * and code-free at the write seam).
 *
 * @module
 */
import { Controller, Header, Headers, Query, Sse } from '@nestjs/common'
import { fromEvent, interval, merge, Observable } from 'rxjs'
import { filter, map } from 'rxjs/operators'

import { TenantId } from '../common/tenant-id.decorator.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { auditQuerySchema, type AuditQueryDto } from './dto/audit-query.dto.js'
import type { AuditRestriction } from './audit-read.service.js'
import {
  AuditEventBus,
  matches,
  type AuditBusEntry,
  type AuditSseEvent,
} from './audit-event.bus.js'

/** Keep-alive interval in milliseconds — defeats idle-timeout proxies. */
const KEEP_ALIVE_MS = 15_000

/** `GET /audit/stream` live-tail controller. */
@Controller('audit')
export class AuditSseController {
  /**
   * @param bus - The in-process audit event bus (live feed + keyset replay).
   */
  constructor(private readonly bus: AuditEventBus) {}

  /**
   * Server-Sent Events live tail of the audit log.
   *
   * Merges a `Last-Event-ID` keyset replay, the live bus feed (tenant-guarded, then client
   * filter), and a keep-alive ping. A malformed `Last-Event-ID` degrades to live-only.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id` (the server-side restriction).
   * @param lastEventId - The `Last-Event-ID` header on reconnect (drives replay).
   * @param clientFilter - Validated filter DTO (same params as `GET /audit/logs`).
   * @returns A merged observable of replay, live, and keep-alive SSE events.
   */
  @Sse('stream')
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache')
  stream(
    @TenantId() tenantId: string,
    @Headers('last-event-id') lastEventId: string | undefined,
    @Query(new ZodValidationPipe(auditQuerySchema)) clientFilter: AuditQueryDto,
  ): Observable<AuditSseEvent> {
    const restriction: AuditRestriction = { tenantId }
    const replay$ = this.bus.replaySince(lastEventId, clientFilter, restriction)

    const live$ = fromEvent(this.bus.emitter, 'audit').pipe(
      filter((event): event is AuditBusEntry => {
        const entry = event as AuditBusEntry
        // Enforce the server-side tenant scope before the client filter — a reader can
        // never see another tenant's rows, even if the client filter would match.
        if (entry.tenantId !== tenantId) return false
        return matches(entry, clientFilter)
      }),
      map((entry) => this.bus.toEvent(entry)),
    )

    const keepAlive$ = interval(KEEP_ALIVE_MS).pipe(
      map((): AuditSseEvent => ({ data: '', type: 'ping' })),
    )

    return merge(replay$, live$, keepAlive$)
  }
}
