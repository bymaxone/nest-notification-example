# Providers

How to write and wire a custom `IEmailProvider`, a custom `IOtpStorage`, and how to swap the renderer.
The three interfaces are the extension points of `@bymax-one/nest-notification`; the example exercises all
of them.

For the Zod env variables that select between providers, see **[ENVIRONMENT.md](./ENVIRONMENT.md)**.
For the renderer contract, see **[TEMPLATING.md](./TEMPLATING.md)**.

---

## The provider/channel matrix

| Boundary           | Contract                                   | Bundled reference                          | This example wires                                                               |
| ------------------ | ------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Email transport    | `IEmailProvider`                           | `ResendEmailProvider`, `NoOpEmailProvider` | Custom `NodemailerEmailProvider` → Mailpit (zero-cred default) + Resend (opt-in) |
| OTP storage        | `IOtpStorage` (atomic; 9 methods + `name`) | `RedisOtpStorage`, `InMemoryOtpStorage`    | Redis (opt-in via `REDIS_URL`) or in-memory fallback                             |
| Template rendering | `IEmailTemplateRenderer`                   | `DefaultTemplateRenderer`                  | Default + Handlebars / MJML / React Email demos                                  |
| Audit sink         | `INotificationLogRepository`               | `NoOpNotificationLogRepository`            | `PrismaNotificationLogRepository` over Postgres                                  |

---

## `IEmailProvider` — writing and wiring a custom provider

The `IEmailProvider` contract has three members:

```typescript
interface IEmailProvider {
  /** Human-readable name surfaced in audit rows and diagnostics. */
  readonly name: string

  /** Returns true when the provider is correctly configured and should be used. */
  isConfigured(): boolean

  /** Deliver a single email. Throws on delivery failure. */
  send(options: EmailSendOptions): Promise<EmailSendResult>
}
```

### The shipped example — `NodemailerEmailProvider`

`apps/api/src/notification/providers/nodemailer-email.provider.ts` is the headline BYO demo: a ~50-line
class that routes emails through Nodemailer to the local Mailpit SMTP sink. It is wired as an **instance**
(not a class) in `notification.config.ts` because its constructor takes the `SMTP_URL` string from `ConfigService`:

```typescript
// Inside notification.config.ts useFactory
const provider = new NodemailerEmailProvider(config.getOrThrow('SMTP_URL'))
// ...
email: { provider, … }
```

### Opt-in Resend provider

When `RESEND_API_KEY` is set, `notification.config.ts` returns `new ResendEmailProvider({ apiKey })` instead.
No call site changes — the same `IEmailProvider` contract is honoured:

```typescript
function resolveEmailProvider(config: ConfigService): IEmailProvider {
  const apiKey = config.get<string>('RESEND_API_KEY')
  if (apiKey) return new ResendEmailProvider({ apiKey })
  const smtpUrl = config.get<string>('SMTP_URL', 'smtp://localhost:1025')
  return new NodemailerEmailProvider(smtpUrl)
}
```

### Writing your own provider (SendGrid, AWS SES, Mailgun…)

1. Implement the three-member contract above.
2. Do **not** log the email body — it may contain OTP codes or PII.
3. Throw a plain `Error` on delivery failure. `EmailService` maps it to `EMAIL_SEND_FAILED` (502).
4. Pass the instance to `email.provider` in `notification.config.ts`.

```typescript
// Example: a minimal SendGrid adapter
export class SendGridEmailProvider implements IEmailProvider {
  readonly name = 'sendgrid'
  constructor(private readonly apiKey: string) {}

  isConfigured(): boolean { return this.apiKey.length > 0 }

  async send(opts: EmailSendOptions): Promise<EmailSendResult> {
    const res = await sgMail.send({ … })
    return { messageId: res[0]?.headers['x-message-id'] ?? '' }
  }
}
```

### The zero-arg class form

The library also accepts a **class** (not an instance) in the `email.provider` slot, but only for classes
with a **zero-argument constructor** (e.g. `NoOpEmailProvider`). DI-dependent adapters — anything whose
constructor requires injected values — must be passed as instances. The `library-probe.ts` demonstrates
the zero-arg class form for `NoOpEmailProvider` and `InMemoryOtpStorage`.

---

## `IOtpStorage` — writing a custom storage

The `IOtpStorage` contract has **nine methods plus `name`**. Two of them (`consumeAttempt` and
`tryAcquireCooldown`) must be **atomic** — this is where a naive implementation introduces a security bug.

```typescript
interface IOtpStorage {
  readonly name: string

  /** Persist a newly generated code. */
  set(key: string, value: OtpStorageEntry): Promise<void>

  /** Retrieve a persisted entry. Returns null when absent or expired. */
  get(key: string): Promise<OtpStorageEntry | null>

  /** Delete an entry. */
  delete(key: string): Promise<void>

  /** Remove all entries. Used in tests. */
  clear?(): Promise<void>

  /** Return the number of entries. Used in tests. */
  size?(): Promise<number>

  /**
   * ATOMIC decrement of the remaining-attempts counter.
   * A non-atomic get+update lets max_attempts be bypassed under concurrency.
   */
  consumeAttempt(key: string): Promise<{ remainingAttempts: number; allowed: boolean }>

  /**
   * ATOMIC cooldown acquisition (SET NX EX pattern).
   * Two concurrent generates must not both pass the cooldown window.
   */
  tryAcquireCooldown(key: string, ttlSeconds: number): Promise<boolean>

  /** Release the cooldown key. Called on delivery failure so a bounced email never locks out. */
  releaseCooldown(key: string): Promise<void>

  /** Extend or shrink a key's TTL. */
  expire(key: string, ttlSeconds: number): Promise<void>
}
```

### The shipped implementations

- **`InMemoryOtpStorage`** — the default when `REDIS_URL` is unset. Single-threaded (Node event loop ensures
  atomicity for `consumeAttempt` and `tryAcquireCooldown`). Exposes `clear()` and `size()` for test
  assertions. In-process only — lost on restart.
- **`RedisOtpStorage({ redisClient })`** — the production implementation. Uses Redis Lua scripts for atomic
  `consumeAttempt` and `tryAcquireCooldown`. Keys are namespaced with `redisNamespace + ':'` (default
  `notification:`) + `sha256(tenantId:recipient)` so they are safe for multi-tenant and multi-instance
  deployments.

### Wiring in `notification.config.ts`

```typescript
const redis = config.get<Redis | null>('REDIS_URL') ? ioredisClient : null
otp: {
  storage: redis ? new RedisOtpStorage({ redisClient: redis }) : new InMemoryOtpStorage(),
  …
}
```

### Writing your own storage (DynamoDB, any KV…)

Implement all nine members with the atomicity contract on `consumeAttempt` and `tryAcquireCooldown`. The
storage key passed to every method is already `sha256(tenantId:recipient)` — the library computes it before
calling the storage methods. Your implementation never sees the plaintext recipient.

---

## Provider / storage instances vs classes

In `forRootAsync` mode, the library resolves providers through a mini-container:

| Form                    | Works when                             | Example                                   |
| ----------------------- | -------------------------------------- | ----------------------------------------- |
| Instance (`new Foo(…)`) | Always — the instance is used directly | `new NodemailerEmailProvider(smtpUrl)`    |
| Class (`Foo`)           | Only when the constructor is zero-arg  | `NoOpEmailProvider`, `InMemoryOtpStorage` |

Passing a class with constructor parameters (e.g. `NodemailerEmailProvider` which takes `smtpUrl`) causes
`instantiate()` to throw. Always pass DI-dependent adapters as instances wired in the factory.

---

## See also

- [TEMPLATING.md](./TEMPLATING.md) — `IEmailTemplateRenderer` contract and renderer demos
- [ENVIRONMENT.md](./ENVIRONMENT.md) — `SMTP_URL`, `RESEND_API_KEY`, `REDIS_URL`
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how providers slot into the delivery pipeline
- [OVERVIEW.md §12](./OVERVIEW.md#12-channels--providers-showcase) — the full channel/provider matrix
