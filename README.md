<h1 align="center">nest-notification-example</h1>

<p align="center">
  The canonical reference application for <a href="https://github.com/bymaxone/nest-notification"><code>@bymax-one/nest-notification</code></a> —
  multi-channel email + atomic OTP, multi-tenant and provider-pluggable, wired the way a real NestJS app would, with a first-class Next.js notification console.
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-notification-example/actions/workflows/ci.yml"><img alt="ci" src="https://github.com/bymaxone/nest-notification-example/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="coverage" src="https://img.shields.io/badge/coverage-100%25-brightgreen" />
  <img alt="mutation" src="https://img.shields.io/badge/mutation-%E2%89%A595-brightgreen" />
  <img alt="library" src="https://img.shields.io/badge/%40bymax--one%2Fnest--notification-%5E0.1.0-6E56CF" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green" />
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-strict-3178C6" />
  <img alt="node" src="https://img.shields.io/badge/Node-%3E%3D24-339933" />
  <img alt="nestjs" src="https://img.shields.io/badge/NestJS-11-E0234E" />
  <img alt="next" src="https://img.shields.io/badge/Next.js-16-000000" />
  <img alt="react" src="https://img.shields.io/badge/React-19-61DAFB" />
  <img alt="tailwind" src="https://img.shields.io/badge/Tailwind-4-06B6D4" />
  <img alt="prisma" src="https://img.shields.io/badge/Prisma-7-2D3748" />
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-notification">📦 Library</a> ·
  <a href="#-quick-start">🚀 Quick start</a> ·
  <a href="#-architecture">🏗️ Architecture</a> ·
  <a href="#-documentation">📖 Documentation</a> ·
  <a href="docs/OVERVIEW.md">📐 Overview</a>
</p>

---

## ✨ Overview

`@bymax-one/nest-notification` is the **what**; this repository is the **how**. It is a runnable,
production-shaped demo that exercises **every public export** of the library across a NestJS API and a
first-class Next.js notification console. It is three things at once:

- **A runnable demo.** `pnpm infra:up` + `pnpm dev` brings up a NestJS service wired to the library and a
  Next.js console that fires every notification feature on demand and shows the result in real time — the
  email landing in a local inbox, the OTP entered in a segmented input, the delivery row appearing in the
  audit log.
- **A knowledge base.** Every public symbol is referenced from real code, and the
  [Feature Coverage Matrix](docs/OVERVIEW.md#6-feature-coverage-matrix) is enforced by a CI export-usage
  audit — the canonical place to learn how to wire `forRoot` vs `forRootAsync`, pluggable providers,
  multi-tenant resolution, the atomic OTP contract, and the audit interceptor.
- **A migration guide.** It shows how to replace a hand-rolled email-verification service with the cohesive
  `BymaxNotificationModule` — persistence behind `IOtpStorage`, transport behind `IEmailProvider`, audit
  behind `INotificationLogRepository`.

It is a sibling of [`nest-logger-example`](https://github.com/bymaxone/nest-logger-example) and follows
the same blueprint, voice, and quality bar — **100% test coverage**, a **Stryker mutation gate (≥ 95)**,
English-only, and Conventional Commits.

---

## 🚀 Quick start

```bash
git clone https://github.com/bymaxone/nest-notification-example.git
cd nest-notification-example

# 1) build the sibling library once (consumed pre-publish via a local file: link)
cd ../nest-notification && pnpm install && pnpm build --watch
# keep that terminal running, then in a new terminal:

# 2) install workspace deps (resolves the file: link)
cd ../nest-notification-example
pnpm install

# 3) bring up Postgres + Redis + Mailpit
pnpm infra:up

# 4) create the API env file, apply the schema migration, seed demo tenants
cp .env.example apps/api/.env
pnpm --filter @nest-notification-example/api db:migrate
pnpm --filter @nest-notification-example/api db:seed

# 5) start both apps
pnpm dev
```

| Surface               | URL                             |
| --------------------- | ------------------------------- |
| Console (`apps/web`)  | <http://localhost:3003>         |
| API health            | <http://localhost:3001/health>  |
| Mailpit inbox         | <http://localhost:8025>         |

The library is **pre-publish** — consumed via a local `file:` link to the sibling `../nest-notification`
checkout until it ships to npm. The local happy path needs **zero external credentials**: emails land in a
browsable Mailpit inbox, OTP storage falls back to in-memory, and the audit log is local Postgres.

See **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** for the full walkthrough, including your first
email and first verified OTP.

---

## 🏗️ Architecture

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

`apps/api` and `apps/web` are independently deployable. Multi-tenancy is demonstrated through a **tenant
switcher** in the console that sets a trusted `x-tenant-id` header. Full pipeline in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## ✅ What's inside

- **OTP lifecycle** — generate (email or manual delivery), verify (atomic + constant-time), resend
  (cooldown-gated), consume, status. Per-purpose config (`password_reset`: 8-char alphanumeric, 900s TTL).
- **Email delivery** — raw send, template send (10 canonical templates), locale fallback, XSS-safe renderer.
- **Unified dispatch** — `NotificationService.dispatch` as a channel-agnostic façade, audited by the interceptor.
- **Pluggable providers** — BYO `IEmailProvider` (Nodemailer→Mailpit as the worked example), `IEmailProvider`
  with Resend (opt-in), `IOtpStorage` with Redis (opt-in) or in-memory.
- **Pluggable renderers** — `DefaultTemplateRenderer`, Handlebars, MJML, React Email demos.
- **Multi-tenant isolation** — `sha256(tenantId:recipient)` keys, `tenantIdResolver` anti-spoofing,
  `maskRecipient`, and the never-log-codes regression test.
- **Audit log + live tail** — `PrismaNotificationLogRepository`, keyset list, SSE stream, aggregate charts.
- **React hooks** — `useOtpInput` (segmented 6-cell box) + `useOtpCountdown` (expiry pill), end-to-end in
  the OTP panel.
- **Roadmap honesty** — SMS/Push declared-but-rejected-at-startup; the Roadmap panel surfaces the real error.
- **Optional auth seam** — `NotificationAuthEmailProvider` bridges `@bymax-one/nest-auth`'s port.

---

## 📖 Documentation

| Doc                                                  | What it covers                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| [GETTING_STARTED](docs/GETTING_STARTED.md)           | Clone → first email in Mailpit + first verified OTP in ~5 minutes      |
| [FEATURES](docs/FEATURES.md)                         | Guided feature tour + all 13 end-to-end journeys                       |
| [ARCHITECTURE](docs/ARCHITECTURE.md)                 | Four-stage delivery pipeline, `forRootAsync` wiring, module boundaries |
| [DATABASE](docs/DATABASE.md)                         | `NotificationLog` schema, keyset pagination, masked-recipient store    |
| [DASHBOARD](docs/DASHBOARD.md)                       | Console information architecture, SSE live tail, design system         |
| [ENVIRONMENT](docs/ENVIRONMENT.md)                   | Full env-var reference + production guards                             |
| [PROVIDERS](docs/PROVIDERS.md)                       | BYO `IEmailProvider` / `IOtpStorage` guide + provider matrix           |
| [TEMPLATING](docs/TEMPLATING.md)                     | `IEmailTemplateRenderer` contract, canonical templates, XSS guard      |
| [MULTI_TENANCY](docs/MULTI_TENANCY.md)               | `sha256` keys, `tenantIdResolver`, `maskRecipient`, never-log-codes    |
| [AUTH_INTEGRATION](docs/AUTH_INTEGRATION.md)         | Composing with `@bymax-one/nest-auth`: boundary, namespace isolation   |
| [DEPLOYMENT](docs/DEPLOYMENT.md)                     | Production checklist, GHCR images, version pins                        |
| [TROUBLESHOOTING](docs/TROUBLESHOOTING.md)           | Symptom → cause → fix (incl. the memory-safe run recipe)               |
| [RELEASES](docs/RELEASES.md)                         | Which library version each branch tracks                               |
| [OVERVIEW](docs/OVERVIEW.md)                         | Master product blueprint (21 sections, 61-row Feature Coverage Matrix) |
| [DEVELOPMENT_PLAN](docs/DEVELOPMENT_PLAN.md)         | Phased build plan, quality gates, CI matrix, Appendix E go-public      |

---

## License

MIT © Bymax One. `@bymax-one/nest-notification` is MIT © Bymax One. See [LICENSE](LICENSE).
