<p align="center">
  <img src="https://img.shields.io/badge/%40bymax--one-nest--notification--example-000000?style=for-the-badge&logo=nestjs&logoColor=E0234E" alt="nest-notification-example" />
</p>

<h1 align="center">nest-notification-example</h1>

<p align="center">
  <strong>Reference application for <a href="https://github.com/bymaxone/nest-notification"><code>@bymax-one/nest-notification</code></a></strong><br />
  <sub>NestJS 11 · Next.js 16 · React 19 · Prisma 7 · PostgreSQL 18 · Redis 7 · Multi-tenant email + atomic OTP</sub>
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-notification-example/actions/workflows/ci.yml"><img src="https://github.com/bymaxone/nest-notification-example/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square" alt="coverage 100%" />
  <img src="https://img.shields.io/badge/mutation-api%20100%20%C2%B7%20web%20%E2%89%A595-brightgreen?style=flat-square" alt="mutation api 100 / web ≥95" />
  <img src="https://img.shields.io/badge/lib-%40bymax--one%2Fnest--notification%20%5E0.1.0-6E56CF?style=flat-square" alt="library" />
  <a href="https://github.com/bymaxone/nest-notification-example/blob/main/LICENSE"><img src="https://img.shields.io/github/license/bymaxone/nest-notification-example?style=flat-square&colorA=000000&colorB=000000" alt="license" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript strict" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-24%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 24+" /></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS 11" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma 7" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 4" /></a>
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-notification">📦 Library</a> ·
  <a href="#-quick-start">🚀 Quick Start</a> ·
  <a href="#-whats-inside">✅ Features</a> ·
  <a href="#-architecture">🏗️ Architecture</a> ·
  <a href="docs/OVERVIEW.md">📖 Docs</a>
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

It is a sibling of [`nest-logger-example`](https://github.com/bymaxone/nest-logger-example) and
[`nest-auth-example`](https://github.com/bymaxone/nest-auth-example) and follows the same blueprint, voice,
and quality bar — **100% test coverage**, a **Stryker mutation gate (api 100 · web ≥ 95)**, English-only,
and Conventional Commits.

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

| Surface              | URL                            |
| -------------------- | ------------------------------ |
| Console (`apps/web`) | <http://localhost:3003>        |
| API health           | <http://localhost:3001/health> |
| Mailpit inbox        | <http://localhost:8025>        |

The library is **pre-publish** — consumed via a local `file:` link to the sibling `../nest-notification`
checkout until it ships to npm. The local happy path needs **zero external credentials**: emails land in a
browsable Mailpit inbox, OTP storage falls back to in-memory, and the audit log is local Postgres.

See **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** for the full walkthrough, including your first
email and first verified OTP.

---

## 🔥 What's inside

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

## 📖 Documentation

| Doc                                          | What it covers                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| [GETTING_STARTED](docs/GETTING_STARTED.md)   | Clone → first email in Mailpit + first verified OTP in ~5 minutes      |
| [FEATURES](docs/FEATURES.md)                 | Guided feature tour + all 13 end-to-end journeys                       |
| [ARCHITECTURE](docs/ARCHITECTURE.md)         | Four-stage delivery pipeline, `forRootAsync` wiring, module boundaries |
| [DATABASE](docs/DATABASE.md)                 | `NotificationLog` schema, keyset pagination, masked-recipient store    |
| [DASHBOARD](docs/DASHBOARD.md)               | Console information architecture, SSE live tail, design system         |
| [ENVIRONMENT](docs/ENVIRONMENT.md)           | Full env-var reference + production guards                             |
| [PROVIDERS](docs/PROVIDERS.md)               | BYO `IEmailProvider` / `IOtpStorage` guide + provider matrix           |
| [TEMPLATING](docs/TEMPLATING.md)             | `IEmailTemplateRenderer` contract, canonical templates, XSS guard      |
| [MULTI_TENANCY](docs/MULTI_TENANCY.md)       | `sha256` keys, `tenantIdResolver`, `maskRecipient`, never-log-codes    |
| [AUTH_INTEGRATION](docs/AUTH_INTEGRATION.md) | Composing with `@bymax-one/nest-auth`: boundary, namespace isolation   |
| [DEPLOYMENT](docs/DEPLOYMENT.md)             | Production checklist, GHCR images, version pins                        |
| [TROUBLESHOOTING](docs/TROUBLESHOOTING.md)   | Symptom → cause → fix (incl. the memory-safe run recipe)               |
| [RELEASES](docs/RELEASES.md)                 | Which library version each branch tracks                               |
| [OVERVIEW](docs/OVERVIEW.md)                 | Master product blueprint (21 sections, 61-row Feature Coverage Matrix) |
| [DEVELOPMENT_PLAN](docs/DEVELOPMENT_PLAN.md) | Phased build plan, quality gates, CI matrix, Appendix E go-public      |

---

## 🧱 Tech Stack

<p>
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/Node.js-24%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 24+" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma 7" />
  <img src="https://img.shields.io/badge/PostgreSQL-18-336791?style=flat-square&logo=postgresql&logoColor=white" alt="Postgres 18" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis 7" />
  <img src="https://img.shields.io/badge/Mailpit-SMTP-2496ED?style=flat-square&logo=maildotru&logoColor=white" alt="Mailpit" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 4" />
  <img src="https://img.shields.io/badge/pnpm-11-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm 11" />
  <img src="https://img.shields.io/badge/Docker-Compose%20v2-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Compose v2" />
  <img src="https://img.shields.io/badge/Jest-30-C21325?style=flat-square&logo=jest&logoColor=white" alt="Jest 30" />
  <img src="https://img.shields.io/badge/Vitest-4-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest 4" />
  <img src="https://img.shields.io/badge/Playwright-1-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright 1" />
  <img src="https://img.shields.io/badge/Stryker-mutation-E74C3C?style=flat-square" alt="Stryker mutation" />
</p>

| Layer             | Choice                                | Why                                                            |
| ----------------- | ------------------------------------- | -------------------------------------------------------------- |
| Notification      | `@bymax-one/nest-notification@^0.1.0` | The library this repo demonstrates                             |
| Backend runtime   | Node.js ≥ 24                          | Library minimum; native `node:crypto` for hashed OTP keys      |
| Backend framework | NestJS 11 on Express 5                | Library peer dep                                               |
| Database          | PostgreSQL 18                         | The delivery audit store (`NotificationLog`)                   |
| OTP store / cache | Redis 7 via `ioredis`                 | Opt-in `IOtpStorage`; falls back to in-memory with zero config |
| ORM               | Prisma 7 (`@prisma/adapter-pg`)       | Type-safe, idiomatic in NestJS; driver-adapter client          |
| Email (dev)       | Mailpit                               | Zero-credential local SMTP capture + browsable inbox           |
| Email (prod)      | Resend (opt-in)                       | Pluggable via `IEmailProvider` — swap with SES, Postmark, etc. |
| Frontend          | Next.js 16 App Router                 | Library peer dep; demonstrates the `/react` hooks              |
| UI                | React 19 + Tailwind 4 + shadcn/ui     | The verbatim Bymax design system (forced dark, orange glass)   |
| Tests (api)       | Jest 30 + supertest                   | Unit + e2e HTTP surface, 100% coverage                         |
| Tests (web unit)  | Vitest 4 (jsdom)                      | Fast ESM-first runner, 100% coverage                           |
| Tests (web e2e)   | Playwright 1                          | Live journeys against the dockerized test stack                |
| Mutation          | Stryker 9                             | `break` gate — api 100, web ≥ 95 (`lib/**` 100)                |
| Container runtime | Docker Compose v2                     | Single-command local + ephemeral test stacks                   |
| Package manager   | pnpm 11                               | Matches the library; first-class workspace support             |

---

## 🤝 Contributing

Issues and PRs are welcome. Because this is a reference application, the bar for changes is:

> _"Does this make the demonstration of `@bymax-one/nest-notification` clearer or more complete?"_

Generic refactors that obscure library usage will be declined. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[AGENTS.md](AGENTS.md) for the full process.

```bash
# Clone
git clone https://github.com/bymaxone/nest-notification-example.git
cd nest-notification-example

# Install (build the sibling ../nest-notification first — see Quick start)
pnpm install

# Verify
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov

# Run
pnpm infra:up && pnpm dev
```

---

## 🔒 Security policy

If you find a security vulnerability — in **either this example or the library** — please **do not** open a
public issue, discussion, or pull request. Email **support@bymax.one** with `[security] nest-notification-example`
in the subject line. A vulnerability in the **library itself** (`@bymax-one/nest-notification`) should be
reported against [its repository](https://github.com/bymaxone/nest-notification).

Codes, recipient addresses, and per-tenant audit records must never leak — we triage security reports ahead of
feature work. See [SECURITY.md](SECURITY.md) for the full disclosure process.

---

## 📄 License

[MIT](LICENSE) © [Bymax One](https://bymax.one)

Library source: [`@bymax-one/nest-notification`](https://github.com/bymaxone/nest-notification) — MIT.

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/bymaxone">Bymax One</a> to demonstrate <a href="https://github.com/bymaxone/nest-notification">@bymax-one/nest-notification</a>.</sub>
</p>
