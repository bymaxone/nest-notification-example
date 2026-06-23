/**
 * Unit tests for {@link PrismaNotificationLogRepository}.
 *
 * Proves the `NotificationLogEntry → notification_logs` mapping against a mocked
 * `PrismaService`: every field maps, the numeric timestamp becomes a `Date`, absent
 * optionals become `null`, absent `metadata` is omitted, and a sample OTP code is
 * never present in the persisted row (the never-coded invariant at the write seam).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { NotificationLogEntry } from '@bymax-one/nest-notification'
import type { NotificationLog } from '@prisma/client'

import type { PrismaService } from '../../prisma/prisma.service.js'
import type { AuditEventBus } from '../../audit/audit-event.bus.js'
import { PrismaNotificationLogRepository } from './prisma-notification-log.repository.js'

/** A sample 6-digit code that must never appear in any persisted audit row. */
const SAMPLE_CODE = '123456'

/** The shape of the captured `create` argument we assert against. */
type CapturedCreate = { data: Record<string, unknown> }

/** Build a repository over `notificationLog.create` + a live-tail bus mock; return all three. */
function buildRepository(): {
  repository: PrismaNotificationLogRepository
  create: jest.Mock<(args: CapturedCreate) => Promise<NotificationLog>>
  publishPersisted: jest.Mock<(row: NotificationLog) => void>
} {
  const create = jest
    .fn<(args: CapturedCreate) => Promise<NotificationLog>>()
    .mockImplementation((args) =>
      Promise.resolve({ id: 'row-1', ...args.data } as unknown as NotificationLog),
    )
  const prisma = { notificationLog: { create } } as unknown as PrismaService
  const publishPersisted = jest.fn<(row: NotificationLog) => void>()
  const bus = { publishPersisted } as unknown as AuditEventBus
  return { repository: new PrismaNotificationLogRepository(prisma, bus), create, publishPersisted }
}

/** Reads the single captured `create` payload, failing the test if it was never called. */
function capturedData(
  create: jest.Mock<(args: CapturedCreate) => Promise<unknown>>,
): Record<string, unknown> {
  const call = create.mock.calls.at(0)
  if (call === undefined) {
    throw new Error('notificationLog.create was not called')
  }
  return call[0].data
}

describe('PrismaNotificationLogRepository', () => {
  let built: ReturnType<typeof buildRepository>

  beforeEach(() => {
    built = buildRepository()
  })

  it('names itself "prisma"', () => {
    /** The name is surfaced in diagnostics and must match the storage backend. */
    expect(built.repository.name).toBe('prisma')
  })

  it('maps every field of a fully-populated entry to the create row', async () => {
    /**
     * A complete entry exercises the present-value side of each `??` and the
     * metadata-included branch of the conditional spread.
     */
    const entry: NotificationLogEntry = {
      timestamp: 1_700_000_000_000,
      tenantId: 'acme',
      channel: 'email',
      verb: 'sent',
      recipient: 'j***@acme.com',
      purpose: 'welcome',
      providerName: 'nodemailer',
      messageId: 'msg-1',
      errorMessage: 'none',
      userId: 'user-1',
      metadata: { source: 'test' },
    }

    await built.repository.create(entry)

    const data = capturedData(built.create)
    expect(data).toEqual({
      timestamp: new Date(1_700_000_000_000),
      tenantId: 'acme',
      channel: 'email',
      verb: 'sent',
      recipient: 'j***@acme.com',
      purpose: 'welcome',
      providerName: 'nodemailer',
      messageId: 'msg-1',
      errorMessage: 'none',
      userId: 'user-1',
      metadata: { source: 'test' },
    })
    expect(data['timestamp']).toBeInstanceOf(Date)
  })

  it('coerces absent optionals to null and omits absent metadata', async () => {
    /**
     * A minimal entry exercises the `?? null` fallbacks and the metadata-omitted
     * branch — Prisma then stores SQL NULL rather than a JSON null.
     */
    const entry: NotificationLogEntry = {
      timestamp: 1_700_000_000_000,
      tenantId: 'globex',
      channel: 'otp',
      verb: 'failed',
      recipient: 'g***@globex.com',
      providerName: '__interceptor__',
    }

    await built.repository.create(entry)

    const data = capturedData(built.create)
    expect(data['purpose']).toBeNull()
    expect(data['messageId']).toBeNull()
    expect(data['errorMessage']).toBeNull()
    expect(data['userId']).toBeNull()
    expect('metadata' in data).toBe(false)
  })

  it('never persists an OTP code in the row', async () => {
    /**
     * The entry carries no code field by contract; serializing the persisted row
     * must not surface a sample code anywhere — the never-coded write-seam invariant.
     */
    const entry: NotificationLogEntry = {
      timestamp: 1_700_000_000_000,
      tenantId: 'acme',
      channel: 'otp',
      verb: 'generated',
      recipient: 'j***@acme.com',
      purpose: 'email_verification',
      providerName: 'memory',
      metadata: { attempts: 0 },
    }

    await built.repository.create(entry)

    const data = capturedData(built.create)
    expect(JSON.stringify(data).includes(SAMPLE_CODE)).toBe(false)
  })

  it('broadcasts the committed row to the audit live tail', async () => {
    /**
     * After the insert, the persisted row (the `create` return value, carrying its DB `id`)
     * is handed to the live-tail bus so a fresh SSE connection sees it without a reconnect —
     * the write-path feed that powers the Explorer live tail.
     */
    const entry: NotificationLogEntry = {
      timestamp: 1_700_000_000_000,
      tenantId: 'acme',
      channel: 'email',
      verb: 'sent',
      recipient: 'j***@acme.com',
      providerName: 'nodemailer',
    }

    await built.repository.create(entry)

    expect(built.publishPersisted).toHaveBeenCalledTimes(1)
    const broadcast = built.publishPersisted.mock.calls[0]?.[0]
    expect(broadcast).toMatchObject({ id: 'row-1', tenantId: 'acme', verb: 'sent' })
  })
})
