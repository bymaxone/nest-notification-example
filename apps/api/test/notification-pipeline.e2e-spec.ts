/**
 * End-to-end proof of the wired notification pipeline (the P4 Definition of Done),
 * without any HTTP controller.
 *
 * Boots the real `AppModule` and overrides only the two external boundaries so the
 * suite is deterministic and needs no live stack (matching the test runbook: in-memory
 * OTP storage, transport + audit-sink captured in-process):
 *   - the email provider token is replaced by a capturing provider (the "Mailpit" seam);
 *   - `PrismaService` is replaced by a fake whose `notificationLog.create` records the
 *     row the audit repository would persist to Postgres.
 *
 * It proves: `getEnabledChannels()` is `['email', 'otp']`; a template email renders and
 * reaches the provider, writing exactly one MASKED, code-free audit row; the atomic OTP
 * storage enforces max-attempts and a cooldown on re-generate; a failing audit sink is
 * swallowed (the send still succeeds); and no OTP code ever appears in any audit row.
 *
 * `REDIS_URL` is unset so the OTP storage resolves to the in-memory branch; `DATABASE_URL`
 * is a non-secret stub (PrismaService is overridden, so no connection opens).
 */
import type { TestingModule } from '@nestjs/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'

const originalEnv: Record<string, string | undefined> = {
  DATABASE_URL: process.env['DATABASE_URL'],
  REDIS_URL: process.env['REDIS_URL'],
}

process.env['DATABASE_URL'] = 'postgresql://stub-user:stub-pass@localhost:5432/stub-db'
delete process.env['REDIS_URL']

const { Test } = await import('@nestjs/testing')
const { AppModule } = await import('../src/app.module.js')
const { PrismaService } = await import('../src/prisma/prisma.service.js')
const lib = await import('@bymax-one/nest-notification')

/** Rows the audit repository would have persisted to Postgres. */
let auditRows: Array<Record<string, unknown>> = []
/** Whether the next audit write should fail (to prove the swallow). */
let failNextAudit = false
/** Messages handed to the email provider (the browsable-inbox seam). */
let sentEmails: Array<Record<string, unknown>> = []

/** A capturing `PrismaService` whose `notificationLog.create` records the row. */
const fakePrisma = {
  notificationLog: {
    create: (args: { data: Record<string, unknown> }): Promise<unknown> => {
      if (failNextAudit) {
        return Promise.reject(new Error('audit sink down'))
      }
      auditRows.push(args.data)
      return Promise.resolve({})
    },
  },
  onModuleInit: (): Promise<void> => Promise.resolve(),
  onApplicationShutdown: (): Promise<void> => Promise.resolve(),
}

/** A capturing email provider standing in for the Mailpit transport. */
const captureProvider = {
  name: 'capture',
  isConfigured: (): boolean => true,
  send: (options: Record<string, unknown>): Promise<{ messageId: string }> => {
    sentEmails.push(options)
    return Promise.resolve({ messageId: 'captured-1' })
  },
}

describe('Notification pipeline (e2e)', () => {
  let moduleRef: TestingModule
  let emailService: InstanceType<typeof lib.EmailService>
  let otpService: InstanceType<typeof lib.OtpService>
  let notificationService: InstanceType<typeof lib.NotificationService>
  let storage: InstanceType<typeof lib.InMemoryOtpStorage>

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .overrideProvider(lib.BYMAX_NOTIFICATION_EMAIL_PROVIDER)
      .useValue(captureProvider)
      .compile()
    emailService = moduleRef.get(lib.EmailService)
    otpService = moduleRef.get(lib.OtpService)
    notificationService = moduleRef.get(lib.NotificationService)
    storage = moduleRef.get(lib.BYMAX_NOTIFICATION_OTP_STORAGE)
  })

  beforeEach(() => {
    auditRows = []
    sentEmails = []
    failNextAudit = false
    storage.clear()
  })

  afterAll(async () => {
    await moduleRef.close()
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('enables exactly the email and otp channels', () => {
    /** Both channels are configured by the factory, so the façade reports just these. */
    expect(notificationService.getEnabledChannels()).toEqual(['email', 'otp'])
  })

  it('renders a template email, delivers it, and writes one masked audit row', async () => {
    /** sendTemplate renders → reaches the provider (Mailpit seam) → one masked sent row. */
    await emailService.sendTemplate({
      tenantId: 'acme',
      to: 'jane@acme.com',
      template: 'welcome',
      locale: 'en',
      data: { name: 'Jane', appName: 'Bymax', appUrl: 'http://localhost:3003' },
    })

    expect(sentEmails).toHaveLength(1)
    expect(String(sentEmails[0]?.['html'])).toContain('Jane')
    expect(String(sentEmails[0]?.['subject'])).toBe('Welcome to Bymax')

    expect(auditRows).toHaveLength(1)
    const row = auditRows[0] ?? {}
    expect(row['recipient']).toBe('j***@acme.com')
    expect(row['channel']).toBe('email')
    expect(row['verb']).toBe('sent')
    // The raw recipient must never be persisted — only the masked form.
    expect(JSON.stringify(row).includes('jane@acme.com')).toBe(false)
  })

  it('keeps delivering when the audit sink fails (swallowErrors default)', async () => {
    /** A rejected audit write must not surface to the caller — the send still resolves. */
    failNextAudit = true

    const result = await emailService.sendTemplate({
      tenantId: 'acme',
      to: 'jane@acme.com',
      template: 'welcome',
      locale: 'en',
      data: { name: 'Jane', appName: 'Bymax', appUrl: 'http://localhost:3003' },
    })

    expect(result.messageId).toBe('captured-1')
    expect(sentEmails).toHaveLength(1)
  })

  it('enforces atomic max-attempts and never records the OTP code', async () => {
    /** A known code with maxAttempts=2 is exhausted; no audit row carries the code. */
    const realCode = '654321'
    await storage.set('acme', 'jane@acme.com', 'login', {
      code: realCode,
      expiresAt: Date.now() + 60_000,
      attempts: 0,
      maxAttempts: 2,
    })

    const verifyWrong = (): Promise<unknown> =>
      otpService.verify({
        tenantId: 'acme',
        recipient: 'jane@acme.com',
        purpose: 'login',
        code: '000000',
      })
    await verifyWrong()
    await verifyWrong()
    const final = await otpService.verify({
      tenantId: 'acme',
      recipient: 'jane@acme.com',
      purpose: 'login',
      code: '000000',
    })

    expect(final).toEqual({ valid: false, reason: 'max_attempts' })
    expect(auditRows.some((row) => row['verb'] === 'max_attempts_exceeded')).toBe(true)
    for (const row of auditRows) {
      expect(JSON.stringify(row).includes(realCode)).toBe(false)
      expect(row['recipient']).toBe('j***@acme.com')
    }
  })

  it('blocks a second generate inside the cooldown and never records the code', async () => {
    /** The first generate claims the cooldown; the second is rejected and audited. */
    await otpService.generate({
      tenantId: 'acme',
      recipient: 'jane@acme.com',
      purpose: 'login',
      deliverVia: 'manual',
    })
    const stored = await storage.get('acme', 'jane@acme.com', 'login')
    const realCode = stored?.code ?? ''

    await expect(
      otpService.generate({
        tenantId: 'acme',
        recipient: 'jane@acme.com',
        purpose: 'login',
        deliverVia: 'manual',
      }),
    ).rejects.toThrow()

    expect(auditRows.some((row) => row['verb'] === 'generated')).toBe(true)
    expect(auditRows.some((row) => row['verb'] === 'cooldown_blocked')).toBe(true)
    expect(realCode.length).toBeGreaterThan(0)
    for (const row of auditRows) {
      expect(JSON.stringify(row).includes(realCode)).toBe(false)
    }
  })
})
