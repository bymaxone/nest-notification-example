# Architecture

How a `EmailService.send(…)` or `OtpService.generate(…)` call flows through four stages — resolve, render,
deliver, audit — and why the module boundaries are drawn where they are.

For the schema and querying side of the audit store, see **[DATABASE.md](./DATABASE.md)**. For the full
product blueprint, see **[OVERVIEW.md §11](./OVERVIEW.md#11-the-notification-delivery-pipeline-deep-dive)**.

---

## The four-stage delivery pipeline

Every notification send flows through four stages. Each runs in process, synchronously, before the HTTP
response is sent:

```
request ──▶ [1] resolve ──▶ [2] render ──▶ [3] deliver ──▶ [4] audit
            tenantId         template via    provider.send    INotificationLog
            (trusted header) IEmailTemplate   (Mailpit/Resend)  .create (masked,
                             Renderer (escape) or OTP storage    never the code)
                                              (atomic Lua)
```

### Stage 1 — Resolve

The `tenantId` always comes from a **trusted source** — never the request body. On the audited `/dispatch`
route, the `NotificationAuditInterceptor` calls `tenantIdResolver(req)` and uses its result as the
authoritative tenant for the audit row. A `tenantId` forged in the body is overridden silently.

On the direct routes (`/otp/*`, `/email/*`) the controller derives `tenantId` from the trusted
`x-tenant-id` header before passing it to the service method — the resolver is not auto-applied to
non-intercepted handlers. The **Spoof tenant** demo exercises `/dispatch` to show the override in action.

### Stage 2 — Render (email only)

`EmailService.sendTemplate` resolves the requested locale → `en` fallback, then calls
`IEmailTemplateRenderer.render`. The `DefaultTemplateRenderer` interpolates `{{var}}` placeholders and
**HTML-escapes the html body only** — subject and text are not HTML contexts and are passed through unchanged.
This closes a stored-XSS vector without escaping non-HTML fields.

The OTP path auto-injects `{ code, expiresInMinutes, purpose }` into the render data so the `otp_code`
template receives the code without the controller ever handling it.

### Stage 3 — Deliver

Email goes through `IEmailProvider.send`. A throw maps to `EMAIL_SEND_FAILED` (502). The provider name
(`nodemailer` / `resend` / `no-op`) is surfaced in every audit row.

OTP goes through `IOtpStorage`. `consumeAttempt` (verify) and `tryAcquireCooldown` (generate/resend) are
**atomic** — a Redis Lua script or single-threaded in-memory read-modify-write — so `maxAttempts` cannot be
brute-forced under concurrency, and two simultaneous generates cannot both pass the cooldown window. On a
delivery failure the cooldown is released so a bounced email never locks the user out.

### Stage 4 — Audit

A fire-and-forget `INotificationLogRepository.create(entry)` records the verb with the **masked** recipient
and **never the OTP code**. With `swallowErrors: true` (the default) an audit failure cannot crash the
delivery path or surface to the caller. The interceptor path emits an additional row with
`providerName: '__interceptor__'` so the Explorer can separate service-level events from HTTP-boundary events.

---

## The delivery pipeline as an ASCII diagram

```
            apps/web (Next.js 16 + React 19)  —  the Notification Console
   Trigger Center → fire every feature   Explorer → read the delivery audit log
   OTP-verify panel (useOtpInput/useOtpCountdown)   Provider matrix · Email preview · Roadmap
        │  POST /otp/* /email/* /dispatch (+ x-tenant-id)        ▲ GET /audit/logs, /audit/stream (SSE)
        ▼                                                        │
   ┌─────────────────────────────────────────────────────────────┴──────────────┐
   │ apps/api (NestJS 11 + Express 5)                                            │
   │ BymaxNotificationModule.forRootAsync({ useFactory })                        │
   │ EmailService · OtpService · NotificationService · NotificationAuditInterceptor │
   │ wired providers: Nodemailer→Mailpit (BYO) | Resend (opt-in) | NoOp          │
   │ wired storage:  RedisOtpStorage (opt-in) | InMemoryOtpStorage               │
   │ wired audit:    PrismaNotificationLogRepository                             │
   └───────┬───────────────────────┬───────────────────────┬───────────────────┘
   OTP entries (hashed keys)   audit rows (masked)      rendered emails (SMTP)
           ▼                       ▼                         ▼
   ┌───────────────┐       ┌────────────────────┐    ┌────────────────────┐
   │     Redis     │       │    PostgreSQL      │    │      Mailpit       │
   │  (OTP store)  │       │  NotificationLog   │    │  SMTP :1025 / :8025 │
   └───────────────┘       └────────────────────┘    └────────────────────┘
```

---

## `forRootAsync` wiring

The single source of truth for how the library is configured is
`apps/api/src/notification/notification.config.ts` — a factory returning `BymaxNotificationModuleOptions`
from validated env, wired into `forRootAsync`. Because `useFactory` is typed `(...args: never[]) => …`, its
parameters **must be explicitly annotated**:

```typescript
// apps/api/src/app.module.ts (shape)
BymaxNotificationModule.forRootAsync({
  imports: [ConfigModule, RedisModule, PrismaModule],
  inject: [ConfigService, REDIS, PrismaService],
  useFactory: (config: ConfigService, redis: Redis | null, prisma: PrismaService) =>
    buildNotificationOptions(config, redis, prisma),
})
// + { provide: APP_INTERCEPTOR, useClass: NotificationAuditInterceptor }
```

`RedisModule` (`apps/api/src/redis/redis.module.ts`) exports the `REDIS` token, which resolves to an
`ioredis` client **or `null`** when `REDIS_URL` is unset. `PrismaModule` provides `PrismaService` (the
`@prisma/adapter-pg` driver-adapter client).

The `useClass`/`useExisting` forms are rejected at startup by `assertUseFactory` — this is proved by
`POST /admin/try-configure-async-useclass` (see [FEATURES.md §12](./FEATURES.md#12-roadmap-honesty)).

---

## Module boundaries — public vs internal

The library's public surface is what `apps/api` and `apps/web` may import. Everything else is internal.

| Public (the contract this example depends on)                                                                       | Internal (never imported directly)                     |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `BymaxNotificationModule` (`.` subpath)                                                                             | Config resolution internals (`resolveForPurpose` impl) |
| `EmailService`, `OtpService`, `NotificationService`                                                                 | Redis Lua source                                       |
| `NotificationAuditInterceptor`                                                                                      | Internal validators / crypto implementation details    |
| `IEmailProvider`, `IOtpStorage`, `IEmailTemplateRenderer`                                                           |                                                        |
| `INotificationLogRepository`                                                                                        |                                                        |
| `ResendEmailProvider`, `NoOpEmailProvider`                                                                          |                                                        |
| `InMemoryOtpStorage`, `RedisOtpStorage`                                                                             |                                                        |
| `DefaultTemplateRenderer`                                                                                           |                                                        |
| `NoOpNotificationLogRepository`                                                                                     |                                                        |
| `NotificationException`, `NOTIFICATION_ERROR_CODES` (22 keys)                                                       |                                                        |
| `NotificationErrorResponse`, `NOTIFICATION_PURPOSES`, `CANONICAL_EMAIL_TEMPLATES` (`./shared`)                      |                                                        |
| `useOtpInput`, `useOtpCountdown` (`./react`)                                                                        |                                                        |
| DI tokens: `BYMAX_NOTIFICATION_OPTIONS`, `_EMAIL_PROVIDER`, `_OTP_STORAGE`, `_TEMPLATE_RENDERER`, `_LOG_REPOSITORY` |                                                        |
| Resolved-options types: `ResolvedNotificationOptions` and sub-types                                                 |                                                        |
| Crypto utilities: `hashTenantRecipient`, `generateOtpCode`, `safeCompare`                                           |                                                        |
| `CANONICAL_EMAIL_TEMPLATES`, `DEFAULT_TTLS`, `OtpPurpose`, `NotificationChannel`                                    |                                                        |

`apps/api/src/library-probe.ts` references the otherwise-hard-to-exercise symbols (resolved-options types,
SMS/Push v0.2 tokens, zero-arg class form) to satisfy the export-usage audit. See
[OVERVIEW §7](./OVERVIEW.md#7-library-consumption).

---

## `apps/api` module map

```
AppModule
  ├── ConfigModule (Zod env schema, fail-fast)
  ├── RedisModule  (REDIS token → ioredis | null)
  ├── PrismaModule (PrismaService, @prisma/adapter-pg)
  ├── BymaxNotificationModule.forRootAsync(…)
  │     ├── EmailService   ← IEmailProvider, IEmailTemplateRenderer
  │     ├── OtpService     ← IOtpStorage
  │     └── NotificationService
  ├── APP_INTERCEPTOR: NotificationAuditInterceptor → INotificationLogRepository
  ├── OtpModule          (POST /otp/*)
  ├── EmailModule        (POST /email/*)
  ├── DispatchModule     (POST /dispatch, GET /channels)
  ├── AuditModule        (GET /audit/logs, /audit/stream, /audit/aggregate)
  ├── AdminModule        (POST /admin/try-configure-*)
  ├── DebugModule        (GET /debug/key)
  ├── HealthModule       (GET /health)
  └── AuthDemoModule     (POST /auth-demo/send-verification — optional §14)
```

---

## Two audit sources

Rows arrive in `NotificationLog` from **two** independent places; the Explorer's **source facet** separates them:

| Source                                  | `providerName`      | Verbs emitted                                                                               | Route(s)         |
| --------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------- | ---------------- |
| Services (`OtpService`, `EmailService`) | real provider name  | `generated` / `sent` / `verified` / `failed` / `cooldown_blocked` / `max_attempts_exceeded` | all routes       |
| `NotificationAuditInterceptor`          | `'__interceptor__'` | `sent` / `failed`                                                                           | `/dispatch` only |

A dispatched OTP-generate therefore writes **both** a service `generated` row and an interceptor `sent` row.

---

## See also

- [DATABASE.md](./DATABASE.md) — `NotificationLog` schema, keyset queries, masked-recipient persistence
- [DASHBOARD.md](./DASHBOARD.md) — the `apps/web` information architecture and SSE live tail
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — `sha256(tenantId:recipient)` keys, `maskRecipient`, never-log-codes
- [OVERVIEW.md §11](./OVERVIEW.md#11-the-notification-delivery-pipeline-deep-dive) — full pipeline deep-dive
