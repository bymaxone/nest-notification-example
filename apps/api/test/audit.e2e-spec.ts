/**
 * End-to-end tests for the `/audit/*` read-API.
 *
 * Boots the real `AppModule` over an in-memory Prisma fake (no live DB) and a capturing email
 * provider, then drives the HTTP surface: the keyset `GET /audit/logs` envelope, the HTTP-410
 * stale-cursor contract, the write→read wiring a `/dispatch` exercises with the `source` facet
 * as a first-class query param, the `GET /audit/aggregate` series, the SSE route headers, and the
 * feedback-loop guard (a read writes no audit row).
 *
 * The env mutation is scoped/restored via {@link setupTestEnv}/{@link teardownTestEnv}, matching
 * the shared harness, so it never leaks into a sibling suite.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import type { AddressInfo } from 'node:net'
import http from 'node:http'

import { setupTestEnv, teardownTestEnv } from './test-app.factory.js'

const { Test } = await import('@nestjs/testing')
const lib = await import('@bymax-one/nest-notification')
const express = (await import('express')).default
const request = (await import('supertest')).default

/** A persisted audit row in the in-memory store (mirrors the `notification_logs` columns). */
interface StoredRow {
  id: string
  timestamp: Date
  tenantId: string
  channel: string
  verb: string
  recipient: string
  purpose: string | null
  providerName: string
  messageId: string | null
  errorMessage: string | null
  userId: string | null
  metadata: unknown
}

/** An in-memory Prisma double: records writes, serves newest-first reads + a fixed aggregate. */
function buildInMemoryPrisma(store: StoredRow[]) {
  return {
    notificationLog: {
      create: (args: { data: Record<string, unknown> }): Promise<StoredRow> => {
        const data = args.data
        const row: StoredRow = {
          id: `row-${store.length + 1}`,
          timestamp: data['timestamp'] instanceof Date ? (data['timestamp'] as Date) : new Date(),
          tenantId: String(data['tenantId'] ?? 'default'),
          channel: String(data['channel'] ?? ''),
          verb: String(data['verb'] ?? ''),
          recipient: String(data['recipient'] ?? ''),
          purpose: (data['purpose'] as string | null) ?? null,
          providerName: String(data['providerName'] ?? ''),
          messageId: (data['messageId'] as string | null) ?? null,
          errorMessage: (data['errorMessage'] as string | null) ?? null,
          userId: (data['userId'] as string | null) ?? null,
          metadata: data['metadata'] ?? null,
        }
        store.push(row)
        return Promise.resolve(row)
      },
      findMany: (args: { take?: number }): Promise<StoredRow[]> => {
        const ordered = [...store].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime() || b.id.localeCompare(a.id),
        )
        return Promise.resolve(args.take ? ordered.slice(0, args.take) : ordered)
      },
    },
    $queryRaw: (): Promise<Array<{ bucket: Date; dimension: string; n: number }>> =>
      Promise.resolve([{ bucket: new Date('2026-06-23T12:00:00Z'), dimension: 'generated', n: 1 }]),
    onModuleInit: (): Promise<void> => Promise.resolve(),
    onApplicationShutdown: (): Promise<void> => Promise.resolve(),
  }
}

let app: INestApplication
let store: StoredRow[]
let port: number

beforeAll(async () => {
  setupTestEnv()
  const { AppModule } = await import('../src/app.module.js')
  const { PrismaService } = await import('../src/prisma/prisma.service.js')

  store = []
  const captureProvider = {
    name: 'capture',
    isConfigured: (): boolean => true,
    send: (): Promise<{ messageId: string }> => Promise.resolve({ messageId: 'captured' }),
  }

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(buildInMemoryPrisma(store))
    .overrideProvider(lib.BYMAX_NOTIFICATION_EMAIL_PROVIDER)
    .useValue(captureProvider)
    .compile()

  app = moduleRef.createNestApplication({ bodyParser: false })
  app.use(express.json())
  await app.listen(0)
  port = (app.getHttpServer().address() as AddressInfo).port
})

afterAll(async () => {
  await app.close()
  teardownTestEnv()
})

describe('GET /audit/logs', () => {
  beforeEach(() => {
    store.length = 0
  })

  it('returns the keyset envelope { data, nextCursor, hasMore }', async () => {
    /** With no rows, the envelope is well-formed and empty — the contract every page satisfies. */
    const res = await request(app.getHttpServer()).get('/audit/logs').set('x-tenant-id', 'acme')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ data: [], nextCursor: null, hasMore: false })
  })

  it('returns HTTP 410 on a stale/foreign cursor', async () => {
    /** A garbage cursor cannot decode ⇒ the server tells the client to restart pagination. */
    const res = await request(app.getHttpServer())
      .get('/audit/logs?cursor=not-a-real-cursor')
      .set('x-tenant-id', 'acme')

    expect(res.status).toBe(410)
  })

  it('surfaces the audit rows a /dispatch writes, filterable by the source facet', async () => {
    /**
     * A dispatched OTP-generate writes service lifecycle rows that must be queryable end-to-end,
     * and the `source` facet (which separates service verbs from interceptor `__interceptor__`
     * rows) is accepted on the read endpoint. The facet's row-level filtering is unit-proven; here
     * we prove the write→read wiring and that the facet is a first-class query param.
     */
    await request(app.getHttpServer())
      .post('/dispatch')
      .set('x-tenant-id', 'acme')
      .send({
        channel: 'otp',
        payload: { recipient: 'jane@acme.com', purpose: 'email_verification' },
      })
      .expect(201)

    expect(store.length).toBeGreaterThan(0)
    // Every persisted row is masked + code-free at the write seam.
    expect(store.every((r) => !r.recipient.includes('jane@acme.com'))).toBe(true)

    // The library interceptor now records a masked boundary row stamped '__interceptor__' — the
    // dual-source Explorer demo is real (service verbs AND the interceptor source both populate).
    const interceptorRows = store.filter((r) => r.providerName === '__interceptor__')
    expect(interceptorRows.length).toBeGreaterThan(0)
    expect(interceptorRows.every((r) => r.verb === 'sent' || r.verb === 'failed')).toBe(true)
    expect(interceptorRows.every((r) => !r.recipient.includes('jane@acme.com'))).toBe(true)

    const res = await request(app.getHttpServer())
      .get('/audit/logs?source=service')
      .set('x-tenant-id', 'acme')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  it('does not write an audit row from the read path (feedback-loop guard)', async () => {
    /** Reading the log must never append to it — otherwise the SSE feed would loop forever. */
    await request(app.getHttpServer()).get('/audit/logs').set('x-tenant-id', 'acme').expect(200)
    await request(app.getHttpServer())
      .get('/audit/aggregate')
      .set('x-tenant-id', 'acme')
      .expect(200)

    expect(store).toHaveLength(0)
  })
})

describe('GET /audit/aggregate', () => {
  it('returns a time-bucketed series array', async () => {
    /** The Overview charts consume a JSON series of { bucket, dimension, n } rows. */
    const res = await request(app.getHttpServer())
      .get('/audit/aggregate?groupBy=verb')
      .set('x-tenant-id', 'acme')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toMatchObject({ dimension: 'generated', n: 1 })
  })
})

describe('GET /audit/stream', () => {
  it('responds as an SSE event-stream without buffering', async () => {
    /**
     * The live-tail route must open with `text/event-stream` and proxy-buffering disabled. We
     * read the response headers over a raw socket then close it — the deterministic emit/replay
     * behaviour is covered by the unit suite.
     */
    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        {
          port,
          path: '/audit/stream',
          headers: { Accept: 'text/event-stream', 'x-tenant-id': 'acme' },
        },
        (res) => {
          try {
            expect(res.statusCode).toBe(200)
            expect(res.headers['content-type']).toMatch(/text\/event-stream/)
            expect(res.headers['x-accel-buffering']).toBe('no')
          } catch (error) {
            req.destroy()
            reject(error instanceof Error ? error : new Error(String(error)))
            return
          }
          req.destroy()
          resolve()
        },
      )
      // A failed connection must reject deterministically (and tear the socket down) instead
      // of hanging the promise until Jest times out.
      req.on('error', (error) => {
        req.destroy()
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  })
})
