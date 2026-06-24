# Features

Every feature `@bymax-one/nest-notification` ships is fired here and shown working — by `curl` or from the
`apps/web` **Trigger Center**. This page has two halves: a **feature → demo map** that points each library
surface at the file that exercises it, and **thirteen end-to-end journeys**, each with the exact command, the
result, and the teaching point.

No OTP code appears unmasked. Recipients are masked in the audit log (`j***@acme.com`). The never-log-codes
invariant is verified in journey 1 and the Explorer detail drawer.

---

## The 13 journeys

1. [First email in 60 seconds](#1-first-email-in-60-seconds)
2. [Register + verify OTP](#2-register--verify-otp)
3. [Wrong code, then lockout](#3-wrong-code-then-lockout)
4. [Resend cooldown](#4-resend-cooldown)
5. [Per-purpose OTP config](#5-per-purpose-otp-config)
6. [Template render + XSS guard](#6-template-render--xss-guard)
7. [Locale fallback](#7-locale-fallback)
8. [Bring-your-own provider (Resend opt-in)](#8-bring-your-own-provider-resend-opt-in)
9. [Multi-tenant isolation + anti-spoof](#9-multi-tenant-isolation--anti-spoof)
10. [Audit fault tolerance](#10-audit-fault-tolerance)
11. [Unified dispatch](#11-unified-dispatch)
12. [Roadmap honesty](#12-roadmap-honesty)
13. [Auth email backed by nest-notification (optional)](#13-auth-email-backed-by-nest-notification-optional)

---

## Feature → demo map

| Library surface                                                                  | What it does                                       | Demonstrated in                                                                               | Fire it with           |
| -------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| `BymaxNotificationModule.forRoot(options)`                                       | Synchronous module registration                    | `apps/api/test/forroot-sync.e2e-spec.ts`                                                      | `pnpm test:e2e`        |
| `BymaxNotificationModule.forRootAsync({ imports, inject, useFactory })`          | Async registration from `ConfigService`            | `apps/api/src/app.module.ts` + `notification/notification.config.ts`                          | starts with the API    |
| `assertUseFactory` / `useClass`/`useExisting` rejection                          | Startup guard — only `useFactory` accepted         | `POST /admin/try-configure-async-useclass`; web **Roadmap** panel                             | journey 12             |
| `NoOpEmailProvider` / `InMemoryOtpStorage` as zero-arg class form                | Provider resolution for zero-arg constructors      | `apps/api/src/library-probe.ts`                                                               | implicit in unit tests |
| DI tokens (`BYMAX_NOTIFICATION_OPTIONS` etc.)                                    | Token resolution proof                             | `apps/api/src/library-probe.ts`                                                               | implicit in unit tests |
| `EmailService.send(EmailSendInput)`                                              | Raw email send                                     | `POST /email/send`; web **Trigger Center → Send raw email**                                   | journey 1              |
| `EmailService.sendTemplate(EmailSendTemplateInput)`                              | Rendered template email                            | `POST /email/send-template`; web **Send template**                                            | journeys 6, 7          |
| `EmailService.isConfigured()` / `OtpService.isConfigured()`                      | Channel readiness probe                            | `GET /channels`; web **Settings** status badges                                               | `GET /channels`        |
| `IEmailProvider` contract (`send`/`isConfigured`/`name`)                         | Bring-your-own email provider                      | `providers/nodemailer-email.provider.ts` (→ Mailpit)                                          | journey 1              |
| `ResendEmailProvider({ apiKey })`                                                | Bundled Resend provider                            | `notification/notification.config.ts` (opt-in via `RESEND_API_KEY`); web **Providers** matrix | journey 8              |
| `NoOpEmailProvider`                                                              | No-op dev provider (fallback)                      | `notification.config.ts` (when no SMTP/Resend configured)                                     | implicit               |
| `maxAttachmentBytes` → `EMAIL_ATTACHMENTS_TOO_LARGE`                             | Attachment size guard (413)                        | `POST /email/send` oversize; web **Trigger Center → oversize attachment**                     | Trigger Center         |
| `defaultFrom` / `defaultFromName` / `defaultReplyTo` / `defaultTags`             | Email envelope defaults                            | `email/` send form; preview shows resolved envelope                                           | journey 1              |
| `DefaultTemplateRenderer` (`{{var}}`, HTML-escapes html body only)               | Built-in XSS-safe template renderer                | `POST /email/send-template`; web **Email preview**                                            | journey 6              |
| Template locale resolution → `en` fallback; `TEMPLATE_NOT_FOUND`                 | Locale fallback                                    | Send template with `locale:'pt-BR'`; web **Send template**                                    | journey 7              |
| `CANONICAL_EMAIL_TEMPLATES` (10 names)                                           | Canonical template name constants                  | `notification/templates.ts`; web template dropdown                                            | implicit               |
| `IEmailTemplateRenderer` contract + Handlebars/MJML/React Email demos            | Pluggable renderer                                 | `notification/renderers/*`; web **Providers → Renderer** switch                               | web Providers panel    |
| `onMissingVar` / `enableNestedPaths` renderer options                            | Renderer behavior knobs                            | web **Email preview** toggles                                                                 | web Providers panel    |
| `OtpService.generate({ deliverVia:'email' })`                                    | OTP generate + email delivery                      | `POST /otp/generate`; web **OTP panel**                                                       | journey 2              |
| `OtpService.generate({ deliverVia:'manual' })`                                   | OTP generate (manual delivery — code not returned) | `POST /otp/generate` manual toggle                                                            | Trigger Center         |
| `OtpService.verify` → `OtpVerifyResult` (never throws)                           | Atomic + constant-time verify                      | `POST /otp/verify`; web OTP box `onComplete`                                                  | journey 2, 3           |
| `OtpService.resend` → `{ expiresAt, cooldownSeconds }`                           | Resend under cooldown                              | `POST /otp/resend`; web **Resend** button                                                     | journey 4              |
| `OtpService.consume`                                                             | Invalidate a code                                  | `POST /otp/consume`; web **Cancel code**                                                      | Trigger Center         |
| `OtpService.getStatus` → `OtpStatusResult`                                       | Inspect state (never the code)                     | `GET /otp/status`; web **Inspect OTP** panel                                                  | Trigger Center         |
| `defaultCodeType` `numeric`/`alpha`/`alphanumeric` + `generateOtpCode`           | Code charset                                       | per-purpose config drives OTP box type/length                                                 | journey 5              |
| `defaultTtlSeconds`                                                              | OTP TTL / expiry                                   | countdown via `useOtpCountdown({ expiresAt })`                                                | journey 2              |
| `defaultMaxAttempts` → atomic `consumeAttempt` → `reason:'max_attempts'`         | Max-attempts lockout (atomic)                      | wrong code ×N → 429                                                                           | journey 3              |
| `resendCooldownSeconds` → `OTP_COOLDOWN_ACTIVE` (429)                            | Resend cooldown (atomic `SET NX EX`)               | spam generate → 429 with `details.remainingSeconds`                                           | journey 4              |
| `perPurpose` / `resolveForPurpose`                                               | Per-purpose overrides                              | `password_reset` (8-char alphanumeric, 900s TTL)                                              | journey 5              |
| `consumeOnVerify` (resolved once at boot)                                        | Consume-on-verify policy                           | Settings shows the configured value                                                           | web Settings panel     |
| `NOTIFICATION_PURPOSES` / `OtpPurpose`                                           | Canonical purpose constants                        | purpose dropdown in Trigger Center / OTP panel                                                | implicit               |
| `{ code, expiresInMinutes, purpose }` auto-injected into render data             | OTP email auto-injection                           | `otp_code` template renders the injected code                                                 | journey 2              |
| `IOtpStorage` (9 methods + `name`; atomic `consumeAttempt`/`tryAcquireCooldown`) | Bring-your-own OTP storage                         | `InMemoryOtpStorage` is the default reference; `PROVIDERS.md`                                 | unit tests             |
| `InMemoryOtpStorage` (+ `clear`/`size`)                                          | Default dev storage                                | used when `REDIS_URL` is unset; e2e suites                                                    | implicit               |
| `RedisOtpStorage({ redisClient })`                                               | Production Redis storage (atomic Lua)              | `notification.config.ts` (opt-in via `REDIS_URL`)                                             | set `REDIS_URL`        |
| `hashTenantRecipient(tenantId, recipient)`                                       | SHA-256 storage keys                               | `GET /debug/key`; web **Inspect OTP → storage key**                                           | `GET /debug/key`       |
| `generateOtpCode` / `safeCompare`                                                | Crypto utilities                                   | exercised transitively + `library-probe.ts`                                                   | implicit               |
| `NotificationService.dispatch({ channel:'email' })`                              | Unified dispatch (email)                           | `POST /dispatch`; web **Unified dispatch** tab                                                | journey 11             |
| `NotificationService.dispatch({ channel:'otp', payload:{ action } })`            | Unified dispatch (OTP)                             | `POST /dispatch` action select                                                                | journey 11             |
| `NotificationService.getEnabledChannels()`                                       | Enabled-channel introspection                      | `GET /channels`; web channel badges                                                           | `GET /channels`        |
| `getEmail()`/`getOtp()` → `CHANNEL_DISABLED` (501)                               | Disabled-channel guard                             | a channel-off config variant surfaces 501                                                     | Trigger Center         |
| `tenantIdResolver(NotificationRequest)` on the audit interceptor                 | Tenant anti-spoofing                               | **Spoof tenant** toggle on `/dispatch`                                                        | journey 9              |
| `sha256(tenantId:recipient)` keying                                              | Multi-tenant isolation                             | Tenant switcher; same recipient under acme vs globex isolated                                 | journey 9              |
| `audit.maskRecipient`                                                            | Recipient masking in audit rows                    | audit table shows `j***@acme.com`                                                             | journey 9              |
| Never-log-codes invariant (regression test)                                      | OTP code never in audit row                        | Explorer detail drawer → green check                                                          | journey 9              |
| `INotificationLogRepository.create(NotificationLogEntry)`                        | Audit repository (Prisma)                          | `providers/prisma-notification-log.repository.ts`; Explorer                                   | every send/verify      |
| `NoOpNotificationLogRepository`                                                  | No-op audit sink (default)                         | used when `audit` unconfigured (Settings variant)                                             | web Settings variant   |
| `NotificationAuditInterceptor` on `/dispatch`                                    | Audit interceptor (opt-in)                         | `app.module.ts` `APP_INTERCEPTOR`                                                             | journey 11             |
| `swallowErrors` true/false → `AUDIT_LOG_FAILED` (500)                            | Audit fault policy                                 | **Break audit sink** toggle                                                                   | journey 10             |
| `NotificationLogEntry` / `NotificationLogVerb`                                   | Audit entry shape & verbs                          | Explorer columns + detail drawer                                                              | every send/verify      |
| `NotificationException` + `NOTIFICATION_ERROR_CODES` (22 keys)                   | Error catalog + exception                          | `common/` HTTP filter; every error code localized in the UI                                   | every error path       |
| `NotificationErrorResponse` (`./shared`)                                         | Error response envelope                            | web imports `./shared` to localize each `error.code`                                          | every error path       |
| `toRetryAfterHeader` / `cooldownExpiresAt` / `formatCooldown`                    | Cooldown presentation helpers                      | API sets `Retry-After` on 429; web renders `formatCooldown` countdown                         | journey 4              |
| `useOtpInput` hook                                                               | OTP input hook (segmented box)                     | `otp/page.tsx` 6-cell segmented box with paste / auto-advance / backspace nav                 | web OTP panel          |
| `useOtpCountdown({ expiresAt })` hook                                            | OTP countdown hook                                 | expiry pill + resend gating in the OTP panel                                                  | web OTP panel          |
| `OtpPurpose` / `NotificationChannel` / `DEFAULT_TTLS` (`./shared`)               | Isomorphic shared constants / types                | purpose and channel selectors in the console                                                  | web everywhere         |
| `SmsChannelOptions` / `ISmsProvider` → throws at startup                         | SMS roadmap rejection                              | `POST /admin/try-configure-sms`; web **Roadmap** panel                                        | journey 12             |
| `PushChannelOptions` / `IPushProvider` → throws at startup                       | Push roadmap rejection                             | `POST /admin/try-configure-push`; web **Roadmap** panel                                       | journey 12             |
| SMS/Push tokens + codes (`./shared` v0.2 surface)                                | Declared-only v0.2 surface                         | `library-probe.ts` references (audit-satisfying, labeled v0.2)                                | implicit               |
| `ResolvedNotificationOptions` / resolved sub-types                               | Resolved-options types (advanced)                  | `library-probe.ts` (typed read of injected options)                                           | implicit               |
| `GET /audit/stream` (`@Sse`)                                                     | Real-time delivery feed over SSE                   | **Explorer** live tail                                                                        | web Explorer toggle    |
| `GET /audit/aggregate`                                                           | Delivery health charts                             | **Overview** panel (send/verify/failure rates, provider mix)                                  | web Overview           |

---

## 1. First email in 60 seconds

**Intent.** A raw email send lands in a browsable Mailpit inbox with a delivery audit row.

**Fire it.**

```bash
curl -sS -X POST http://localhost:3001/email/send \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{
    "to": "alice@acme.com",
    "subject": "Hello from nest-notification",
    "html": "<p>Your first notification email.</p>",
    "text": "Your first notification email."
  }'
```

**You get:**

```json
{ "messageId": "<…@mailpit.local>" }
```

Open `http://localhost:8025` — the message is in the inbox. Open the Audit Explorer at
`http://localhost:3003/explorer` — a row with `verb: sent` and `recipient: a***@acme.com` appeared.

**Notice.** The recipient is already masked in the audit row (`a***@acme.com`) — `audit.maskRecipient` is on
by default. The Explorer detail drawer shows a green check: "No OTP code present in this audit entry."

**From the dashboard.** Trigger Center → **Send raw email** → auto-pivots the Explorer to this send.

---

## 2. Register + verify OTP

**Intent.** The full OTP lifecycle: generate → email delivery → verify → consume.

```bash
# Generate — code emailed to Mailpit
curl -sS -X POST http://localhost:3001/otp/generate \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "recipient": "alice@acme.com", "purpose": "email_verification", "deliverVia": "email" }'
```

```json
{ "expiresAt": "2026-06-24T10:05:00.000Z", "cooldownSeconds": 60 }
```

Open Mailpit (`http://localhost:8025`) and copy the 6-digit code. The OTP panel at
`http://localhost:3003/otp` starts the `useOtpCountdown` expiry pill the moment `expiresAt` arrives.

```bash
# Verify — replace 123456 with the real code
curl -sS -X POST http://localhost:3001/otp/verify \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "recipient": "alice@acme.com", "purpose": "email_verification", "code": "123456" }'
```

```json
{ "valid": true }
```

```bash
# Consume — invalidate the code (it would not verify a second time after consume)
curl -sS -X POST http://localhost:3001/otp/consume \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "recipient": "alice@acme.com", "purpose": "email_verification" }'
```

**Notice.** `OtpService.verify` never throws — it returns a discriminated `OtpVerifyResult`. The controller
maps the result to HTTP: `valid → 200`, `invalid_code → 401`, `not_found → 404`, `max_attempts → 429`.
Expiry is reported as `not_found` (the library makes expiry indistinguishable from "never existed").

**From the dashboard.** The **OTP panel** (`/otp`) drives this end-to-end with `useOtpInput` (segmented
6-cell box with paste / auto-advance / backspace navigation) and `useOtpCountdown` (expiry pill + resend
gating).

---

## 3. Wrong code, then lockout

**Intent.** Proves the atomic `consumeAttempt` counter: each wrong attempt decreases `remainingAttempts`; the
fourth attempt returns `max_attempts`.

Generate a code (journey 2), then send three wrong codes:

```bash
for i in 1 2 3; do
  curl -sS -X POST http://localhost:3001/otp/verify \
    -H 'content-type: application/json' \
    -H 'x-tenant-id: acme' \
    -d '{ "recipient": "alice@acme.com", "purpose": "email_verification", "code": "000000" }'
done
```

The third response (matching `defaultMaxAttempts: 3`) returns HTTP 429:

```json
{ "error": { "code": "OTP_MAX_ATTEMPTS_EXCEEDED", "message": "…" } }
```

**Notice.** The counter is **atomic** (Redis Lua / single-threaded in-memory read-modify-write). Two
concurrent requests cannot both decrement past zero and both succeed — that would bypass the max-attempts
guard.

---

## 4. Resend cooldown

**Intent.** A second `generate` inside the cooldown window is rejected. The UI renders `formatCooldown`.

```bash
# First generate (starts the 60s cooldown)
curl -sS -X POST http://localhost:3001/otp/generate \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "recipient": "alice@acme.com", "purpose": "email_verification", "deliverVia": "email" }'

# Immediate second generate — hits the cooldown
curl -sS -X POST http://localhost:3001/otp/generate \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "recipient": "alice@acme.com", "purpose": "email_verification", "deliverVia": "email" }'
```

Second response is HTTP 429:

```json
{ "error": { "code": "OTP_COOLDOWN_ACTIVE", "details": { "remainingSeconds": 58 } } }
```

The response also carries `Retry-After: 58`. The OTP panel's **Resend** button is disabled until the cooldown
clears; `formatCooldown(58)` renders the pill.

**Notice.** `tryAcquireCooldown` is an **atomic** `SET NX EX` in Redis. Two concurrent generates cannot both
pass the cooldown window — the second atomically observes the existing key. On a delivery failure the cooldown
is released so a bounced email never locks the user out.

---

## 5. Per-purpose OTP config

**Intent.** The `perPurpose` override changes OTP behavior per use-case.

```bash
# password_reset: 8-char alphanumeric code, 900s TTL (15 min)
curl -sS -X POST http://localhost:3001/otp/generate \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "recipient": "alice@acme.com", "purpose": "password_reset", "deliverVia": "email" }'
```

```json
{ "expiresAt": "2026-06-24T10:20:00.000Z", "cooldownSeconds": 60 }
```

The code delivered to Mailpit is 8 characters (alphanumeric). The OTP panel's segmented box adjusts its
`length` and `type` from the `perPurpose` config.

---

## 6. Template render + XSS guard

**Intent.** The `DefaultTemplateRenderer` HTML-escapes the **html body only** — subject and text are not HTML
contexts.

```bash
curl -sS -X POST http://localhost:3001/email/send-template \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{
    "to": "alice@acme.com",
    "template": "welcome",
    "locale": "en",
    "data": { "name": "<script>alert(1)</script>", "appName": "Demo", "appUrl": "http://localhost:3003" }
  }'
```

In Mailpit, the html body shows `&lt;script&gt;alert(1)&lt;/script&gt;` — escaped. The subject and text
contain the literal string (not HTML contexts, so no escaping is applied).

**From the dashboard.** The **Email preview** tab on the Providers panel (`/providers`) has an "XSS inject"
toggle that sends exactly this payload and shows the four tabs (Rendered / HTML / Text / Metadata).

---

## 7. Locale fallback

**Intent.** Requesting an unregistered locale falls back to `en`; requesting a template that does not exist
returns `TEMPLATE_NOT_FOUND`.

```bash
# pt-BR requested — only en is registered — falls back to en
curl -sS -X POST http://localhost:3001/email/send-template \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "to": "alice@acme.com", "template": "welcome", "locale": "pt-BR", "data": { "name": "Alice", "appName": "Demo", "appUrl": "http://localhost:3003" } }'
```

Returns 200 (en fallback applied). Request a non-existent template name to get `TEMPLATE_NOT_FOUND` (404).

---

## 8. Bring-your-own provider (Resend opt-in)

**Intent.** Setting `RESEND_API_KEY` swaps the email provider from Nodemailer→Mailpit to Resend — no
call-site change.

Add `RESEND_API_KEY=re_…` to `apps/api/.env` and restart the API. The Providers matrix at `/providers` shows
the active provider switching from `nodemailer` to `resend`. All send routes work identically — the provider
contract (`send` / `isConfigured` / `name`) is the same.

**See also.** [PROVIDERS.md](./PROVIDERS.md) — writing a custom `IEmailProvider` from scratch (SendGrid, AWS
SES, Mailgun examples).

---

## 9. Multi-tenant isolation + anti-spoof

**Intent.** The same recipient under different tenants is isolated. A forged `tenantId` in the request body is
overridden by the `tenantIdResolver` in the audit row.

```bash
# OTP for alice under acme
curl -sS -X POST http://localhost:3001/otp/generate \
  -H 'x-tenant-id: acme' \
  -H 'content-type: application/json' \
  -d '{ "recipient": "alice@acme.com", "purpose": "email_verification", "deliverVia": "email" }'

# OTP for the same email under globex — isolated key, different storage slot
curl -sS -X POST http://localhost:3001/otp/generate \
  -H 'x-tenant-id: globex' \
  -H 'content-type: application/json' \
  -d '{ "recipient": "alice@acme.com", "purpose": "email_verification", "deliverVia": "email" }'
```

The two codes are independent — verifying under `acme` does not consume the `globex` code. The storage key is
`sha256("acme:alice@acme.com")` vs `sha256("globex:alice@acme.com")` — different keys, no collision.

**Anti-spoof.** The **Spoof tenant** toggle in the Trigger Center posts a forged `tenantId` in the body to
`/dispatch` alongside the trusted `x-tenant-id: acme` header. The audit row records the resolver tenant
(`acme`), not the body tenant — proving the interceptor never trusts the body.

**See also.** [MULTI_TENANCY.md](./MULTI_TENANCY.md) for the full sha256 key, `maskRecipient`, and
never-log-codes treatment.

---

## 10. Audit fault tolerance

**Intent.** With `swallowErrors: false`, an audit failure returns `AUDIT_LOG_FAILED` (500). The default
(`swallowErrors: true`) never blocks delivery.

The Settings page (`/settings`) documents the configured value. The `swallowErrors:false` variant is
exercised by the **Break audit sink** toggle in the Trigger Center: it calls the isolated module variant
endpoint, which surfaces the error without touching the main delivery path.

---

## 11. Unified dispatch

**Intent.** `NotificationService.dispatch` is the single channel-agnostic façade, audited by the interceptor.
Dispatching produces **two** audit rows: one from the service (`verb: sent/generated/…`, real `providerName`)
and one from the interceptor (`verb: sent/failed`, `providerName: '__interceptor__'`).

```bash
# Email via dispatch
curl -sS -X POST http://localhost:3001/dispatch \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{
    "channel": "email",
    "recipient": "alice@acme.com",
    "payload": { "subject": "Dispatch test", "html": "<p>Via dispatch.</p>", "text": "Via dispatch." }
  }'

# OTP generate via dispatch
curl -sS -X POST http://localhost:3001/dispatch \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{
    "channel": "otp",
    "recipient": "alice@acme.com",
    "payload": { "action": "generate", "purpose": "email_verification", "deliverVia": "email" }
  }'
```

The **source facet** in the Explorer (`providerName === '__interceptor__'`) lets you separate "what the
service did" from "what the HTTP boundary saw".

---

## 12. Roadmap honesty

**Intent.** The `SmsChannelOptions`/`PushChannelOptions` interfaces are declared in the library, but
configuring those channels **throws at startup**. The Roadmap panel surfaces the actual error string, proving
the v0.2 surface is declared but not deliverable today.

```bash
curl -sS -X POST http://localhost:3001/admin/try-configure-sms
curl -sS -X POST http://localhost:3001/admin/try-configure-push
curl -sS -X POST http://localhost:3001/admin/try-configure-async-useclass
```

Each returns the library's real startup-rejection error. The **Roadmap panel** (`/roadmap`) renders these
proofs alongside the v0.2 plan.

---

## 13. Auth email backed by nest-notification (optional)

**Intent.** `@bymax-one/nest-auth` generates and verifies its own auth OTPs; it only delegates sending via
its `IEmailProvider` port. This example wires the `NotificationAuthEmailProvider` adapter so auth emails flow
through the same mailer, template registry, and audit log — one pipeline for everything.

See [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) for the adapter, the `BYMAX_AUTH_EMAIL_PROVIDER` binding,
and the ownership boundary (when to use `nest-auth`'s OTP vs `nest-notification`'s `OtpService`).

The adapter is exercised via the **Auth Demo** endpoint (`POST /auth-demo/send-verification`) wired in
`apps/api/src/auth-demo.controller.ts`. This journey is optional — the example works fully without
`@bymax-one/nest-auth` installed.
