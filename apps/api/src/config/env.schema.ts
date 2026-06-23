/**
 * Zod-validated environment schema for `apps/api`.
 *
 * Layer: app/config. Used as the `ConfigModule.forRoot({ validate: validateEnv })`
 * entrypoint so a misconfigured deploy fails fast with a readable, aggregated message.
 * Add new validated variables here as features are introduced.
 */
import { z } from 'zod'

/**
 * Loopback hostnames rejected for outbound URLs in production.
 * IPv6 loopback uses the bracket form because the WHATWG URL API serializes it as
 * `'[::1]'` (e.g. `new URL('http://[::1]/').hostname === '[::1]'`).
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Whether a URL string resolves to a loopback host. A parse failure returns
 * `false` because `z.url()` already reports a malformed URL; this catch guards
 * against any edge-case where the WHATWG URL constructor rejects the input.
 *
 * Exported for direct unit testing of the parse-failure branch.
 *
 * @param value - The URL string to inspect.
 * @returns `true` when the hostname is a loopback address.
 */
export function isLoopbackUrl(value: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(value).hostname)
  } catch {
    return false
  }
}

/** Environment-variable schema for `apps/api`. */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url().optional(), // unset ⇒ InMemoryOtpStorage
    SMTP_URL: z.url().default('smtp://localhost:1025'),
    RESEND_API_KEY: z.string().min(1).optional(), // set ⇒ ResendEmailProvider; unset ⇒ Nodemailer/NoOp
    MAIL_FROM: z.string().min(1).default('no-reply@notification.local'),
    MAIL_FROM_NAME: z.string().optional(),
    DEFAULT_LOCALE: z.string().min(2).default('en'),
    OTP_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().default(600),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),
    AUDIT_MASK_RECIPIENT: z.stringbool().default(true),
    WEB_ORIGIN: z.url().default('http://localhost:3003'),
  })
  .superRefine((env, ctx) => {
    // All cross-host guards apply to production only; dev/test keep the convenient
    // localhost defaults. Each guard fails fast so a misconfigured deploy cannot
    // silently connect to an unintended local service.
    if (env.NODE_ENV !== 'production') return

    // Outbound database and OTP-store URLs must point at a real peer, not loopback.
    for (const key of ['DATABASE_URL', 'REDIS_URL'] as const) {
      const value = env[key]
      if (value !== undefined && isLoopbackUrl(value)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'must not point to localhost in production',
        })
      }
    }

    // The CORS allow-list must use HTTPS so console↔API requests are not served insecurely.
    try {
      if (new URL(env.WEB_ORIGIN).protocol !== 'https:') {
        ctx.addIssue({
          code: 'custom',
          path: ['WEB_ORIGIN'],
          message: 'must use https:// in production',
        })
      }
    } catch {
      // URL parse failed — already reported by z.url().
    }
  })

/** Parsed, fully-defaulted environment shape inferred from {@link envSchema}. */
export type Env = z.infer<typeof envSchema>

/**
 * Validate raw environment variables, applying defaults.
 *
 * Used as the `ConfigModule.forRoot({ validate })` entrypoint so the process exits
 * non-zero at boot on an invalid value instead of failing later at runtime.
 *
 * @param config - Raw environment record (typically `process.env`).
 * @returns The parsed, fully-defaulted {@link Env}.
 * @throws {Error} When any variable fails validation; the message aggregates every
 *   offending key and its reason.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  return parsed.data
}
