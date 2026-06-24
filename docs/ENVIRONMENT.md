# Environment

Runtime configuration is environment-variable driven, and the API variables are **validated at boot with
Zod** (`apps/api/src/config/env.schema.ts`). A missing or invalid variable **aborts startup** with a precise,
aggregated message rather than failing silently at runtime.

The root `.env.example` documents every variable; `apps/api` reads its own `.env` file.

---

## Reference

| Variable                        | Service | Default (dev)                                                        | Required in prod | Used for                                                                   |
| ------------------------------- | ------- | -------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| `NODE_ENV`                      | api     | `development`                                                        | ✅               | Drives production guards in the Zod schema                                 |
| `PORT`                          | api     | `3001`                                                               | —                | HTTP listen port                                                           |
| `DATABASE_URL`                  | api     | `postgresql://postgres:postgres@localhost:5432/notification_example` | ✅               | Prisma audit store (`@prisma/adapter-pg`)                                  |
| `REDIS_URL`                     | api     | _(unset ⇒ `InMemoryOtpStorage`)_                                     | recommended      | `RedisOtpStorage` (atomic, durable); absent → in-memory fallback           |
| `SMTP_URL`                      | api     | `smtp://localhost:1025`                                              | —                | Custom Nodemailer→Mailpit `IEmailProvider` (zero-credential dev default)   |
| `RESEND_API_KEY`                 | api     | _(unset ⇒ Nodemailer/NoOp)_                                          | —                | Switches the email provider to the bundled `ResendEmailProvider`           |
| `MAIL_FROM`                     | api     | `no-reply@notification.local`                                        | ✅               | `defaultFrom` address for every outbound email                             |
| `MAIL_FROM_NAME`                 | api     | _(unset)_                                                            | —                | `defaultFromName` display label (e.g. `Bymax Notification Example`)       |
| `DEFAULT_LOCALE`                | api     | `en`                                                                 | —                | Template locale fallback when the requested locale is not registered       |
| `OTP_DEFAULT_TTL_SECONDS`       | api     | `600`                                                                | —                | Default OTP time-to-live in seconds (overridable per-purpose)              |
| `OTP_RESEND_COOLDOWN_SECONDS`   | api     | `60`                                                                 | —                | Resend cooldown window in seconds (atomic `SET NX EX` in Redis)           |
| `AUDIT_MASK_RECIPIENT`          | api     | `true`                                                               | ✅               | Toggles `maskRecipient` — minimizes the recipient before persistence       |
| `WEB_ORIGIN`                    | api     | `http://localhost:3003`                                              | ✅               | CORS allow-origin for the console (must be `https://` in production)       |
| `NEXT_PUBLIC_API_URL`           | web     | `http://localhost:3001`                                              | ✅               | The console's API base URL (browser fetch target)                          |

---

## Production guards

The Zod schema applies additional cross-field validations in `NODE_ENV=production`:

- **`DATABASE_URL`** — must not point at a loopback host (`localhost`, `127.0.0.1`, `[::1]`).
- **`REDIS_URL`** — when set, must not point at a loopback host.
- **`WEB_ORIGIN`** — must use `https://`; a non-HTTPS origin is rejected so the console's CORS policy is
  never served over an insecure connection.

A missing `MAIL_FROM` also aborts the API — it is the `defaultFrom` for every outgoing email and there is no
safe fallback.

---

## Fail-fast at boot

Any invalid or missing required variable causes the process to exit before NestJS reaches the bootstrap phase:

```
Invalid environment configuration:
  - DATABASE_URL: Invalid url
  - WEB_ORIGIN: must use https:// in production
```

The message names every offending variable, so a misconfigured deploy surfaces its problems immediately in
the container startup logs rather than at the first affected request.

---

## Email provider selection

The email provider is resolved in `notification/notification.config.ts` based on which variables are set:

| Variables present             | Active `IEmailProvider`     | Emails land in…         |
| ----------------------------- | --------------------------- | ----------------------- |
| `RESEND_API_KEY` set          | `ResendEmailProvider`       | Resend dashboard        |
| `SMTP_URL` set, no Resend key | `NodemailerEmailProvider`   | Mailpit (`:8025`)       |
| Neither set                   | `NoOpEmailProvider`         | discarded silently      |

See [PROVIDERS.md](./PROVIDERS.md) for the bring-your-own-provider guide.

---

## OTP storage selection

| `REDIS_URL` present | Active `IOtpStorage`     | Durability                    |
| ------------------- | ------------------------ | ----------------------------- |
| Yes                 | `RedisOtpStorage`        | Durable, atomic (Redis Lua)   |
| No (default)        | `InMemoryOtpStorage`     | In-process only; lost on restart |

For production, always set `REDIS_URL` — in-memory storage loses all pending codes on a restart or on
more than one API instance.

---

## Recipient masking

`AUDIT_MASK_RECIPIENT=true` (the default) enables `maskRecipient` in the audit configuration. The masking
function minimizes the recipient address before it reaches the `NotificationLog` table:
`jane@acme.com → j***@acme.com`. Setting it to `false` stores the plain address — useful for local
debugging, but not for production. See [MULTI_TENANCY.md](./MULTI_TENANCY.md) for the full treatment.

---

## See also

- [PROVIDERS.md](./PROVIDERS.md) — `SMTP_URL`, `RESEND_API_KEY`, and the bring-your-own-provider guide
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — `AUDIT_MASK_RECIPIENT` and recipient privacy
- [DEPLOYMENT.md](./DEPLOYMENT.md) — production values and the managed-service checklist
- [OVERVIEW.md §9](./OVERVIEW.md#9-configuration--environment) — canonical env table
