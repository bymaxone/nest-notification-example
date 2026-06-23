/**
 * @fileoverview Prisma write-side implementation of the audit-log repository port.
 * @layer infrastructure
 *
 * Implements the library's `INotificationLogRepository` over `PrismaService`, so the
 * delivery pipeline persists its audit trail to Postgres without the library ever
 * importing Prisma (the dependency points the other way — consumer → library port).
 *
 * Security: the entry arrives already masked (the library applies `audit.maskRecipient`
 * before calling here), `errorMessage` is a message only (never a stack trace), and
 * there is NO column for an OTP code — a generated code can never be persisted.
 *
 * @module
 */
import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { INotificationLogRepository, NotificationLogEntry } from '@bymax-one/nest-notification'

import { PrismaService } from '../../prisma/prisma.service.js'

/**
 * Persists notification audit entries with Prisma.
 *
 * The library calls {@link create} fire-and-forget (gated by `audit.swallowErrors`),
 * so it stays cheap and side-effect-free beyond the single insert.
 */
@Injectable()
export class PrismaNotificationLogRepository implements INotificationLogRepository {
  /** Repository name surfaced in diagnostics — matches the storage backend. */
  readonly name = 'prisma'

  /**
   * @param prisma - The application's global Prisma client.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Maps a {@link NotificationLogEntry} to a `notification_logs` row and inserts it.
   *
   * Absent optionals become `null` (so the column is explicitly cleared), the numeric
   * `timestamp` becomes a `Date`, and absent `metadata` is omitted (left `undefined`)
   * so Prisma stores SQL `NULL` rather than a JSON `null`.
   *
   * @param entry - The masked, code-free audit entry produced by the pipeline.
   * @returns A promise that resolves once the row is written.
   */
  async create(entry: NotificationLogEntry): Promise<void> {
    const data: Prisma.NotificationLogCreateInput = {
      timestamp: new Date(entry.timestamp),
      tenantId: entry.tenantId,
      channel: entry.channel,
      verb: entry.verb,
      recipient: entry.recipient,
      purpose: entry.purpose ?? null,
      providerName: entry.providerName,
      messageId: entry.messageId ?? null,
      errorMessage: entry.errorMessage ?? null,
      userId: entry.userId ?? null,
      // Omit the key entirely when absent so Prisma writes SQL NULL (not JSON null);
      // the arbitrary caller metadata is, by the port's contract, a JSON value.
      ...(entry.metadata === undefined
        ? {}
        : { metadata: entry.metadata as Prisma.InputJsonValue }),
    }
    await this.prisma.notificationLog.create({ data })
  }
}
