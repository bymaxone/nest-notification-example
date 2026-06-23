/**
 * Unit tests for {@link NodemailerEmailProvider}.
 *
 * `nodemailer` is mocked via `jest.unstable_mockModule` so no SMTP socket opens:
 * the fake `createTransport` returns a `sendMail` spy. Proves the provider returns the
 * transport's `messageId`, rethrows a transport failure (so `EmailService` can map it
 * to `EMAIL_SEND_FAILED`), forwards every populated envelope field, and omits absent
 * optionals.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { EmailSendOptions } from '@bymax-one/nest-notification'

/** The transport `sendMail` spy shared across the suite. */
const sendMail = jest.fn<(message: Record<string, unknown>) => Promise<{ messageId: string }>>()

/** The mocked `createTransport`, capturing the URL it was built from. */
const createTransport = jest.fn(() => ({ sendMail }))

jest.unstable_mockModule('nodemailer', () => ({ createTransport }))

const { NodemailerEmailProvider } = await import('./nodemailer-email.provider.js')

describe('NodemailerEmailProvider', () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: 'smtp-123' })
    createTransport.mockClear()
  })

  it('builds the transport from the SMTP URL and names itself "nodemailer"', () => {
    /** Construction wires the transport from the URL; the name is fixed. */
    const provider = new NodemailerEmailProvider('smtp://localhost:1025')

    expect(createTransport).toHaveBeenCalledWith('smtp://localhost:1025')
    expect(provider.name).toBe('nodemailer')
    expect(provider.isConfigured()).toBe(true)
  })

  it('forwards every populated envelope field and returns the transport messageId', async () => {
    /**
     * A fully-populated options bag exercises the present-value side of every
     * conditional-spread branch; the result carries the transport's id.
     */
    const provider = new NodemailerEmailProvider('smtp://localhost:1025')
    const options: EmailSendOptions = {
      to: 'jane@acme.com',
      from: 'no-reply@notification.local',
      fromName: 'Bymax',
      subject: 'Welcome',
      html: '<p>Hi</p>',
      text: 'Hi',
      replyTo: 'support@acme.com',
      cc: 'cc@acme.com',
      bcc: 'bcc@acme.com',
      headers: { 'X-Test': '1' },
      attachments: [{ filename: 'a.txt', content: 'hi' }],
    }

    const result = await provider.send(options)

    expect(result).toEqual({ messageId: 'smtp-123' })
    expect(sendMail).toHaveBeenCalledWith({
      to: 'jane@acme.com',
      subject: 'Welcome',
      html: '<p>Hi</p>',
      from: 'no-reply@notification.local',
      text: 'Hi',
      replyTo: 'support@acme.com',
      cc: 'cc@acme.com',
      bcc: 'bcc@acme.com',
      headers: { 'X-Test': '1' },
      attachments: [{ filename: 'a.txt', content: 'hi' }],
    })
  })

  it('omits absent optional fields from the SMTP message', async () => {
    /** A minimal options bag exercises the absent side of every conditional spread. */
    const provider = new NodemailerEmailProvider('smtp://localhost:1025')

    await provider.send({ to: 'jane@acme.com', subject: 'Hi', html: '<p>x</p>' })

    expect(sendMail).toHaveBeenCalledWith({
      to: 'jane@acme.com',
      subject: 'Hi',
      html: '<p>x</p>',
    })
  })

  it('rethrows a transport failure so EmailService maps it to EMAIL_SEND_FAILED', async () => {
    /** A rejected `sendMail` must propagate, not be swallowed. */
    sendMail.mockRejectedValue(new Error('connection refused'))
    const provider = new NodemailerEmailProvider('smtp://localhost:1025')

    await expect(
      provider.send({ to: 'jane@acme.com', subject: 'Hi', html: '<p>x</p>' }),
    ).rejects.toThrow('connection refused')
  })
})
