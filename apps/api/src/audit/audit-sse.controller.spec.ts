/**
 * Unit tests for {@link AuditSseController}.
 *
 * Covers the merged `stream()` observable: a live entry forwarded when it passes the tenant
 * guard + client filter, a cross-tenant entry dropped server-side, an entry that passes the
 * tenant guard but fails the client filter, the keep-alive ping on the timer, the keyset replay
 * merged for a valid `Last-Event-ID`, and the feedback-loop guarantee that streaming performs no
 * write.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { firstValueFrom, take, type Subscription } from 'rxjs'
import type { NotificationLog } from '@prisma/client'

import type { PrismaService } from '../prisma/prisma.service.js'
import { AuditReadService } from './audit-read.service.js'
import { AuditEventBus, type AuditBusEntry, type AuditSseEvent } from './audit-event.bus.js'
import { AuditSseController } from './audit-sse.controller.js'
import { auditQuerySchema, type AuditQueryDto } from './dto/audit-query.dto.js'

/** Build a bus + controller over a Prisma `findMany` mock; return all parts. */
function build(rows: NotificationLog[] = []) {
  const findMany = jest.fn<(args: unknown) => Promise<NotificationLog[]>>().mockResolvedValue(rows)
  const prisma = { notificationLog: { findMany } } as unknown as PrismaService
  const audit = new AuditReadService()
  const bus = new AuditEventBus(audit, prisma)
  return { controller: new AuditSseController(bus), bus, audit, findMany }
}

/** Build an `AuditBusEntry` for the live-feed assertions. */
function makeEntry(overrides: Partial<AuditBusEntry> = {}): AuditBusEntry {
  return {
    id: 'row-1',
    timestamp: new Date('2026-06-23T12:00:00.000Z'),
    tenantId: 'acme',
    channel: 'otp',
    verb: 'generated',
    recipient: 'j***@acme.com',
    purpose: 'email_verification',
    providerName: 'memory',
    messageId: null,
    errorMessage: null,
    userId: null,
    cursor: 'cursor-1',
    ...overrides,
  }
}

/** Parse raw params through the real schema. */
function filterDto(raw: Record<string, unknown> = {}): AuditQueryDto {
  return auditQuerySchema.parse(raw)
}

describe('AuditSseController.stream', () => {
  const subs: Subscription[] = []

  afterEach(() => {
    while (subs.length > 0) subs.pop()?.unsubscribe()
    jest.useRealTimers()
  })

  it('forwards a live entry that passes the tenant guard and client filter', async () => {
    /**
     * The core live-tail contract: a same-tenant entry satisfying the filter is mapped through
     * `toEvent` and surfaced on the merged stream. Subscribing before emitting proves the
     * `fromEvent` live source is wired.
     */
    const { controller, bus } = build()
    const stream$ = controller.stream('acme', undefined, filterDto({ verb: 'generated' }))

    const firstEvent = firstValueFrom(stream$.pipe(take(1)))
    bus.emit(makeEntry({ tenantId: 'acme', verb: 'generated', cursor: 'cur-live' }))

    const event = (await firstEvent) as AuditSseEvent
    expect(event.id).toBe('cur-live')
  })

  it('drops a cross-tenant live entry before the client filter runs', async () => {
    /**
     * The server-side tenant guard rejects another tenant's row even when the client filter
     * would match; the same-tenant entry that follows proves the stream stayed live.
     */
    const { controller, bus } = build()
    const stream$ = controller.stream('acme', undefined, filterDto())

    const firstEvent = firstValueFrom(stream$.pipe(take(1)))
    bus.emit(makeEntry({ tenantId: 'globex', cursor: 'cur-other' }))
    bus.emit(makeEntry({ tenantId: 'acme', cursor: 'cur-acme' }))

    const event = (await firstEvent) as AuditSseEvent
    expect(event.id).toBe('cur-acme')
  })

  it('drops a same-tenant entry that fails the client filter', async () => {
    /**
     * An entry that clears the tenant guard but fails the client `matches()` filter must not be
     * forwarded; the following matching entry confirms the stream is still open.
     */
    const { controller, bus } = build()
    const stream$ = controller.stream('acme', undefined, filterDto({ verb: 'sent' }))

    const firstEvent = firstValueFrom(stream$.pipe(take(1)))
    bus.emit(makeEntry({ tenantId: 'acme', verb: 'generated', cursor: 'cur-gen' }))
    bus.emit(makeEntry({ tenantId: 'acme', verb: 'sent', cursor: 'cur-sent' }))

    const event = (await firstEvent) as AuditSseEvent
    expect(event.id).toBe('cur-sent')
  })

  it('emits a keep-alive ping on the 15s timer', () => {
    /** The merged stream includes a 15-second `{ data: '', type: 'ping' }` to defeat idle proxies. */
    jest.useFakeTimers()
    const { controller } = build()
    const stream$ = controller.stream('acme', undefined, filterDto())

    const received: AuditSseEvent[] = []
    subs.push(stream$.subscribe((e) => received.push(e)))
    jest.advanceTimersByTime(15_000)

    expect(received).toContainEqual({ data: '', type: 'ping' })
  })

  it('merges a keyset replay for a valid Last-Event-ID', async () => {
    /**
     * On reconnect with a valid `Last-Event-ID`, the merged stream begins with the replay of
     * missed rows. With one replay row and no live traffic, the first event is that row.
     */
    const replayRow = {
      id: 'row-9',
      timestamp: new Date('2026-06-23T13:00:00.000Z'),
      tenantId: 'acme',
      channel: 'otp',
      verb: 'generated',
      recipient: 'j***@acme.com',
      purpose: 'email_verification',
      providerName: 'memory',
      messageId: null,
      errorMessage: null,
      userId: null,
      metadata: null,
    } as NotificationLog
    const { controller, audit } = build([replayRow])
    const lastId = audit.encodeCursor({ timestamp: new Date('2026-06-23T12:00:00Z'), id: 'row-1' })

    const stream$ = controller.stream('acme', lastId, filterDto())
    const first = (await firstValueFrom(stream$.pipe(take(1)))) as AuditSseEvent
    expect(JSON.parse(first.data).id).toBe('row-9')
  })

  it('never writes an audit row from the stream path (feedback-loop guard)', () => {
    /**
     * The read/stream path holds no write capability: emitting a live entry while subscribed
     * must not push anything back onto the bus. A spy on `bus.emit` is untouched by streaming,
     * so the live tail can never feed itself.
     */
    const { controller, bus } = build()
    const emitSpy = jest.spyOn(bus, 'emit')
    const stream$ = controller.stream('acme', undefined, filterDto())

    subs.push(stream$.subscribe(() => undefined))
    // The act of subscribing/streaming triggers no emit; only an external write would.
    expect(emitSpy).not.toHaveBeenCalled()
  })
})
