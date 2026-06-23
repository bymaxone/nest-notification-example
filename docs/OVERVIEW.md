# nest-notification-example — Project Overview

> **About this document.** This is the master technical blueprint for **`nest-notification-example`**, the public
> reference application for the **`@bymax-one/nest-notification`** library. It is the authoritative spec an engineer
> or an AI agent reads to build the repository end-to-end. The repository may not yet contain the `apps/` code when
> you read this — the blueprint comes first. The library is **pre-1.0** (`0.1.0`) and **not yet published to npm**, so
> this example consumes it through a local `file:`/`link:` to the sibling `../nest-notification` checkout (see §7).
>
> **Coverage promise.** Every public export of `@bymax-one/nest-notification` (the `.`, `./shared`, and `./react`
> subpaths) is exercised by this repository, and — the part that matters most — **exercisable from the browser**. A
> symbol that is merely imported in a probe file is _not_ considered demonstrated; the [Feature Coverage Matrix](#6-feature-coverage-matrix)
> maps each export to a real, clickable journey in the dashboard. If a feature is documented but not demonstrable in
> the UI, that is a CI-tracked gap, not a finished row.
>
> **Library-API reconciliation.** The facts below are reconciled against the shipped `0.1.0` types, not the prose in
> older drafts. The corrections a reader must respect:
>
> | Symbol / behavior                             | Shipped `0.1.0` truth (authoritative)                                                                                                   | Correction applied                                                                                                                                      |
> | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | Channels implemented                          | **email + OTP only**                                                                                                                    | SMS / Push interfaces ship but configuring those channels **throws at startup** (v0.2).                                                                 |
> | `forRootAsync`                                | **`useFactory` + `inject` + `imports` only** (`useFactory` is typed `(...args: never[]) => …`, so factory params **must be annotated**) | `useClass` / `useExisting` are rejected at startup (`assertUseFactory`); deferred to v0.2.                                                              |
> | Provider/storage **class form** in async mode | `instantiate()` throws for any class with required constructor params                                                                   | the class form works only for **zero-arg** adapters (`NoOpEmailProvider`, `InMemoryOtpStorage`); DI-dependent adapters must be passed as **instances**. |
> | OTP attempt counting                          | **atomic** `storage.consumeAttempt()` (one Redis Lua / single-threaded in-memory)                                                       | a non-atomic `get`+`update` would let `maxAttempts` be bypassed under concurrency.                                                                      |
> | Resend cooldown                               | **atomic** `storage.tryAcquireCooldown()` (`SET NX EX`), released on delivery failure                                                   | a bounced send must not lock the user out.                                                                                                              |
> | `OtpService.verify`                           | **never throws** for bad/missing/exhausted codes — returns a discriminated `OtpVerifyResult`                                            | mapping to HTTP `OTP_*` codes is the **consumer controller's** job. Expiry is reported as `not_found` (the library never emits `OTP_EXPIRED`).          |
> | Error catalog size                            | **22** `NOTIFICATION_ERROR_CODES` keys                                                                                                  | several are catalog-only (declared for consumers / future channels), **not** all thrown by the library — see §6 row 52.                                 |
> | `recipient` normalization                     | the library does **not** normalize                                                                                                      | callers pass `email.trim().toLowerCase()`; `A@x.com` and `a@x.com` are distinct keys.                                                                   |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Architecture at a Glance](#3-architecture-at-a-glance)
4. [Tech Stack](#4-tech-stack)
5. [Repository Layout](#5-repository-layout)
6. [Feature Coverage Matrix](#6-feature-coverage-matrix)
7. [Library Consumption](#7-library-consumption)
8. [Local Stack & Memory-Safe Run](#8-local-stack--memory-safe-run)
9. [Configuration & Environment](#9-configuration--environment)
10. [The Demo Domain & Notification Console](#10-the-demo-domain--notification-console)
11. [The Notification Delivery Pipeline (Deep Dive)](#11-the-notification-delivery-pipeline-deep-dive)
12. [Channels & Providers Showcase](#12-channels--providers-showcase)
13. [Multi-Tenant Security & Recipient Privacy](#13-multi-tenant-security--recipient-privacy)
14. [Ecosystem Fit — Coexistence with `@bymax-one/nest-auth`](#14-ecosystem-fit--coexistence-with-bymax-onenest-auth)
15. [Audit Log & Delivery Tracking](#15-audit-log--delivery-tracking)
16. [Demonstrated Journeys](#16-demonstrated-journeys)
17. [Testing Strategy](#17-testing-strategy)
18. [Deployment Notes](#18-deployment-notes)
19. [Versioning & Release Tracking](#19-versioning--release-tracking)
20. [Contributing](#20-contributing)
21. [License, Attribution & Status](#21-license-attribution--status)

---

## 1. Purpose

`@bymax-one/nest-notification` is the **what**; this repository is the **how**. It is a runnable, production-shaped
demo that exercises **every public export** of the library across a NestJS API and a first-class Next.js notification
console. It is three things at once:

1. **A runnable demo.** `docker compose up` + `pnpm dev` brings up a NestJS service wired to the library and a Next.js
   dashboard that **fires every notification feature on demand** and **shows the result in real time** — the email
   landing in a local inbox, the OTP entered in a segmented input, the delivery row appearing in the audit log.
2. **A knowledge base.** It references every public symbol of the library from real code, and the
   [Feature Coverage Matrix](#6-feature-coverage-matrix) is enforced by a CI export-usage audit. It is the canonical
   place to learn _how_ to wire the library correctly — `forRoot` vs `forRootAsync`, pluggable providers, multi-tenant
   resolution, the atomic OTP contract, the audit interceptor.
3. **A migration guide.** It shows how to replace a hand-rolled email-verification service (a controller reaching
   straight for an ORM to persist codes) with the cohesive `BymaxNotificationModule` — persistence behind
   `IOtpStorage`, transport behind `IEmailProvider`, audit behind `INotificationLogRepository`.

It is a sibling of [`nest-logger-example`](https://github.com/bymaxone/nest-logger-example) and follows the same
blueprint, voice, and quality bar. Where the logger example adds a second `apps/worker` service (to prove cross-service
trace correlation — a thing one service cannot show), this example does **not** need a worker: notification's
headline concerns — multi-channel delivery, the atomic OTP lifecycle, multi-tenant isolation, recipient privacy — are
all demonstrable from a single API plus a tenant switcher in the UI.

---

## 2. Goals & Non-Goals

### Goals

- **Demonstrate every public export** of the `.`, `./shared`, and `./react` subpaths — and make each one **reachable
  from the browser**, not just referenced in code.
- **Mirror production wiring** — `forRootAsync({ useFactory })` reading config from `ConfigService`, a real
  `INotificationLogRepository` over Prisma/Postgres, `RedisOtpStorage` over `ioredis`, a real `IEmailProvider`.
- **Run end-to-end with zero external credentials.** The happy path uses bundled/local adapters — a local SMTP
  catcher (Mailpit) as the email sink, in-memory or local-Redis OTP storage, a Postgres audit log — so a reviewer can
  evaluate the library without signing up for anything. Real providers (Resend) are opt-in via env.
- **Be a first-class notification console** — a Trigger Center that fires every feature, an Explorer over the delivery
  audit log with a live tail, an OTP-verify panel, a provider matrix, an email-preview surface, and an honest roadmap
  panel that proves SMS/Push are declared-but-rejected today.
- **Show both integration paths** — the typed NestJS service injection (`EmailService` / `OtpService` /
  `NotificationService`) **and** the framework-agnostic React hooks (`useOtpInput` / `useOtpCountdown`).
- **Be copy-paste friendly.** Each surface links the exact library API it exercises; snippets are real, typed, and
  lifted from the running code.
- **Stay current.** The example pins the latest stack versions within the library's peer ranges (§4) and reconciles its
  docs against the shipped types, never against stale prose.

### Non-Goals

- **Not a starter template.** It optimizes for _teaching the library_, not for cloning into a product. It carries demo
  endpoints and toggles a real app would not.
- **Not a notification platform.** It is not Novu/Courier/Knock. There is no workflow editor, no in-app inbox product,
  no managed provider store — only what the library actually ships.
- **Not a UI component kit.** The dashboard reuses the shared Bymax design system (§10); it is not a distributable set
  of components.
- **No SMS/Push delivery.** Those channels are v0.2 in the library. This example demonstrates their **declared
  interfaces and their startup-rejection**, honestly — it does not fake delivery.
- **Not a full `@bymax-one/nest-auth` integration.** This example demonstrates `nest-notification` in isolation. The
  **boundary and the recommended composition** with `nest-auth` are documented (§14) and shown by one optional journey,
  but the example does not bundle a complete auth stack — `nest-auth` is an _illustrative_ peer, not a hard dependency.
- **No cross-major back-compat.** It tracks one library minor at a time.

---

## 3. Architecture at a Glance

A single NestJS API hosts the library and a thin demo controller surface (the library ships **no** controllers/DTOs by
design). A Next.js console fires every feature and reads the delivery audit log. Three local backends — a Postgres
audit store, a Redis OTP store, and a Mailpit SMTP inbox — make the happy path tangible without external credentials.

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

`apps/api` and `apps/web` are independently deployable. Multi-tenancy is demonstrated through a **tenant switcher** in
the console that sets a trusted `x-tenant-id` header — resolved by the library's `tenantIdResolver` on the audit
interceptor, and read by the demo controllers on direct routes (§13) — not through a second backend. Full dashboard
design in §10; the delivery pipeline in §11.

---

## 4. Tech Stack

Versions are the **latest stable as of June 2026**, pinned within the library's peer ranges. No newer major exists for
any core framework (NestJS 11, Next.js 16, React 19, Tailwind 4, Prisma 7 are all current generations).

| Layer                    | Technology                                                             | Version                                | Why                                                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Demonstrated library** | `@bymax-one/nest-notification`                                         | `^0.1.0` (pre-publish `file:`/`link:`) | The subject of the demo.                                                                                                                                                                                                                                     |
| Backend framework        | NestJS + Express                                                       | 11 (latest 11.x) / 5                   | The library targets NestJS 11; `NotificationRequest` is Express/Fastify-agnostic.                                                                                                                                                                            |
| Runtime                  | Node.js                                                                | **24 (Active LTS)**                    | Library engine requirement (`>=24`); `node:crypto` only. Node 26 is "Current" but not LTS until Oct 2026 — pin the LTS.                                                                                                                                      |
| Language                 | TypeScript (strict)                                                    | 5.9                                    | `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, zero `any`.                                                                                                                                                                              |
| Audit persistence        | Prisma / PostgreSQL                                                    | **7 (latest)** / **18**                | The example's `INotificationLogRepository`. Prisma 7 is ESM-first — use the `@prisma/adapter-pg` driver adapter and align the API's module format (NestJS 11 runs ESM). PostgreSQL 18 (latest 18.x) is the current stable. The library never imports Prisma. |
| OTP storage              | `ioredis` (Redis)                                                      | ^5 / Redis 7                           | `RedisOtpStorage` (atomic Lua); falls back to `InMemoryOtpStorage` with no Redis.                                                                                                                                                                            |
| Email sink (local)       | Mailpit (SMTP catcher) + `nodemailer`                                  | latest / ^7                            | A **custom `IEmailProvider`** (BYO demo) renders into a browsable local inbox — zero credentials.                                                                                                                                                            |
| Email provider (opt-in)  | Resend                                                                 | ^4                                     | The bundled `ResendEmailProvider`, gated by `RESEND_API_KEY`.                                                                                                                                                                                                |
| Template engines         | bundled `DefaultTemplateRenderer` + Handlebars / MJML / React Email    | ^4 / ^4 / ^1                           | Demonstrates `IEmailTemplateRenderer` swap-ability.                                                                                                                                                                                                          |
| Validation               | Zod (+ `nestjs-zod`)                                                   | 4                                      | Request DTOs + env-schema fail-fast at boot.                                                                                                                                                                                                                 |
| Frontend                 | Next.js (App Router) + React                                           | **16.2.7** / **19**                    | First-class console; isomorphic `./shared` types in the browser.                                                                                                                                                                                             |
| Styling                  | Tailwind CSS + shadcn `new-york` + Geist                               | **4.3**                                | The shared Bymax design system (forced dark, orange glass) — copied verbatim (§10).                                                                                                                                                                          |
| Data/UI libs             | TanStack Query/Table/Virtual · Recharts · nuqs · sonner · lucide-react | current                                | Server-state, virtualized audit table, charts, URL-persisted controls, toasts.                                                                                                                                                                               |
| Real-time                | Server-Sent Events (`@Sse`, `rxjs ^7.8`)                               | —                                      | Live tail of the delivery audit log.                                                                                                                                                                                                                         |
| Package manager          | pnpm                                                                   | **11.x** (latest)                      | Workspaces. The `@bymax-one/*` ecosystem currently standardizes on `10.8`; pnpm 11.x (Node ≥ 22) is the current latest and is adopted here for a fresh repo — see the decision note in §21.                                                                  |
| Tooling                  | Jest 30 (api) · Vitest 4 (web) · Playwright 1.6 · Stryker 9.6          | —                                      | 100% coverage + mutation gate.                                                                                                                                                                                                                               |

---

## 5. Repository Layout

```
nest-notification-example/
├── apps/
│   ├── api/                              # The NestJS service — hosts the library + the demo controller surface
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # NotificationLog (audit) + Tenant + (demo) PendingUser
│   │   │   ├── migrations/
│   │   │   └── seed.ts                   # Demo tenants (acme / globex) + sample templates
│   │   ├── src/
│   │   │   ├── main.ts                   # bootstrap + CORS (x-tenant-id, Retry-After exposed) + shutdown hooks
│   │   │   ├── app.module.ts             # BymaxNotificationModule.forRootAsync({ useFactory }) + APP_INTERCEPTOR
│   │   │   ├── redis/redis.module.ts     # provides the REDIS token → ioredis client OR null (when REDIS_URL unset)
│   │   │   ├── prisma/                    # PrismaModule + PrismaService (the @prisma/adapter-pg client)
│   │   │   ├── notification/
│   │   │   │   ├── notification.config.ts        # Factory: BymaxNotificationModuleOptions from env (the wiring)
│   │   │   │   ├── providers/
│   │   │   │   │   ├── nodemailer-email.provider.ts   # custom IEmailProvider → Mailpit (BYO, zero-cred default)
│   │   │   │   │   └── prisma-notification-log.repository.ts  # INotificationLogRepository over Postgres
│   │   │   │   ├── renderers/            # handlebars / mjml / react-email IEmailTemplateRenderer demos
│   │   │   │   ├── auth-email.provider.ts # OPTIONAL: implements nest-auth's IEmailProvider via EmailService (§14)
│   │   │   │   └── templates.ts          # the registered template registry (otp_code, welcome, …)
│   │   │   ├── otp/                      # POST /otp/{generate,verify,resend,consume} + GET /otp/status
│   │   │   ├── email/                    # POST /email/{send,send-template} + attachment guard demo
│   │   │   ├── dispatch/                 # POST /dispatch (NotificationService façade) + GET /channels
│   │   │   ├── audit/                    # GET /audit/{logs,stream,aggregate} — reads NotificationLog
│   │   │   ├── admin/                    # POST /admin/try-configure-{sms,push,async-useclass} (roadmap rejection)
│   │   │   ├── debug/                    # GET /debug/key (hashTenantRecipient) — dev-only
│   │   │   ├── common/                   # NotificationException → HTTP filter, x-tenant-id guard, Zod pipe
│   │   │   ├── config/                   # Zod env schema (fail-fast)
│   │   │   ├── library-probe.ts          # references otherwise-hard-to-exercise exports (resolved types, tokens)
│   │   │   └── health/                   # GET /health
│   │   ├── test/                         # supertest e2e (in-memory storage, Mailpit/Resend mocked)
│   │   ├── stryker.config.json
│   │   └── package.json
│   │
│   └── web/                              # The Notification Console (full design in docs/DASHBOARD.md)
│       ├── next.config.ts                # transpilePackages: ['@bymax-one/nest-notification'] (§7)
│       ├── app/
│       │   ├── layout.tsx                # Geist + forced dark + Providers + global controls (tenant/role)
│       │   ├── page.tsx                  # Overview — delivery health (send/verify rates, provider mix)
│       │   ├── trigger/page.tsx          # Trigger Center — fire every feature (the Playground)
│       │   ├── explorer/page.tsx         # Audit Explorer — search/filter/live-tail the delivery log
│       │   ├── otp/page.tsx              # OTP-verify panel — useOtpInput + useOtpCountdown end-to-end
│       │   ├── providers/page.tsx        # Provider & template matrix + email preview
│       │   ├── roadmap/page.tsx          # SMS/Push/useClass startup-rejection (honest v0.2 preview)
│       │   └── settings/page.tsx         # channel/provider config status + header-based RBAC roles
│       ├── components/                   # trigger/ explorer/ otp/ providers/ charts/ controls/ ui/
│       ├── lib/                          # api-client, sse, filters (nuqs), error-codes (./shared), severity
│       └── package.json
│
├── docker/
│   ├── postgres/init.sql                 # CREATE DATABASE notification_example;
│   └── mailpit/                          # (image is zero-config; compose adds a :1025/:8025 healthcheck)
├── docs/
│   ├── OVERVIEW.md                       # ← you are here (master technical blueprint)
│   ├── DASHBOARD.md                      # the apps/web console — full build spec + design system
│   ├── DEVELOPMENT_PLAN.md               # phased build plan + quality gates (100% cov, Stryker, audits)
│   ├── design_system.html                # the shared, project-agnostic UI design system (open in a browser)
│   ├── GETTING_STARTED.md                # clone → first email + first verified OTP in ~5 minutes
│   ├── FEATURES.md                       # guided feature tour + the end-to-end journeys
│   ├── ARCHITECTURE.md                   # the delivery pipeline & module boundaries (public vs internal)
│   ├── ENVIRONMENT.md                    # full env-var reference
│   ├── PROVIDERS.md                      # writing & wiring a custom IEmailProvider / IOtpStorage / renderer
│   ├── TEMPLATING.md                     # the renderer contract, canonical templates, i18n fallback, XSS escape
│   ├── MULTI_TENANCY.md                  # sha256 keys, tenantIdResolver, maskRecipient, never-log-codes
│   ├── AUTH_INTEGRATION.md               # how nest-notification composes with @bymax-one/nest-auth (§14)
│   ├── DATABASE.md                       # the NotificationLog schema & querying the audit tier
│   ├── DEPLOYMENT.md                     # production checklist & version pins
│   ├── TROUBLESHOOTING.md                # symptom → cause → fix (incl. the memory-safe run recipe)
│   ├── RELEASES.md                       # which library version each branch tracks
│   ├── tasks/                            # per-phase task files + README (anatomy + status conventions)
│   └── stryker/                          # mutation BASELINE / HISTORY / IMPLEMENTATION_PLAN
│
├── scripts/
│   ├── audit-library-exports.mjs         # CI: every public export referenced in apps/** (else fail)
│   └── audit-error-codes.mjs             # CI: every NOTIFICATION_ERROR_CODES key localized in apps/web
├── docker-compose.yml                    # postgres + redis + mailpit (each with a healthcheck)
├── docker-compose.test.yml               # high-port test stack (postgres :55432, redis :56379)
├── .env.example
├── package.json                          # workspace root
├── pnpm-workspace.yaml                   # packages: ['apps/*']
├── README.md · LICENSE (MIT) · CHANGELOG.md
└── .github/                              # workflows (ci · mutation · mutation-nightly · release) + copilot config
```

> **Improvement over a thin demo.** Like `nest-logger-example`, this repo keeps `apps/api` as the centerpiece and makes
> `apps/web` a **real console** — a Trigger Playground + an Audit Explorer + an OTP-verify surface — not a button list.
> It deliberately **omits the second `apps/worker` service** (cross-service correlation is not a notification headline)
> and the Loki/Tempo/Grafana stack (notification is not observability infra); its "observability" is the **delivery
> audit log** rendered first-class. `apps/web` also demonstrates the isomorphic `./shared` subpath — the error-code
> catalog and purpose/channel unions imported directly in the browser to localize responses and drive selectors.

---

## 6. Feature Coverage Matrix

Every row maps to a public feature/export of `@bymax-one/nest-notification`. Each is exercised in this repository **and**
reachable from the browser (the "Demonstrated in" column names the API surface and the dashboard surface that drives it).

| #   | Library feature                                   | Library surface                                                                                                                                                          | Demonstrated in                                                                                                                                           | Status |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Synchronous registration                          | `BymaxNotificationModule.forRoot(options)`                                                                                                                               | `apps/api/test/forroot-sync.e2e-spec.ts` (isolated module — a global module cannot be re-registered from a live request)                                  | ✅     |
| 2   | Async registration with `ConfigService`           | `forRootAsync({ imports, inject, useFactory })` typed by `BymaxNotificationModuleAsyncOptions` (factory params **annotated** — see §9)                                   | `apps/api/src/app.module.ts` + `notification/notification.config.ts`                                                                                      | ✅     |
| 3   | `forRootAsync` `useClass`/`useExisting` rejection | `assertUseFactory` + `BymaxNotificationModuleOptionsFactory` (declared)                                                                                                  | `admin/` → `POST /admin/try-configure-async-useclass`; web **Roadmap** panel                                                                              | ✅     |
| 4   | Provider/storage as instance **or** class         | `useValue` vs `useClass` resolution (async class form requires a **zero-arg** ctor)                                                                                      | `notification.config.ts` (instances) + `library-probe.ts` (zero-arg class form: `NoOpEmailProvider`/`InMemoryOtpStorage`)                                 | ✅     |
| 5   | Global module + DI tokens                         | `BYMAX_NOTIFICATION_OPTIONS` / `_EMAIL_PROVIDER` / `_OTP_STORAGE` / `_TEMPLATE_RENDERER` / `_LOG_REPOSITORY`                                                             | `library-probe.ts` (token resolution proof)                                                                                                               | ✅     |
| 6   | Fail-fast options validation                      | validation runs **inside** `forRoot`/`forRootAsync` (the `validateOptions` helper is internal, not exported)                                                             | `apps/api/test/options-validation.e2e-spec.ts` (isolated module with invalid options)                                                                     | ✅     |
| 7   | Raw email send                                    | `EmailService.send(EmailSendInput)` → `{ messageId }`                                                                                                                    | `email/` → `POST /email/send`; web **Trigger Center → Send raw email**                                                                                    | ✅     |
| 8   | Template email send                               | `EmailService.sendTemplate(EmailSendTemplateInput)`                                                                                                                      | `POST /email/send-template`; web **Send template** (template dropdown)                                                                                    | ✅     |
| 9   | Channel readiness probe                           | `EmailService.isConfigured()` / `OtpService.isConfigured()`                                                                                                              | `GET /channels`; web **Settings** status badges                                                                                                           | ✅     |
| 10  | Bring-your-own email provider                     | `IEmailProvider` (`send`/`isConfigured`/`name`)                                                                                                                          | `providers/nodemailer-email.provider.ts` (→ Mailpit)                                                                                                      | ✅     |
| 11  | Bundled Resend provider                           | `ResendEmailProvider({ apiKey })`                                                                                                                                        | `notification.config.ts` (opt-in via `RESEND_API_KEY`); web **Providers** matrix                                                                          | ✅     |
| 12  | No-op dev provider                                | `NoOpEmailProvider`                                                                                                                                                      | `notification.config.ts` (fallback when no SMTP/Resend)                                                                                                   | ✅     |
| 13  | Attachment size guard                             | `maxAttachmentBytes` → `EMAIL_ATTACHMENTS_TOO_LARGE` (413)                                                                                                               | `POST /email/send` (oversize); web **Trigger Center → oversize attachment**                                                                               | ✅     |
| 14  | Email envelope defaults                           | `defaultFrom`/`defaultFromName`/`defaultReplyTo`/`defaultTags` + `cc`/`bcc`/`tags`                                                                                       | `email/` send form; preview shows resolved envelope                                                                                                       | ✅     |
| 15  | Default template renderer (XSS-safe)              | `DefaultTemplateRenderer` (`{{var}}`, HTML-escapes **html body only**)                                                                                                   | `providers/page.tsx` **Email preview**: inject `<script>` → escaped html, raw subject/text                                                                | ✅     |
| 16  | Template locale fallback                          | renderer locale resolution → `en` fallback; `TEMPLATE_NOT_FOUND`                                                                                                         | **Send template** with `locale:'pt-BR'` when only `en` registered                                                                                         | ✅     |
| 17  | Canonical template names                          | `CANONICAL_EMAIL_TEMPLATES` (10)                                                                                                                                         | `templates.ts` registry; web template dropdown                                                                                                            | ✅     |
| 18  | Pluggable renderer (Handlebars/MJML/React Email)  | `IEmailTemplateRenderer` (`render`/`hasTemplate`/`name`)                                                                                                                 | `renderers/*`; web **Providers** renderer switch                                                                                                          | ✅     |
| 19  | Renderer options                                  | `onMissingVar` (`empty`/`throw`), `enableNestedPaths`                                                                                                                    | preview toggles for missing-var + `{{user.name}}` nested path                                                                                             | ✅     |
| 20  | OTP generate + email delivery                     | `OtpService.generate({ deliverVia:'email' })` → `{ expiresAt, cooldownSeconds }`                                                                                         | `POST /otp/generate`; web **OTP panel** starts `useOtpCountdown({ expiresAt })`                                                                           | ✅     |
| 21  | OTP generate (manual delivery)                    | `OtpService.generate({ deliverVia:'manual' })`                                                                                                                           | `POST /otp/generate` manual toggle (code not returned)                                                                                                    | ✅     |
| 22  | OTP verify (atomic + constant-time)               | `OtpService.verify` → `consumeAttempt` + `safeCompare`; returns `OtpVerifyResult` (never throws)                                                                         | `POST /otp/verify`; web OTP box `onComplete` → verify                                                                                                     | ✅     |
| 23  | OTP resend (cooldown)                             | `OtpService.resend` → `{ expiresAt, cooldownSeconds }`                                                                                                                   | `POST /otp/resend`; web **Resend** (disabled until countdown low)                                                                                         | ✅     |
| 24  | OTP consume (invalidate)                          | `OtpService.consume`                                                                                                                                                     | `POST /otp/consume`; web **Cancel code**                                                                                                                  | ✅     |
| 25  | OTP status (never leaks code)                     | `OtpService.getStatus` → `OtpStatusResult`                                                                                                                               | `GET /otp/status`; web **Inspect OTP** panel                                                                                                              | ✅     |
| 26  | Code charset                                      | `defaultCodeType` `numeric`/`alpha`/`alphanumeric` + `generateOtpCode`                                                                                                   | per-purpose config drives OTP box `type`/`length`                                                                                                         | ✅     |
| 27  | OTP TTL / expiry                                  | `defaultTtlSeconds`                                                                                                                                                      | countdown via `useOtpCountdown({ expiresAt })`                                                                                                            | ✅     |
| 28  | Max-attempts lockout (atomic)                     | `defaultMaxAttempts` → `reason:'max_attempts'`                                                                                                                           | wrong code ×N → decreasing `remainingAttempts` → 429                                                                                                      | ✅     |
| 29  | Resend cooldown (atomic `SET NX EX`)              | `resendCooldownSeconds` → `OTP_COOLDOWN_ACTIVE` (429)                                                                                                                    | **Spam generate** → 429 with `details.remainingSeconds`                                                                                                   | ✅     |
| 30  | Per-purpose overrides                             | `perPurpose` / `resolveForPurpose`                                                                                                                                       | `password_reset` (len 8, alphanumeric, 900s) vs default                                                                                                   | ✅     |
| 31  | Consume-on-verify policy                          | `consumeOnVerify` (resolved once at boot)                                                                                                                                | Settings shows the configured value; toggling needs a second module variant (§10)                                                                         | ✅     |
| 32  | Canonical purposes                                | `NOTIFICATION_PURPOSES` (5) / `OtpPurpose`                                                                                                                               | purpose dropdown sourced from the const                                                                                                                   | ✅     |
| 33  | OTP email auto-injection                          | `{ code, expiresInMinutes, purpose }` merged into render data                                                                                                            | `otp_code` template renders the injected code                                                                                                             | ✅     |
| 34  | Bring-your-own OTP storage                        | `IOtpStorage` (**9 methods** + `name`; `consumeAttempt`/`tryAcquireCooldown` atomic)                                                                                     | documented in `PROVIDERS.md`; `InMemoryOtpStorage` is the reference                                                                                       | ✅     |
| 35  | In-memory storage (dev)                           | `InMemoryOtpStorage` (+ `clear`/`size`)                                                                                                                                  | default storage; e2e suites                                                                                                                               | ✅     |
| 36  | Redis storage (prod, atomic)                      | `RedisOtpStorage({ redisClient })`                                                                                                                                       | `notification.config.ts` (opt-in via `REDIS_URL`)                                                                                                         | ✅     |
| 37  | SHA-256 storage keys                              | `hashTenantRecipient(tenantId, recipient)`                                                                                                                               | `GET /debug/key`; web **Inspect OTP → storage key** (no PII)                                                                                              | ✅     |
| 38  | Crypto utils                                      | `generateOtpCode` / `safeCompare`                                                                                                                                        | exercised transitively + `library-probe.ts`                                                                                                               | ✅     |
| 39  | Unified dispatch (email)                          | `NotificationService.dispatch({ channel:'email' })`; `EMAIL_MISSING_BODY`                                                                                                | `POST /dispatch`; web **Unified dispatch** tab                                                                                                            | ✅     |
| 40  | Unified dispatch (otp)                            | `NotificationService.dispatch({ channel:'otp', payload:{ action } })`                                                                                                    | `POST /dispatch` action select                                                                                                                            | ✅     |
| 41  | Enabled-channel introspection                     | `NotificationService.getEnabledChannels()`                                                                                                                               | `GET /channels`; web channel badges (proves no sms/push)                                                                                                  | ✅     |
| 42  | Disabled-channel guard                            | `getEmail()`/`getOtp()` → `CHANNEL_DISABLED` (501)                                                                                                                       | a channel-off config variant surfaces 501                                                                                                                 | ✅     |
| 43  | Tenant anti-spoofing                              | `tenantIdResolver(NotificationRequest)` overrides payload tenant **on the interceptor**                                                                                  | **Spoof tenant** toggle on `/dispatch` → audit shows resolver tenant, not forged                                                                          | ✅     |
| 44  | Multi-tenant isolation                            | `sha256(tenantId:recipient)` keying                                                                                                                                      | **Tenant switcher**; same recipient under acme vs globex is isolated                                                                                      | ✅     |
| 45  | Recipient masking                                 | `audit.maskRecipient`                                                                                                                                                    | audit table shows `j***@acme.com`; toggle to compare                                                                                                      | ✅     |
| 46  | Never-log-codes invariant                         | audit entry never contains `code` (regression test)                                                                                                                      | **Explorer** detail asserts no code substring; surfaced as a green check                                                                                  | ✅     |
| 47  | Audit repository (Prisma)                         | `INotificationLogRepository.create(NotificationLogEntry)`                                                                                                                | `providers/prisma-notification-log.repository.ts`; **Explorer**                                                                                           | ✅     |
| 48  | No-op audit sink (default)                        | `NoOpNotificationLogRepository`                                                                                                                                          | used when `audit` unconfigured (Settings variant)                                                                                                         | ✅     |
| 49  | Audit interceptor (opt-in)                        | `NotificationAuditInterceptor` on `/dispatch` (emits `sent`/`failed`, `providerName:'__interceptor__'`)                                                                  | `app.module.ts` `APP_INTERCEPTOR`; see §15 dual-source note                                                                                               | ✅     |
| 50  | Audit fault policy                                | `swallowErrors` true/false → `AUDIT_LOG_FAILED` (500)                                                                                                                    | **Break audit sink** toggle (module variant)                                                                                                              | ✅     |
| 51  | Audit entry shape & verbs                         | `NotificationLogEntry` / `NotificationLogVerb` (`generated`/`sent`/`verified`/`failed`/`cooldown_blocked`/`max_attempts_exceeded`)                                       | Explorer columns + detail drawer                                                                                                                          | ✅     |
| 52  | Error catalog + exception (**22 codes**)          | `NotificationException` + `NOTIFICATION_ERROR_DEFINITIONS` + `NOTIFICATION_ERROR_CODES` + types `NotificationErrorKey`/`NotificationErrorDefinition`                     | `common/` HTTP filter (codes the library throws); `audit-error-codes.mjs` (every code **localized** in the UI). See the note below on catalog-only codes. | ✅     |
| 53  | Error response envelope (shared)                  | `NotificationErrorResponse` (`./shared`)                                                                                                                                 | web imports `./shared` to localize each `error.code`                                                                                                      | ✅     |
| 54  | Cooldown presentation helpers                     | `toRetryAfterHeader` / `cooldownExpiresAt` / `formatCooldown`                                                                                                            | API sets `Retry-After` on 429; web renders `formatCooldown` countdown                                                                                     | ✅     |
| 55  | OTP input hook                                    | `useOtpInput` → `{ values, setValue, onChange, onKeyDown, onPaste, refs, reset, code, isComplete }`; options `length`/`type`/`onComplete`/`autoSubmit`/`sanitizeOnPaste` | `otp/page.tsx` segmented 6-cell box (Settings exposes `autoSubmit`/`sanitizeOnPaste`)                                                                     | ✅     |
| 56  | OTP countdown hook                                | `useOtpCountdown({ expiresAt, tickIntervalMs?, onExpired? })` → `{ remainingSeconds, expired, formatted }` (`MM:SS`/`HH:MM:SS`)                                          | expiry pill + resend gating                                                                                                                               | ✅     |
| 57  | Isomorphic shared constants/types                 | `OtpPurpose` / `NotificationChannel` / `DEFAULT_TTLS` (`./shared`)                                                                                                       | purpose/channel selectors + "expires in N min" hints                                                                                                      | ✅     |
| 58a | SMS channel rejection (roadmap)                   | `SmsChannelOptions` / `ISmsProvider` declared → configuring `sms` **throws at startup**                                                                                  | `POST /admin/try-configure-sms`; web **Roadmap** panel surfaces the error                                                                                 | ✅     |
| 58b | Push channel rejection (roadmap)                  | `PushChannelOptions` / `IPushProvider` declared → configuring `push` **throws at startup**                                                                               | `POST /admin/try-configure-push`; web **Roadmap** panel                                                                                                   | ✅     |
| 58c | Declared-only v0.2 surface                        | `BYMAX_NOTIFICATION_SMS_PROVIDER`/`_PUSH_PROVIDER` tokens, `SMS_*`/`PUSH_*` codes, `'sms'`/`'push'` union                                                                | `library-probe.ts` references (audit-satisfying, labeled v0.2)                                                                                            | ✅     |
| 59  | Resolved-options types (advanced)                 | `ResolvedNotificationOptions` / `ResolvedGlobalOptions` / `ResolvedEmailOptions` / `ResolvedOtpOptions` / `ResolvedAuditOptions`                                         | `library-probe.ts` (typed read of injected options)                                                                                                       | ✅     |
| 60  | Real-time delivery feed                           | audit rows over SSE                                                                                                                                                      | `audit/` `GET /audit/stream` (`@Sse`) + **Explorer** live tail                                                                                            | ✅     |
| 61  | Delivery health charts                            | aggregation over `channel`/`verb`/`provider`                                                                                                                             | **Overview** (send/verify/failure rates, provider mix) ← `GET /audit/aggregate`                                                                           | ✅     |

> **On the 22-code catalog (row 52).** `NOTIFICATION_ERROR_CODES` has **22** keys, but they fall into two groups, and
> the CI gate respects the difference:
>
> - **Library-thrown** (surfaced via the HTTP filter on a real request): `EMAIL_PROVIDER_NOT_CONFIGURED`,
>   `EMAIL_SEND_FAILED`, `EMAIL_ATTACHMENTS_TOO_LARGE`, `EMAIL_MISSING_BODY`, `TEMPLATE_NOT_FOUND`,
>   `TEMPLATE_RENDER_FAILED`, `OTP_STORAGE_NOT_CONFIGURED`, `OTP_EMAIL_DELIVERY_NOT_CONFIGURED`, `OTP_COOLDOWN_ACTIVE`,
>   `OTP_INVALID_LENGTH`, `AUDIT_LOG_FAILED`, `CHANNEL_DISABLED`.
> - **Catalog-only / consumer-mapped** (the library never throws these — the controller maps them, or they are reserved
>   for future channels): `EMAIL_INVALID_RECIPIENT`; the four `verify` reasons the controller raises
>   (`OTP_NOT_FOUND`, `OTP_MAX_ATTEMPTS_EXCEEDED`, `OTP_INVALID_CODE`, and `OTP_EXPIRED` — which the library **never
>   emits**, since expiry is reported as `not_found`); and the five v0.2 `SMS_*`/`PUSH_*` codes.
>   `scripts/audit-error-codes.mjs` asserts every one of the 22 is **localized** in the `./shared`-driven UI strings
>   (achievable for all), not that every one is triggerable from a journey; catalog-only codes are allow-listed with a
>   reason, exactly as `.audit-ignore.json` allow-lists unreferenced exports.

> **Dashboard surfaces (rows 55–61)** are the tip of `apps/web`. Its full feature set — Trigger Center (fire every
> feature), Audit Explorer (facets, virtualized table, detail drawer, live tail), the OTP-verify panel, the provider &
> template matrix with email preview, the roadmap rejection panel, and the multi-tenant/RBAC controls — is specified in
> [`docs/DASHBOARD.md`](DASHBOARD.md), grounded in how Novu/Knock/Courier/Resend build these surfaces (§16 references).

> **Coverage rule.** Every public export from `@bymax-one/nest-notification` (the `.`, `./shared`, and `./react`
> subpaths) is referenced from at least one file in this repository. The CI step `scripts/audit-library-exports.mjs`
> (run via `pnpm audit:exports`) parses the shipped declarations at `dist/server/index.d.ts`,
> `dist/shared/index.d.ts`, and `dist/react/index.d.ts`, extracts every exported symbol, and word-boundary-searches the
> `apps/**` corpus, failing the build if any export is unused. Genuinely-internal symbols that leak into the published
> `.d.ts` may be allow-listed in `.audit-ignore.json` with a reason — never to silence a demonstrable export. The matrix
> above is reconciled against that script.

---

## 7. Library Consumption

`@bymax-one/nest-notification` is consumed as a normal dependency. **It is not yet published to npm**, so today the
example consumes it through a **local link** to the sibling checkout; once the library publishes, the example pins a
semver range and records the exact tested version per commit (§19).

### Current consumption — local link (pre-publish)

Each app's `package.json` declares the library as a `file:`/`link:` to the sibling repo:

```jsonc
// apps/api/package.json
{
  "dependencies": {
    "@bymax-one/nest-notification": "file:../../../nest-notification",
    // from apps/api/, the sibling lib is three levels up
  },
}
```

The library's `dist/` must be **built first** — it ships `"dependencies": {}` and resolves both types and runtime via
its `exports` map (the `.`, `./shared`, `./react` subpaths). Build it once and keep it watching so `dist/` stays fresh:

```bash
# 1) build the library once and keep it watching:
cd ../nest-notification && pnpm install && pnpm build   # or: pnpm build --watch (tsup, dual ESM+CJS)

# 2) in this repository, install (resolves the link:) and run:
cd ../nest-notification-example && pnpm install && pnpm dev
```

> **Prefer `file:` over `link:`.** Both resolve identically, but `file:` is friendlier to the memory-safety recipe in
> §8 (a `link:` symlink can pull a much larger sibling tree into every test worker's module graph).

### Consuming the `./react` + `./shared` subpaths in Next.js

`apps/web` imports the browser subpaths. Because the library is an ESM `file:` dependency, the Next.js config must
transpile it and the workspace must keep a **single React instance** (a duplicated React triggers an "invalid hook
call" from `useOtpInput`):

```ts
// apps/web/next.config.ts
export default { transpilePackages: ['@bymax-one/nest-notification'] }
```

React is deduplicated via pnpm (`public-hoist-pattern[]=*react*` or a workspace `resolutions`/single-version policy).
"`next build` resolves `./react` and `./shared`" is an exit criterion of the web phase.

### Peer dependencies the **app** installs

The library declares everything as **peer dependencies** (NestJS, `reflect-metadata`, `rxjs`, plus the optional
provider/storage/renderer SDKs marked `optional`). The consumer app installs the peers for the channels it uses:

```jsonc
// apps/api — required peers + the optional ones this example lights up
{
  "@nestjs/common": "^11",
  "@nestjs/core": "^11",
  "reflect-metadata": "^0.2",
  "rxjs": "^7.8",
  "ioredis": "^5", // RedisOtpStorage (opt-in)
  "resend": "^4", // ResendEmailProvider (opt-in)
  "nodemailer": "^7", // the example's custom IEmailProvider → Mailpit
  "handlebars": "^4",
  "mjml": "^4",
  "@react-email/render": "^1", // alternate renderers
}
```

### After the library publishes

Switch the `file:` reference to a pinned semver range and drop the link:

```bash
pnpm add @bymax-one/nest-notification@^0.1.0 --filter @nest-notification-example/api
```

`main` then pins the published range and `docs/RELEASES.md` records the exact tested version per branch.

A dedicated `apps/api/src/library-probe.ts` (+ `.spec.ts`) references the otherwise-hard-to-exercise exports — the
resolved-options types, the SMS/Push tokens and v0.2 surface, the zero-arg class-form provider resolution — purely to
satisfy the export-usage audit. Symbols that can be driven from the UI are demonstrated there, not in the probe; the
probe is the floor, not the ceiling.

---

## 8. Local Stack & Memory-Safe Run

### Local backends (Docker Compose)

The happy path runs with **zero external credentials**. Three local containers make delivery tangible, each with a
healthcheck so `pnpm infra:up` only returns when the stack is ready:

| Service    | Image             | Host port              | Purpose                                                                                                                      | Healthcheck                |
| ---------- | ----------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| PostgreSQL | `postgres:18`     | `5432`                 | The `NotificationLog` audit store (`PrismaNotificationLogRepository`).                                                       | `pg_isready`               |
| Redis      | `redis:7`         | `6379`                 | `RedisOtpStorage` (atomic Lua). Optional — absent ⇒ `InMemoryOtpStorage`.                                                    | `redis-cli ping`           |
| Mailpit    | `axllent/mailpit` | SMTP `1025`, UI `8025` | A local SMTP inbox; the custom `IEmailProvider` sends here, so every rendered email is browsable at `http://localhost:8025`. | TCP `:1025` / HTTP `:8025` |

`apps/api` listens on **`3001`**, `apps/web` on **`3003`** (both bound to `127.0.0.1`). The test stack
(`docker-compose.test.yml`) uses deliberately high ports — Postgres `55432`, Redis `56379` — so it never contends with
the running dev stack. If Mailpit is down, a `send` surfaces `EMAIL_SEND_FAILED` (502) — itself a demonstrable error path.

### Memory-safe run recipe (read before `pnpm dev`)

> **This is a first-class operational constraint, not a footnote.** It is copied into `docs/TROUBLESHOOTING.md`.

**The hazard.** A root `pnpm dev` fans out parallel watchers (`nest start --watch` + `next dev`) with **uncapped Node
heaps**; on a RAM-constrained machine the cumulative pressure thrashes swap and can freeze the OS. Separately, because
the library is consumed via `file:`/`link:`, it is **reloaded into the module graph of every Jest worker and every
Vitest fork** — so running multiple test suites in parallel (or fanning test runs across parallel agents) multiplies
memory by `workers × runners × agents` and has OOM'd a 36 GB machine past 70 GB into swap.

**The recipe.**

1. **Infra first:** `pnpm infra:up` (Postgres/Redis/Mailpit healthy) — otherwise `apps/api` exits on the Prisma connect
   and the crash masks the real issue.
2. **Cap every heap:** the `dev` scripts set `NODE_OPTIONS=--max-old-space-size=2048` (api) / `4096` (web). A
   `.claude/launch.json` defines capped, fixed-port entries.
3. **Prefer build-once over watch** when diagnosing: `pnpm -r build`, then run `node apps/api/dist/main.js` and
   `next start` — measured at a fraction of the watch footprint. Or start **one service at a time** in its own terminal.
4. **Tests run sequentially, in the main process, one package at a time**, with a bounded pool —
   `pnpm --filter <pkg> exec jest --maxWorkers=2` / `vitest run --maxWorkers=2`, guarded by a heap cap. The caps are
   **baked into the configs** (Jest `maxWorkers: '50%'`, Vitest `test.maxWorkers: '50%'`) so CI and future runs inherit
   the protection. Root recursive scripts serialize with `pnpm -r --workspace-concurrency=1`.
5. **Never** fan out parallel `Agent`/`Workflow` runs that each execute a test suite, and never let both apps' suites
   run at once.

Static gates (`tsc --noEmit`, `eslint .`, `prettier`) are one process each — safe to run normally.

---

## 9. Configuration & Environment

Every variable is `UPPER_SNAKE_CASE`, browser-exposed ones are `NEXT_PUBLIC_`, and the API validates its environment
with **Zod at boot** (a missing/invalid var aborts startup with a precise message). The root `.env.example` documents
each variable; `docs/ENVIRONMENT.md` carries the full reference table.

| Variable                                                  | Service | Default (dev)                                                | Used for                                             |
| --------------------------------------------------------- | ------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| `PORT`                                                    | api     | `3001`                                                       | `app.listen`                                         |
| `DATABASE_URL`                                            | api     | `postgresql://…@localhost:5432/notification_example`         | Prisma audit store                                   |
| `REDIS_URL`                                               | api     | _(unset ⇒ in-memory OTP)_                                    | `RedisOtpStorage` when present                       |
| `SMTP_URL`                                                | api     | `smtp://localhost:1025`                                      | the custom Nodemailer→Mailpit provider               |
| `RESEND_API_KEY`                                          | api     | _(unset ⇒ Nodemailer/NoOp)_                                  | switches the email provider to `ResendEmailProvider` |
| `MAIL_FROM` / `MAIL_FROM_NAME`                            | api     | `no-reply@notification.local` / `Bymax Notification Example` | `defaultFrom` / `defaultFromName`                    |
| `DEFAULT_LOCALE`                                          | api     | `en`                                                         | template locale fallback                             |
| `OTP_DEFAULT_TTL_SECONDS` / `OTP_RESEND_COOLDOWN_SECONDS` | api     | `600` / `60`                                                 | OTP defaults (overridable per-purpose)               |
| `AUDIT_MASK_RECIPIENT`                                    | api     | `true`                                                       | toggles `maskRecipient` for the demo                 |
| `WEB_ORIGIN`                                              | api     | `http://localhost:3003`                                      | CORS allow-origin (+ exposes `Retry-After`)          |
| `NEXT_PUBLIC_API_URL`                                     | web     | `http://localhost:3001`                                      | the console's API base                               |

### Canonical wiring

The single source of truth for how the library is configured is `apps/api/src/notification/notification.config.ts` — a
factory returning `BymaxNotificationModuleOptions` from the validated env, wired into `forRootAsync`. Note that
`useFactory` is typed `(...args: never[]) => …`, so its parameters **must be annotated**; `REDIS` is a `Symbol` token
whose factory returns an `ioredis` client **or `null`** (when `REDIS_URL` is unset), and `RedisModule` / `PrismaModule`
are imported so they resolve:

```typescript
// apps/api/src/app.module.ts (shape)
import type { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'

BymaxNotificationModule.forRootAsync({
  imports: [ConfigModule, RedisModule, PrismaModule],
  inject: [ConfigService, REDIS, PrismaService],
  useFactory: (config: ConfigService, redis: Redis | null, prisma: PrismaService) => ({
    global: {
      redisNamespace: 'notification', // the lib appends ':' → keys are 'notification:…'; isolated from nest-auth's 'auth:' namespace (§14)
      defaultLocale: config.get('DEFAULT_LOCALE', 'en'),
      // Trust the tenant from a gateway-verified header — never the request body.
      tenantIdResolver: (req) => {
        const h = req.headers['x-tenant-id']
        return Array.isArray(h) ? (h[0] ?? 'default') : (h ?? 'default')
      },
    },
    email: {
      provider: resolveEmailProvider(config), // Resend | Nodemailer→Mailpit | NoOp
      defaultFrom: config.getOrThrow('MAIL_FROM'),
      defaultFromName: config.get('MAIL_FROM_NAME'),
      templateRenderer: new DefaultTemplateRenderer({ templates: TEMPLATES }),
      maxAttachmentBytes: 10 * 1024 * 1024,
    },
    otp: {
      storage: redis ? new RedisOtpStorage({ redisClient: redis }) : new InMemoryOtpStorage(),
      defaultLength: 6,
      defaultTtlSeconds: config.get('OTP_DEFAULT_TTL_SECONDS', 600),
      resendCooldownSeconds: config.get('OTP_RESEND_COOLDOWN_SECONDS', 60),
      perPurpose: {
        password_reset: { length: 8, codeType: 'alphanumeric', ttlSeconds: 900 },
        email_verification: { ttlSeconds: 3600 },
      },
    },
    audit: {
      repository: new PrismaNotificationLogRepository(prisma), // pass an INSTANCE (DI-dependent ctor)
      swallowErrors: true,
      maskRecipient: maybeMask(config), // jane@acme.com → j***@acme.com
    },
  }),
})
// + { provide: APP_INTERCEPTOR, useClass: NotificationAuditInterceptor }
```

`RedisModule` (`apps/api/src/redis/redis.module.ts`) exports the `REDIS` token; `PrismaModule` provides `PrismaService`
(the `@prisma/adapter-pg` client). The `redis ? … : new InMemoryOtpStorage()` branch depends on the token resolving to
**`null`**, not throwing, when `REDIS_URL` is unset.

---

## 10. The Demo Domain & Notification Console

The library ships **no controllers and no DTOs** — that is the consumer's job. `apps/api` authors a thin, honest
controller surface (Zod-validated) over the services; `apps/web` is the console that drives it. The endpoint surface:

| Route                                                 | Library call                             | Purpose                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `POST /otp/generate`                                  | `OtpService.generate`                    | issue an OTP (email or manual delivery) → `{ expiresAt, cooldownSeconds }`                                      |
| `POST /otp/verify`                                    | `OtpService.verify`                      | the **controller** maps `OtpVerifyResult` → HTTP (200; `invalid_code`→401; `not_found`→404; `max_attempts`→429) |
| `POST /otp/resend`                                    | `OtpService.resend`                      | resend under cooldown (429 + `Retry-After` when active)                                                         |
| `POST /otp/consume`                                   | `OtpService.consume`                     | invalidate a code                                                                                               |
| `GET /otp/status`                                     | `OtpService.getStatus`                   | inspect state (never the code)                                                                                  |
| `POST /email/send`                                    | `EmailService.send`                      | raw email (subject + html)                                                                                      |
| `POST /email/send-template`                           | `EmailService.sendTemplate`              | rendered template email                                                                                         |
| `POST /dispatch`                                      | `NotificationService.dispatch`           | unified channel-agnostic façade (audited by the interceptor)                                                    |
| `GET /channels`                                       | `NotificationService.getEnabledChannels` | which channels are live                                                                                         |
| `GET /audit/logs` · `GET /audit/stream`               | reads `NotificationLog`                  | keyset list + SSE live tail                                                                                     |
| `GET /audit/aggregate`                                | reads `NotificationLog`                  | delivery-health charts                                                                                          |
| `POST /admin/try-configure-{sms,push,async-useclass}` | isolated `forRoot`/`forRootAsync`        | proves the startup rejections                                                                                   |
| `GET /debug/key`                                      | `hashTenantRecipient`                    | shows the `sha256(tenantId:recipient)` key (dev-only)                                                           |

The OTP **verify mapping lives in the controller** — the library's `verify` returns a discriminated `OtpVerifyResult`
and never throws for a wrong/missing/exhausted code. `not_found` is mapped to **404** (the library deliberately makes
expiry indistinguishable from "never existed", so 404 is the honest choice over 410).

### The console (`apps/web`)

Seven left-nav destinations, all under the **shared Bymax design system** (forced dark, orange glass, Geist + mono —
§4) and persisted in the URL via `nuqs` so every view is a shareable deep-link. **Global controls** (top bar): a
**tenant switcher** (sets the trusted `x-tenant-id`), a **role switcher** (Viewer/Operator/Admin RBAC demo), and a
**live toggle** for the SSE tail.

| Route        | Page                      | Job                                                                                                                                                                                                                                                                                                   |
| ------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`          | **Overview**              | Delivery health — send/verify/failure rates, latency-to-sent, provider mix, channel badges.                                                                                                                                                                                                           |
| `/trigger`   | **Trigger Center**        | The Playground — fire every feature (send email, generate+verify OTP, trip cooldown, force max-attempts, oversize attachment, break audit sink, spoof tenant, dispatch), each auto-pivoting the Explorer to the resulting row.                                                                        |
| `/explorer`  | **Audit Explorer**        | Search/filter the delivery log (by tenant/channel/verb/recipient/purpose + a **source** facet, §15), virtualized table, detail drawer (Overview / Raw entry / **never-contains-code proof**), and a **live tail** over SSE.                                                                           |
| `/otp`       | **OTP Verify**            | The end-to-end OTP UX — `useOtpInput` segmented 6-cell box (paste, auto-advance, backspace nav) + `useOtpCountdown` expiry pill + cooldown-gated resend; surfaces `remainingAttempts` and every `OTP_*` error localized from `./shared`.                                                              |
| `/providers` | **Providers & Templates** | The provider matrix (email provider + storage + renderer, each with health/active state) and an **email preview** (Rendered / HTML / Text / Metadata tabs) proving the HTML-escape-html-body-only behavior.                                                                                           |
| `/roadmap`   | **Roadmap**               | Honest v0.2 preview — clicking "Enable SMS" / "Enable Push" / "Use useClass" surfaces the library's **actual startup-rejection error string**, proving the interfaces exist but the channels are rejected.                                                                                            |
| `/settings`  | **Settings**              | Channel/provider config status and the RBAC roles. Note: `consumeOnVerify` and `swallowErrors` are resolved **once at boot** (frozen options), so the Settings page **shows the configured value**; flipping them at runtime is demonstrated by booting a second module variant, not a live mutation. |

> The full information architecture, the panel/chart catalog, the backing-API table, the SSE follow-mode UX, and the
> notification-domain rendering of every design-system primitive (the OTP box, the countdown pill, the provider matrix,
> the email preview, the audit table, the tenant switcher) live in [`docs/DASHBOARD.md`](DASHBOARD.md).

---

## 11. The Notification Delivery Pipeline (Deep Dive)

A send flows through four stages; the example surfaces each so it can be inspected in the UI.

```
  request ──▶ [1] resolve ──▶ [2] render ──▶ [3] deliver ──▶ [4] audit
             tenantId         template via    provider.send    INotificationLog
             (trusted header) IEmailTemplate   (Mailpit/Resend)  .create (masked,
                              Renderer (escape) or OTP storage    never the code)
                                                 (atomic Lua)
```

Key design facts the example proves:

- **Stage 1 — Resolve.** The `tenantId` always comes from a **trusted source**, never the request body. On the
  audited `/dispatch` route, the `NotificationAuditInterceptor` calls the `tenantIdResolver` and uses its result as the
  **source of truth** for the audited tenant — a `tenantId` forged in the body is overridden. On the **direct** routes
  (`/otp/*`, `/email/*`), the service methods take an explicit `tenantId`, so the controller derives it from the trusted
  `x-tenant-id` header itself (the resolver is not auto-applied to non-intercepted handlers). The "Spoof tenant" demo
  therefore exercises `/dispatch`.
- **Stage 2 — Render.** `EmailService.sendTemplate` resolves the requested locale → `en` fallback, renders via the
  configured `IEmailTemplateRenderer`, and **HTML-escapes the html body only** (subject and text are not HTML contexts)
  — closing a stored-XSS vector. The OTP path auto-injects `{ code, expiresInMinutes, purpose }` into the render data.
- **Stage 3 — Deliver.** Email goes through the provider (`send` throws → mapped to `EMAIL_SEND_FAILED`). OTP goes
  through the storage, where `consumeAttempt` (verify) and `tryAcquireCooldown` (generate/resend) are **atomic** — a
  Redis Lua script or single-threaded in-memory read-modify-write — so `maxAttempts` cannot be brute-forced and two
  concurrent generates cannot both pass the cooldown. On a delivery failure the cooldown is **released** so a bounced
  email never locks the user out.
- **Stage 4 — Audit.** A fire-and-forget `INotificationLogRepository.create` records the verb with the **masked**
  recipient and **never the code**. With `swallowErrors: true` (default) an audit failure cannot crash the delivery path.

Module boundaries: the library's public surface is the dynamic module, the three services, the interceptor, the
interface contracts, the reference adapters, the error catalog, and the React hooks. Everything else (config
resolution internals, the crypto helpers' implementation, the Redis Lua source) is internal — the example depends only
on the public surface.

---

## 12. Channels & Providers Showcase

Every external boundary is an interface; the example wires a real adapter for each and documents how to bring your own.

| Boundary           | Contract                                   | Bundled reference                          | This example wires                                                             | Bring-your-own examples                     |
| ------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------- |
| Email transport    | `IEmailProvider`                           | `ResendEmailProvider`, `NoOpEmailProvider` | a **custom Nodemailer→Mailpit** provider (zero-cred default) + Resend (opt-in) | SendGrid, AWS SES, Mailgun (`PROVIDERS.md`) |
| OTP storage        | `IOtpStorage` (atomic; 9 methods + `name`) | `RedisOtpStorage`, `InMemoryOtpStorage`    | Redis (opt-in) or in-memory                                                    | DynamoDB, any KV (`PROVIDERS.md`)           |
| Template rendering | `IEmailTemplateRenderer`                   | `DefaultTemplateRenderer`                  | Default + **Handlebars / MJML / React Email** demos                            | any engine (`TEMPLATING.md`)                |
| Audit sink         | `INotificationLogRepository`               | `NoOpNotificationLogRepository`            | **Prisma/Postgres**                                                            | Mongo, ClickHouse, BigQuery (`DATABASE.md`) |

The custom Nodemailer provider is the headline "bring-your-own-provider" lesson: a ~30-line class implementing
`send`/`isConfigured`/`name` that the module wires with zero changes to any call site — and it makes the demo's emails
**actually appear** in a browsable inbox. Writing a provider/storage/renderer is documented end-to-end in
`docs/PROVIDERS.md` and `docs/TEMPLATING.md`, including the **atomicity requirements** on `consumeAttempt` and
`tryAcquireCooldown` (the one place a naive implementation introduces a security bug). In **async** mode a provider
passed as a _class_ must have a zero-arg constructor; DI-dependent adapters (`PrismaNotificationLogRepository`,
`RedisOtpStorage`) are passed as instances.

---

## 13. Multi-Tenant Security & Recipient Privacy

The library is multi-tenant by design; the example makes each mechanism visible and testable.

- **SHA-256 storage keys.** OTP entries and cooldowns are keyed by `sha256(tenantId:recipient)` — never the plaintext
  recipient. The **Inspect OTP** panel calls `GET /debug/key` to show the opaque 64-hex key, proving an operator with
  Redis access cannot enumerate which emails have a pending OTP, and that two tenants sharing a recipient never collide.
- **`tenantIdResolver` anti-spoofing.** The resolver is consulted by the **audit interceptor** (the audited tenant is
  resolver-derived, not body-derived). The **Spoof tenant** toggle posts a forged `payload.tenantId` to `/dispatch`
  alongside a trusted `x-tenant-id` header; the audit row shows the resolver tenant. On the direct `/otp/*` and
  `/email/*` routes the controller is responsible for deriving the trusted `tenantId` before calling the service — the
  resolver does not silently override a method argument.
- **Recipient masking.** `audit.maskRecipient` minimizes the recipient before it is persisted (`jane@acme.com` →
  `j***@acme.com`); a Settings toggle compares masked vs raw.
- **Never-log-codes invariant.** A regression test asserts `JSON.stringify(auditEntry).includes(code) === false`, and
  the Explorer detail drawer renders that proof as a green check — the code lives only in the TTL-bound store and in
  process memory, never in the audit log, a logger line, or an `errorMessage` (which carries the message only, never a
  stack trace). `getStatus` never returns the code.

Full treatment in `docs/MULTI_TENANCY.md`.

---

## 14. Ecosystem Fit — Coexistence with `@bymax-one/nest-auth`

In a real Bymax product, this library runs **alongside [`@bymax-one/nest-auth`](https://github.com/bymaxone/nest-auth)**
(the full-stack auth library). A fair question is: _nest-auth also has OTP — do the two conflict?_ **No.** They operate
at different layers with clear ownership, and they share Redis safely. This section is the authoritative boundary; a
deeper walkthrough lives in `docs/AUTH_INTEGRATION.md`.

### How `nest-auth` works (one-paragraph summary)

`@bymax-one/nest-auth` (published, `v1.x`) is a full-stack authentication/authorization library for NestJS 11 + React
19 + Next.js 16: JWT access/refresh with rotation, sessions + JTI blacklist, **MFA via TOTP** (authenticator app +
recovery codes), OAuth (Google + plugins), RBAC with role hierarchy, brute-force protection, password reset, email
verification, and tenant invitations — multi-tenant + platform-admin ready. All crypto is `node:crypto` only. It has
its **own** `OtpService` (numeric codes for email verification + password reset, Redis-stored, timing-normalized) and a
**purpose-specific email port** `IEmailProvider` with methods like `sendEmailVerificationOtp(email, otp, locale)`,
`sendPasswordResetOtp`, `sendPasswordResetToken`, `sendMfaEnabled/DisabledNotification`, `sendNewSessionAlert`, and
`sendInvitation`. **nest-auth never imports a mailer** — the consumer implements that port.

### Why there is no conflict

| Concern                                                                                                                | `@bymax-one/nest-auth` owns                               | `@bymax-one/nest-notification` owns                         |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| **Auth OTP** (login email verification, password reset)                                                                | ✅ generates + verifies its own codes, tied to user state | ✗ (do not duplicate for the same purpose)                   |
| **MFA / TOTP** (authenticator app, recovery codes)                                                                     | ✅                                                        | ✗ (out of scope — TOTP ≠ delivered OTP)                     |
| **Email delivery / rendering / templates**                                                                             | ✗ delegates via its `IEmailProvider` port                 | ✅ the single mailer + template registry + audit log        |
| **General/transactional OTP** (step-up for a sensitive action, phone verification, non-login confirmation, magic-link) | ✗                                                         | ✅ `OtpService` with pluggable storage + per-purpose config |
| **App transactional emails** (welcome, receipts, alerts)                                                               | ✗                                                         | ✅ `EmailService`                                           |

Three concrete reasons they don't collide:

1. **Different ownership of the OTP lifecycle.** `nest-auth` **generates and verifies its own** auth OTPs internally; it
   only delegates the **sending** of the resulting code. You do **not** route auth-OTP generation through
   `nest-notification`. Conversely, `nest-notification`'s `OtpService` serves OTP needs that are **not** auth concerns.
   The only real "conflict" would be running _both_ libraries' OTP for the _same_ purpose (two codes for one email
   verification) — that is an integration choice to avoid, not a technical clash. **Rule of thumb:** if it's a login /
   email-verification / password-reset / MFA concern → `nest-auth`; anything else → `nest-notification`.
2. **Isolated Redis namespaces.** `nest-auth` prefixes every key with its `redisNamespace` (default `auth:` → e.g.
   `auth:rt:…` refresh tokens, `auth:sess:…` sessions, `auth:jti…` blacklist, `auth:bf:…` brute-force, `auth:otp:…`,
   `auth:mfa:…`); `nest-notification` uses its own `redisNamespace` (default `notification:` → `notification:otp:…`,
   `notification:otp_cd:…`) plus `sha256(tenantId:recipient)` keys. On a shared Redis instance the keyspaces never
   overlap — no collision, no cross-read. (Both are configurable; just keep them distinct.)
3. **One email path, not two.** Implement `nest-auth`'s `IEmailProvider` by **delegating to
   `nest-notification`'s `EmailService`**. The whole app then has a single mailer, a single template registry, and a
   single delivery **audit log** — including the auth emails. `nest-auth` hands your adapter the already-generated
   code/token; your adapter renders + sends + audits it through this example's pipeline:

```typescript
// apps/api/src/notification/auth-email.provider.ts (OPTIONAL integration adapter)
import type {
  IEmailProvider as IAuthEmailProvider,
  SessionInfo,
  InviteData,
} from '@bymax-one/nest-auth'
import { EmailService } from '@bymax-one/nest-notification'

@Injectable()
export class NotificationAuthEmailProvider implements IAuthEmailProvider {
  constructor(
    private readonly email: EmailService,
    private readonly tenants: TenantContext,
  ) {}

  // nest-auth generates the OTP; we only render + send + audit it via nest-notification.
  async sendEmailVerificationOtp(to: string, otp: string, locale = 'en'): Promise<void> {
    await this.email.sendTemplate({
      tenantId: this.tenants.current(),
      to,
      template: 'otp_code',
      locale,
      data: { code: otp, purpose: 'email_verification', appName: 'Bymax' },
    })
  }
  async sendPasswordResetOtp(to: string, otp: string, locale = 'en'): Promise<void> {
    /* template: 'otp_password_reset' */
  }
  async sendMfaEnabledNotification(to: string, locale = 'en'): Promise<void> {
    /* template: 'mfa_enabled' */
  }
  async sendMfaDisabledNotification(to: string, locale = 'en'): Promise<void> {
    /* template: 'mfa_disabled' */
  }
  async sendNewSessionAlert(to: string, info: SessionInfo, locale = 'en'): Promise<void> {
    /* template: 'new_login_alert' */
  }
  async sendInvitation(to: string, invite: InviteData, locale = 'en'): Promise<void> {
    /* template: 'welcome'/'invitation' */
  }
  async sendPasswordResetToken(to: string, token: string, locale = 'en'): Promise<void> {
    /* link email */
  }
}
// bound in nest-auth via: { provide: BYMAX_AUTH_EMAIL_PROVIDER, useClass: NotificationAuthEmailProvider }
```

> **Why this is elegant.** The library's `CANONICAL_EMAIL_TEMPLATES` already include `otp_code`,
> `otp_password_reset`, `mfa_enabled`, `mfa_disabled`, and `new_login_alert` — the exact auth events `nest-auth` emits.
> The adapter is a thin mapping; the heavy lifting (rendering, HTML-escaping, masking, auditing) is `nest-notification`'s.

This example demonstrates the seam with one optional journey (§16, journey 13) but does not bundle a full auth stack —
`nest-auth` is an illustrative peer here, so the example stays focused on `nest-notification`.

---

## 15. Audit Log & Delivery Tracking

Where the logger example correlates logs to traces, the notification example's observability is its **delivery audit
log** — a first-class, queryable record of every notification event.

- **The store.** `apps/api` implements `INotificationLogRepository` over Prisma/Postgres
  (`PrismaNotificationLogRepository`) against a `NotificationLog` table indexed for keyset pagination and
  tenant/channel/verb filtering (schema in `docs/DATABASE.md`). The library never imports Prisma.
- **Two audit sources (by design).** Rows arrive from **two** places, and the Explorer distinguishes them with a
  **source facet**: (a) the **services** emit lifecycle verbs (`generated`/`verified`/`failed`/`cooldown_blocked`/
  `max_attempts_exceeded`) with the real `providerName`; (b) the opt-in `NotificationAuditInterceptor` emits a
  `sent`/`failed` row per intercepted `/dispatch` call with `providerName: '__interceptor__'`. A dispatched OTP-generate
  therefore writes **both** a service `generated` row and an interceptor `sent` row — the facet
  (`providerName === '__interceptor__'`) lets a reader separate "what the service did" from "what the HTTP boundary saw".
- **The read API.**
  - `GET /audit/logs?cursor&tenantId&channel&verb&recipient&purpose&limit` → `{ data: NotificationLog[], nextCursor, hasMore }`, **keyset** pagination (cursor = the last row's monotonic id; a stale/foreign cursor → 410).
  - `GET /audit/stream` → `@Sse` `Observable<MessageEvent>`; each event's `id` is the row's keyset cursor, so a reconnect resumes from `Last-Event-ID`.
  - `GET /audit/aggregate?from&to&tenantId` → time-bucketed counts by `verb`/`channel`/`provider` for the Overview charts (send/verify/failure rates, provider mix).
- **The UI.** The Audit Explorer renders the table with a follow-mode live tail (pinned-to-bottom auto-scroll; scroll-up
  pauses with an "N new — jump to latest" pill), a faceted filter bar, and a detail drawer that includes the
  no-code-present proof.

---

## 16. Demonstrated Journeys

`docs/FEATURES.md` expands each of these into a curl + JSON + teaching-point walkthrough. The numbered journeys:

1. **First email in 60 seconds** — `POST /email/send` → the rendered message lands in Mailpit (`:8025`); the audit row
   appears in the Explorer live tail.
2. **Register + verify OTP** — `generate({ deliverVia:'email' })` → `{ expiresAt, cooldownSeconds }`; the code arrives
   in Mailpit → the OTP box (`useOtpInput`) auto-advances, the countdown (`useOtpCountdown`) ticks, `verify` succeeds,
   `consume` invalidates.
3. **Wrong code, then lockout** — three wrong codes show decreasing `remainingAttempts`, the fourth returns
   `max_attempts` (429) — proving the atomic attempt counter.
4. **Resend cooldown** — a second `generate` inside the window returns `OTP_COOLDOWN_ACTIVE` (429) with a `Retry-After`
   header; the UI renders `formatCooldown(remaining)` and disables resend until it clears.
5. **Per-purpose config** — switching to `password_reset` changes the code to 8-char alphanumeric with a 15-minute TTL
   (900s), driving the OTP box's `type`/`length`.
6. **Template render + XSS guard** — send a template whose variable is `<script>…`; the preview shows the html body
   escaped while subject/text stay raw.
7. **Locale fallback** — request `pt-BR` when only `en` is registered → the renderer falls back to `en`;
   `TEMPLATE_NOT_FOUND` when neither exists.
8. **Bring-your-own provider** — swap the email provider from Nodemailer→Mailpit to Resend by setting `RESEND_API_KEY`,
   with no call-site change.
9. **Multi-tenant isolation + anti-spoof** — the same recipient under `acme` and `globex` are isolated; a forged
   `tenantId` on `/dispatch` is overridden by the resolver in the audit row.
10. **Audit fault tolerance** — boot the `swallowErrors:false` module variant and break the audit sink → the request
    returns `AUDIT_LOG_FAILED` (500); the default variant never blocks delivery on audit failures.
11. **Unified dispatch** — drive email and OTP through the single `NotificationService.dispatch` façade, including the
    `EMAIL_MISSING_BODY` and `CHANNEL_DISABLED` error paths, and observe the dual audit rows (service + interceptor).
12. **Roadmap honesty** — "Enable SMS / Push / useClass" surfaces the library's real startup-rejection error, proving
    the v0.2 surface is declared but not deliverable today.
13. **Auth email backed by `nest-notification` (optional, §14)** — a password-reset OTP generated by `@bymax-one/nest-auth`
    is rendered, sent (to Mailpit), and audited through this example's pipeline via the `NotificationAuthEmailProvider`
    adapter — one mailer, one audit log, no OTP duplication.

---

## 17. Testing Strategy

| Layer    | Tool                          | Scope                                                                                                                                                                                                  |
| -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API unit | Jest 30 (ts-jest, native ESM) | every service-consuming controller, the config factory, the custom provider/repository, the error filter                                                                                               |
| API e2e  | Jest + supertest              | the full HTTP surface against `InMemoryOtpStorage` + a mocked transport (no Mailpit/Resend needed); the startup-rejection isolated-module tests                                                        |
| Web unit | Vitest 4 (jsdom, v8)          | every `lib/**` + `components/**` file; the OTP box, countdown pill, audit table, error-code localization                                                                                               |
| Web e2e  | Playwright 1.6                | the live journeys (generate → Mailpit → verify) against a running stack                                                                                                                                |
| Mutation | Stryker 9.6                   | configured **api `break: 100`, web `break: 95`** (`lib/**` 100); the **mandatory floor is ≥ 95** on both, driven toward 100; survivors documented as equivalents (the library itself runs `break: 95`) |

The quality floor is **100% coverage** (all four metrics) in both workspaces, with non-executable glue (`*.module.ts`,
`main.ts`, `*.dto.ts`, `*.d.ts`) stripped from the coverage scope so the number stays meaningful. The
`maxWorkers: '50%'` caps from §8 are baked into the Jest/Vitest configs. A sample assertion style: every `it()` carries
a block comment naming the scenario and the rule it protects (e.g. _"verify returns invalid_code with remainingAttempts
— protects the atomic attempt counter from off-by-one"_).

CI gates (`.github/workflows/ci.yml`): `lint` · `typecheck` · `unit` (coverage) · `e2e` · `export-usage-check`
(`audit:exports` + `audit:error-codes`). Mutation runs incrementally per-PR (`mutation.yml`) and fully on a weekly
schedule (`mutation-nightly.yml`). The library is built first so the `file:` link resolves; a placeholder `DATABASE_URL`
lets `prisma generate` run without a database.

---

## 18. Deployment Notes

The example is shipped as two container images (`apps/api/Dockerfile`, `apps/web/Dockerfile`, multi-stage, built from
the repo root) via `release.yml` on a `v*` tag, pushed to GHCR with OIDC. A production checklist:

- Point `DATABASE_URL` at a managed Postgres; set `REDIS_URL` to a managed Redis (so OTP storage is durable and atomic
  across instances).
- Set `RESEND_API_KEY` (or wire your own `IEmailProvider`) and a verified `MAIL_FROM` domain; the Mailpit path is
  dev-only.
- Drive `tenantIdResolver` from a **gateway-verified** source (a JWT claim or a gateway-checked header), never the
  request body; ensure the direct controllers read the same trusted source.
- Keep `audit.swallowErrors: true` in production so an audit outage cannot break delivery; ship `maskRecipient`.
- Enable `app.enableShutdownHooks()` so in-flight work drains on `SIGTERM`.
- Set `WEB_ORIGIN` to your `https://` console origin; the API exposes `Retry-After` for the cooldown UX.
- If running alongside `nest-auth`, confirm the two Redis namespaces differ (`notification:` vs `auth:`) and that a
  single `IEmailProvider` adapter (§14) is the only mailer.

---

## 19. Versioning & Release Tracking

The example tracks **one library minor at a time**. `docs/RELEASES.md` records which version each branch tracks.

| Branch | Tracks library version                                 | Notes                                                                                                          |
| ------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `main` | `@bymax-one/nest-notification` `local link` → `^0.1.0` | pre-publish today via `file:`; pins the semver range once the library ships.                                   |
| `next` | upcoming minor                                         | tracks v0.2 (SMS + Push) when the library implements those channels — the roadmap panel becomes real delivery. |

When the library publishes, the release job records the exact tested version per commit, and the roadmap panel's
rejection demos are replaced by live SMS/Push journeys.

---

## 20. Contributing

The bar for any change is: **does this make the library clearer to learn or more completely demonstrated?** Concretely:

- A new library feature ⇒ a new Feature Coverage Matrix row **and** a browser-reachable way to exercise it (a Trigger
  Center card or a dedicated panel) — not just a probe reference.
- Code is exemplary: TypeScript strict (no `any`), Clean Code sizing (functions ≤ 50 lines, files ≤ 800), explicit DI,
  SRP/SOLID, English-only comments/identifiers/commits, Conventional Commits.
- All gates green before a PR: `pnpm typecheck && pnpm lint && pnpm test:cov && pnpm audit:exports`.

---

## 21. License, Attribution & Status

- **License.** MIT © Bymax One. `@bymax-one/nest-notification` is MIT © Bymax One.
- **Status.** 📝 Specification draft — `docs/` only (this blueprint + the shared design system). No `apps/` code yet.
  The sibling `docs/*.md` (DASHBOARD, DEVELOPMENT_PLAN, GETTING_STARTED, FEATURES, …) and the README badge header are
  authored in the documentation phase of the build.
- **Document version.** OVERVIEW `1.1.0`, reconciled against library `0.1.0` and audited (lib-coverage +
  pattern-conformance + architecture + TS-contracts) on the date of writing.

### Decisions taken (for maintainer review)

- **No `apps/worker`, no Loki/Tempo/Grafana.** Cross-service correlation is not a notification headline; the "observability"
  surface is the delivery audit log. Multi-tenancy is a UI tenant switcher, not a second backend.
- **Mailpit + a custom Nodemailer `IEmailProvider`** is the zero-credential default email path (real emails land in a
  browsable inbox); Resend is opt-in via env. This also doubles as the headline "bring-your-own-provider" lesson.
- **`@bymax-one/nest-auth` is an illustrative peer, not a hard dependency** (§14): the boundary + adapter are documented
  and shown by one optional journey, keeping the example focused on `nest-notification`.
- **pnpm 11.x (latest) vs the ecosystem's 10.8 pin** — adopted 11.x for a fresh repo; if monorepo lockfile consistency
  with the sibling `@bymax-one/*` repos is preferred, align to `10.8` instead. (Either is compatible with the `file:`
  link; this is the one version choice that is policy, not a hard requirement.)

### Suggested build order (for the implementer)

The companion `docs/DEVELOPMENT_PLAN.md` breaks this blueprint into phases. The recommended order:

1. **Repo foundation** — pnpm workspace, tooling (ESLint/Prettier/commitlint/husky), the shared design-system files,
   the CI skeleton.
2. **Local stack** — `docker-compose.yml` (Postgres + Redis + Mailpit, each healthchecked) + infra scripts.
3. **Library consumption** — `file:` link the sibling lib; install peers; the subpath probe; web `transpilePackages`.
4. **API skeleton** — NestJS bootstrap, Zod env schema, `/health`, the `NotificationException` HTTP filter,
   `RedisModule` (REDIS token → client | null) + `PrismaModule` (`@prisma/adapter-pg`).
5. **Notification wiring + audit store** — `forRootAsync` + `notification.config.ts` + the custom Nodemailer provider +
   the `NotificationLog` Prisma schema/migration + the `PrismaNotificationLogRepository` (write side) + the
   `NotificationAuditInterceptor` + the template registry.
6. **OTP + Email controllers** — the full `/otp/*`, `/email/*`, `/dispatch`, `/channels`, `/debug/key` surface.
7. **Audit read-API** — `/audit/logs` (keyset) + `/audit/stream` (SSE) + `/audit/aggregate` over the table from step 5.
8. **Roadmap rejection** — the `/admin/try-configure-*` isolated-module endpoints.
9. **Web skeleton** — Next.js 16 + the copied design system + the app shell + global controls.
10. **Console core** — Overview, Trigger Center, Audit Explorer (+ live tail with the source facet).
11. **OTP + Providers panels** — the `useOtpInput`/`useOtpCountdown` surface, the provider/template matrix + email
    preview, the roadmap panel, settings.
12. **Optional auth seam** — the `NotificationAuthEmailProvider` adapter + journey 13 (§14).
13. **Testing** — 100% coverage (Jest + Vitest), then the Stryker mutation gate.
14. **Documentation & CI/CD** — every `docs/*.md`, the export/error-code audits, the release workflow, and the
    `v0.1.0` audit-hardening pass.

---

_End of the master blueprint for `nest-notification-example`._
