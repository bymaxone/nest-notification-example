/**
 * @fileoverview Email provider selection from the validated environment.
 * @layer infrastructure
 *
 * One place that decides which `IEmailProvider` the module wires, mirroring the
 * documented opt-in ladder: Resend when `RESEND_API_KEY` is set, else the custom
 * Nodemailer→Mailpit provider when `SMTP_URL` is set, else the bundled
 * `NoOpEmailProvider` (logs the recipient/subject, sends nothing). The zero-credential
 * happy path therefore resolves to Nodemailer→Mailpit.
 *
 * @module
 */
import type { ConfigService } from '@nestjs/config'
import {
  NoOpEmailProvider,
  ResendEmailProvider,
  type IEmailProvider,
} from '@bymax-one/nest-notification'

import { NodemailerEmailProvider } from './nodemailer-email.provider.js'

/**
 * Picks the email provider from the validated env.
 *
 * @param config - The schema-typed configuration service.
 * @returns Resend (opt-in) → Nodemailer→Mailpit → `NoOpEmailProvider` fallback.
 */
export function resolveEmailProvider(config: ConfigService): IEmailProvider {
  const resendKey = config.get<string>('RESEND_API_KEY')
  if (resendKey) {
    return new ResendEmailProvider({ apiKey: resendKey })
  }
  const smtpUrl = config.get<string>('SMTP_URL')
  if (smtpUrl) {
    return new NodemailerEmailProvider(smtpUrl)
  }
  return new NoOpEmailProvider()
}
