/**
 * @fileoverview Custom `IEmailProvider` that delivers over SMTP via Nodemailer.
 * @layer infrastructure
 *
 * The headline bring-your-own-provider reference: a small adapter that makes the
 * demo's emails actually appear in a browsable Mailpit inbox (`smtp://localhost:1025`,
 * zero credentials). It implements the same three-member contract as the bundled
 * `ResendEmailProvider` (`name` / `isConfigured` / `send`), so the module wires it with
 * no change to any call site.
 *
 * Security: the body (`html` / `text`) may carry OTP codes or PII and is NEVER logged
 * here. A transport failure propagates as a thrown `Error`, which `EmailService` maps
 * to the generic `EMAIL_SEND_FAILED` — credentials never leak into the surfaced error.
 *
 * @module
 */
import { createTransport, type SendMailOptions } from 'nodemailer'
import type {
  EmailSendOptions,
  EmailSendResult,
  IEmailProvider,
} from '@bymax-one/nest-notification'

/** The concrete transporter type for a string/SMTP transport (carries `messageId`). */
type SmtpTransporter = ReturnType<typeof createTransport>

/**
 * Delivers transactional email through a Nodemailer SMTP transport.
 *
 * Construction is cheap and connection-less — Nodemailer opens the socket lazily on
 * the first `sendMail`, so building this provider never blocks startup.
 */
export class NodemailerEmailProvider implements IEmailProvider {
  /** Provider name surfaced in audit rows and diagnostics. */
  readonly name = 'nodemailer'

  /** The SMTP transport built from the connection URL. */
  private readonly transport: SmtpTransporter

  /**
   * @param smtpUrl - SMTP connection URL (e.g. `smtp://localhost:1025` for Mailpit).
   */
  constructor(smtpUrl: string) {
    this.transport = createTransport(smtpUrl)
  }

  /**
   * Whether the transport was constructed. Always `true` once built — the SMTP
   * endpoint is validated lazily at send time, not here.
   *
   * @returns `true` when a transport is present.
   */
  isConfigured(): boolean {
    return Boolean(this.transport)
  }

  /**
   * Sends one email through the SMTP transport.
   *
   * @param options - The envelope and rendered body (already produced by the pipeline).
   * @returns The transport's `messageId`, for audit correlation.
   * @throws Error When the transport rejects; `EmailService` maps it to `EMAIL_SEND_FAILED`.
   */
  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    const message: SendMailOptions = {
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.from !== undefined ? { from: options.from } : {}),
      ...(options.text !== undefined ? { text: options.text } : {}),
      ...(options.replyTo !== undefined ? { replyTo: options.replyTo } : {}),
      ...(options.cc !== undefined ? { cc: options.cc } : {}),
      ...(options.bcc !== undefined ? { bcc: options.bcc } : {}),
      ...(options.headers !== undefined ? { headers: options.headers } : {}),
      ...(options.attachments !== undefined ? { attachments: [...options.attachments] } : {}),
    }
    const info = await this.transport.sendMail(message)
    return { messageId: info.messageId }
  }
}
