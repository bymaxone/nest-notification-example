/**
 * @fileoverview `GET /audit/logs` — keyset-paginated read over the delivery audit log.
 * @layer app/audit/controller
 *
 * Serves the Audit Explorer table. Pagination is keyset on `(timestamp DESC, id DESC)` — never
 * OFFSET — for constant-time, stable results under concurrent inserts; a stale/foreign cursor
 * returns HTTP 410 so the client restarts from the top. The tenant scope is resolved server-side
 * from the trusted `x-tenant-id` header and ANDed into the `where`, so a query param can never
 * widen it.
 *
 * Dual-source semantics: the audit log carries rows from two sources, separable via the `source`
 * facet (see {@link AuditReadService}). The services emit lifecycle verbs
 * (`generated`/`verified`/`failed`/`cooldown_blocked`/`max_attempts_exceeded`) with the real
 * `providerName`; the library's `NotificationAuditInterceptor` emits one `sent`/`failed` row per
 * `/dispatch` with `providerName === '__interceptor__'`. `source=service` excludes the interceptor
 * rows, `source=interceptor` keeps only them, omitting it returns both. No OTP code or raw recipient
 * is ever returned — the stored rows are masked and code-free at the write seam.
 *
 * @module
 */
import { Controller, Get, GoneException, Query } from '@nestjs/common'
import type { NotificationLog, Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service.js'
import { TenantId } from '../common/tenant-id.decorator.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { auditQuerySchema, type AuditQueryDto } from './dto/audit-query.dto.js'
import {
  auditAggregateQuerySchema,
  type AuditAggregateQueryDto,
} from './dto/audit-aggregate-query.dto.js'
import { AuditReadService, StaleCursorError, type AuditRestriction } from './audit-read.service.js'
import { AuditAggregateService, type AuditAggregateRow } from './audit-aggregate.service.js'

/** One page of the keyset-paginated audit log. */
export interface AuditLogsPageResponse {
  /** The page of newest-first audit rows. */
  data: NotificationLog[]
  /** The opaque cursor to fetch the next page, or `null` when the last page was returned. */
  nextCursor: string | null
  /** `true` when a full page was returned (a next page may exist). */
  hasMore: boolean
}

/** `GET /audit/logs` and the sibling read endpoints under `/audit`. */
@Controller('audit')
export class AuditController {
  /**
   * @param prisma - The application's Prisma client (owns all read SQL).
   * @param audit - The shared cursor codec + `where` compiler.
   * @param aggregateService - The time-bucketed aggregation for the Overview charts.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditReadService,
    private readonly aggregateService: AuditAggregateService,
  ) {}

  /**
   * Keyset-paginated audit log — newest first.
   *
   * Compiles the filter into a `where`, applies the tuple keyset predicate
   * `(timestamp < cur.timestamp) OR (timestamp = cur.timestamp AND id < cur.id)` when a cursor is
   * supplied, orders `timestamp desc, id desc`, and returns at most `limit` rows plus the
   * `nextCursor`/`hasMore` envelope. The tenant restriction is resolved from `x-tenant-id`.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id` (never the query/body).
   * @param q - Validated filter + pagination params.
   * @returns A page of `NotificationLog` rows with `nextCursor` and `hasMore`.
   * @throws {GoneException} HTTP 410 when the cursor is stale, foreign, or malformed.
   * @throws {BadRequestException} HTTP 400 when query params fail Zod validation.
   */
  @Get('logs')
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(auditQuerySchema)) q: AuditQueryDto,
  ): Promise<AuditLogsPageResponse> {
    const restriction: AuditRestriction = { tenantId }
    const where = this.audit.buildWhere(q, restriction)

    if (q.cursor !== undefined) {
      const existing = Array.isArray(where.AND) ? where.AND : []
      where.AND = [...existing, this.keysetClause(q.cursor)]
    }

    const rows = await this.prisma.notificationLog.findMany({
      where,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: q.limit,
    })

    const last = rows.at(-1)
    const hasMore = rows.length === q.limit
    const nextCursor =
      hasMore && last !== undefined
        ? this.audit.encodeCursor({ timestamp: last.timestamp, id: last.id })
        : null

    return { data: rows, nextCursor, hasMore }
  }

  /**
   * Time-bucketed counts by `verb`/`channel`/`provider` for the Overview charts.
   *
   * The tenant restriction is resolved from `x-tenant-id` and overrides any query `tenantId`.
   *
   * @param tenantId - The trusted tenant from `x-tenant-id` (never the query/body).
   * @param q - Validated aggregate query (groupBy, bucket, window, source facet).
   * @returns The zero-filled chart series.
   * @throws {BadRequestException} HTTP 400 when query params fail Zod validation.
   */
  @Get('aggregate')
  aggregate(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(auditAggregateQuerySchema)) q: AuditAggregateQueryDto,
  ): Promise<AuditAggregateRow[]> {
    return this.aggregateService.query({ ...q, tenantId })
  }

  /**
   * Build the strictly-older tuple keyset clause for a supplied cursor.
   *
   * @param cursor - The opaque cursor from a prior page.
   * @returns A Prisma `where` fragment selecting rows older than the cursor.
   * @throws {GoneException} HTTP 410 when the cursor is stale or malformed.
   */
  private keysetClause(cursor: string): Prisma.NotificationLogWhereInput {
    try {
      const decoded = this.audit.decodeCursor(cursor)
      return {
        OR: [
          { timestamp: { lt: decoded.timestamp } },
          { timestamp: decoded.timestamp, id: { lt: decoded.id } },
        ],
      }
    } catch (error) {
      if (error instanceof StaleCursorError) {
        throw new GoneException('cursor is stale; restart pagination from the top')
      }
      throw error
    }
  }
}
