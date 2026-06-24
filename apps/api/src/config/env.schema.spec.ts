import { describe, expect, it } from '@jest/globals'

import { isLoopbackUrl, validateEnv } from './env.schema.js'

describe('validateEnv — root-level error path', () => {
  it('uses (root) as the key when the Zod issue has an empty path', () => {
    // Passing a non-object triggers a root-level issue with path: [], exercising the
    // "(root)" fallback in the error-message map.
    expect(() => validateEnv(null as unknown as Record<string, unknown>)).toThrow('(root)')
  })
})

describe('isLoopbackUrl', () => {
  it('returns true for localhost URLs', () => {
    // Loopback hostnames are rejected in production — this guard must identify them.
    expect(isLoopbackUrl('http://localhost:3000')).toBe(true)
    expect(isLoopbackUrl('http://127.0.0.1:5432')).toBe(true)
    expect(isLoopbackUrl('http://[::1]:6379')).toBe(true)
  })

  it('returns false for non-loopback URLs', () => {
    // Real remote hosts must not be flagged as loopback.
    expect(isLoopbackUrl('https://example.com')).toBe(false)
    expect(isLoopbackUrl('postgresql://db.example.com:5432/app')).toBe(false)
  })

  it('returns false when the value cannot be parsed as a URL', () => {
    // The catch branch: malformed strings must not throw — they return false.
    expect(isLoopbackUrl('not-a-url')).toBe(false)
    expect(isLoopbackUrl('')).toBe(false)
  })
})

/** Minimal valid environment — only DATABASE_URL is required; all others have defaults. */
const MINIMAL_VALID_ENV = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/notification_example',
}

describe('validateEnv', () => {
  describe('happy path — defaults applied on a minimal valid env', () => {
    it('returns the parsed env with defaults when only DATABASE_URL is set', () => {
      // Verifies that all optional fields fall back to their documented defaults.
      const env = validateEnv(MINIMAL_VALID_ENV)

      expect(env.PORT).toBe(3001)
      expect(env.NODE_ENV).toBe('development')
      expect(env.DEFAULT_LOCALE).toBe('en')
      expect(env.AUDIT_MASK_RECIPIENT).toBe(true)
      expect(env.WEB_ORIGIN).toBe('http://localhost:3003')
      expect(env.SMTP_URL).toBe('smtp://localhost:1025')
      expect(env.OTP_DEFAULT_TTL_SECONDS).toBe(600)
      expect(env.OTP_RESEND_COOLDOWN_SECONDS).toBe(60)
      expect(env.MAIL_FROM).toBe('no-reply@notification.local')
    })

    it('coerces PORT from string to number', () => {
      // Env vars arrive as strings; coercion must convert them.
      const env = validateEnv({ ...MINIMAL_VALID_ENV, PORT: '4000' })

      expect(env.PORT).toBe(4000)
    })

    it('coerces AUDIT_MASK_RECIPIENT from string "false" to boolean false', () => {
      // The stringbool coercion must handle env-style boolean strings.
      const env = validateEnv({ ...MINIMAL_VALID_ENV, AUDIT_MASK_RECIPIENT: 'false' })

      expect(env.AUDIT_MASK_RECIPIENT).toBe(false)
    })

    it('leaves REDIS_URL and RESEND_API_KEY undefined when not set', () => {
      // Absent optional vars must be undefined, not throw.
      const env = validateEnv(MINIMAL_VALID_ENV)

      expect(env.REDIS_URL).toBeUndefined()
      expect(env.RESEND_API_KEY).toBeUndefined()
    })
  })

  describe('failure path — required var missing or invalid', () => {
    it('throws when DATABASE_URL is missing', () => {
      // DATABASE_URL is required; absence must abort with a readable error.
      expect(() => validateEnv({})).toThrow('Invalid environment configuration')
    })

    it('names DATABASE_URL in the error message when it is missing', () => {
      // The aggregated message must identify which key failed.
      expect(() => validateEnv({})).toThrow('DATABASE_URL')
    })

    it('throws when DATABASE_URL is not a valid URL', () => {
      // A non-URL value must be rejected — prevents silent misconfigurations.
      expect(() => validateEnv({ DATABASE_URL: 'not-a-url' })).toThrow(
        'Invalid environment configuration',
      )
    })

    it('names DATABASE_URL in the error when the value is an invalid URL', () => {
      // The aggregated message must identify the offending key, not just report generically.
      expect(() => validateEnv({ DATABASE_URL: 'not-a-url' })).toThrow('DATABASE_URL')
    })

    it('throws when NODE_ENV is an unrecognized value', () => {
      // Only the enum values "development", "test", "production" are accepted.
      expect(() => validateEnv({ ...MINIMAL_VALID_ENV, NODE_ENV: 'staging' })).toThrow(
        'Invalid environment configuration',
      )
    })
  })

  describe('production guards', () => {
    it('throws when DATABASE_URL points to localhost in production', () => {
      // Loopback database URLs in production indicate a misconfiguration.
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/notification_example',
          WEB_ORIGIN: 'https://example.com',
        }),
      ).toThrow('must not point to localhost in production')
    })

    it('names DATABASE_URL in the production loopback error', () => {
      // The aggregated message must identify which URL triggered the guard.
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/notification_example',
          WEB_ORIGIN: 'https://example.com',
        }),
      ).toThrow('DATABASE_URL')
    })

    it('throws when REDIS_URL points to localhost in production', () => {
      // Optional Redis URL must also be checked against the loopback guard.
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://postgres:postgres@db.example.com:5432/notification_example',
          REDIS_URL: 'redis://127.0.0.1:6379',
          WEB_ORIGIN: 'https://example.com',
        }),
      ).toThrow('must not point to localhost in production')
    })

    it('throws when WEB_ORIGIN uses http:// in production', () => {
      // The CORS allow-list must be HTTPS in production to prevent insecure requests.
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://postgres:postgres@db.example.com:5432/notification_example',
          WEB_ORIGIN: 'http://example.com',
        }),
      ).toThrow('must use https:// in production')
    })

    it('names WEB_ORIGIN in the non-https error', () => {
      // The aggregated message must identify which key triggered the https guard.
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://postgres:postgres@db.example.com:5432/notification_example',
          WEB_ORIGIN: 'http://example.com',
        }),
      ).toThrow('WEB_ORIGIN')
    })

    it('accepts a valid production configuration', () => {
      // A fully correct production env must pass all guards without throwing.
      const env = validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres@db.example.com:5432/notification_example',
        WEB_ORIGIN: 'https://example.com',
      })

      expect(env.NODE_ENV).toBe('production')
      expect(env.WEB_ORIGIN).toBe('https://example.com')
    })
  })

  describe('field constraints and accepted values', () => {
    it('accepts each explicit NODE_ENV enum value', () => {
      // Passing the enum member explicitly proves it is a member (a blanked enum entry would
      // reject the very value it should accept), not just reachable via the default.
      expect(validateEnv({ ...MINIMAL_VALID_ENV, NODE_ENV: 'development' }).NODE_ENV).toBe(
        'development',
      )
      expect(validateEnv({ ...MINIMAL_VALID_ENV, NODE_ENV: 'test' }).NODE_ENV).toBe('test')
    })

    it('accepts a multi-character RESEND_API_KEY (min length, not max)', () => {
      // The key constraint is a MINIMUM length: a realistic multi-character key must pass (a
      // `.max(1)` mutant would reject anything longer than one character).
      expect(
        validateEnv({ ...MINIMAL_VALID_ENV, RESEND_API_KEY: 're_live_abc123' }).RESEND_API_KEY,
      ).toBe('re_live_abc123')
    })

    it('accepts a full MAIL_FROM address (min length, not max)', () => {
      // MAIL_FROM is bounded below by one character; a full address must be accepted verbatim.
      expect(validateEnv({ ...MINIMAL_VALID_ENV, MAIL_FROM: 'sender@example.com' }).MAIL_FROM).toBe(
        'sender@example.com',
      )
    })

    it('accepts a region-qualified DEFAULT_LOCALE (min length two, not max)', () => {
      // DEFAULT_LOCALE requires at least two characters; a `pt-BR`-style tag longer than two must
      // pass (a `.max(2)` mutant would reject it).
      expect(validateEnv({ ...MINIMAL_VALID_ENV, DEFAULT_LOCALE: 'en-US' }).DEFAULT_LOCALE).toBe(
        'en-US',
      )
    })
  })

  describe('aggregated error message formatting', () => {
    it('formats each issue as "  - <key>: <message>"', () => {
      // The aggregated message indents every offending key with a "  - " bullet and a ": "
      // separator so a misconfiguration is human-readable; the literal framing is pinned here.
      expect(() => validateEnv({ DATABASE_URL: 'not-a-url' })).toThrow(/ {2}- DATABASE_URL: /)
    })

    it('puts each offending key on its own newline-separated line', () => {
      // Two invalid vars must produce two distinct "  - " lines joined by a newline, not one
      // run-together line — proving the issue list is `\n`-joined.
      let message = ''
      try {
        validateEnv({ DATABASE_URL: 'not-a-url', PORT: 'not-a-number' })
      } catch (error) {
        message = (error as Error).message
      }
      const bulletLines = message.split('\n').filter((line) => line.startsWith('  - '))
      expect(bulletLines.length).toBeGreaterThanOrEqual(2)
    })
  })
})
