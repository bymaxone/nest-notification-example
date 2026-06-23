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
  Next.js console that fires every notification feature on demand and shows the result in real time — the email
  landing in a local inbox, the OTP entered in a segmented input, the delivery row appearing in the audit log.
- **A knowledge base.** Every public symbol is referenced from real code, and the
  [Feature Coverage Matrix](docs/OVERVIEW.md#6-feature-coverage-matrix) is enforced by a CI export-usage audit —
  the canonical place to learn how to wire `forRoot` vs `forRootAsync`, pluggable providers, multi-tenant
  resolution, the atomic OTP contract, and the audit interceptor.
- **A migration guide.** It shows how to replace a hand-rolled email-verification service with the cohesive
  `BymaxNotificationModule` — persistence behind `IOtpStorage`, transport behind `IEmailProvider`, audit behind
  `INotificationLogRepository`.

It is a sibling of [`nest-logger-example`](https://github.com/bymaxone/nest-logger-example) and follows the same
blueprint, voice, and quality bar — **100% test coverage**, a **Stryker mutation gate (≥ 95)**, English-only, and
Conventional Commits.

---

## 🚀 Quick start

```bash
git clone https://github.com/bymaxone/nest-notification-example.git
cd nest-notification-example

# 1) build the sibling library once (consumed pre-publish via a local file: link)
pnpm --dir ../nest-notification install && pnpm --dir ../nest-notification build

# 2) install, bring up the local backends, run both apps
pnpm install
pnpm infra:up        # Postgres (audit) + Redis (OTP) + Mailpit (SMTP inbox)
pnpm dev             # NestJS API + Next.js console
```

> The library is **pre-publish** — it is consumed via a local `file:` link to the sibling `../nest-notification`
> checkout until it ships to npm. The local happy path needs **zero external credentials**: emails land in a
> browsable Mailpit inbox, OTP storage falls back to in-memory, and the audit log is local Postgres.

> **Memory safety.** `pnpm dev` runs two watchers at once and the test suites duplicate the locally linked library
> across workers. Run suites **sequentially with bounded workers** and never fan out parallel test agents.

---

## 🏗️ Architecture

```
            apps/web (Next.js 16 + React 19) — the Notification Console
   Trigger Center → fire every feature      Explorer → read the delivery audit log
   OTP-verify (useOtpInput/useOtpCountdown) Provider matrix · Email preview · Roadmap
        │ POST /otp/* /email/* /dispatch (+ x-tenant-id)   ▲ GET /audit/logs, /audit/stream (SSE)
        ▼                                                  │
   ┌────────────────────────────────────────────────────────┴──────────────┐
   │ apps/api (NestJS 11 + Express 5)                                        │
   │ BymaxNotificationModule.forRootAsync({ useFactory })                    │
   │ EmailService · OtpService · NotificationService · NotificationAudit…   │
   │ providers: Nodemailer→Mailpit (BYO) | Resend (opt-in) | NoOp           │
   │ storage:   RedisOtpStorage (opt-in) | InMemoryOtpStorage               │
   │ audit:     PrismaNotificationLogRepository                             │
   └───────┬──────────────────────┬──────────────────────┬─────────────────┘
   OTP entries (hashed keys)   audit rows (masked)    rendered emails (SMTP)
           ▼                      ▼                        ▼
   ┌───────────────┐      ┌────────────────────┐   ┌────────────────────┐
   │     Redis     │      │     PostgreSQL     │   │      Mailpit       │
   │  (OTP store)  │      │  NotificationLog   │   │ SMTP :1025 / :8025 │
   └───────────────┘      └────────────────────┘   └────────────────────┘
```

`apps/api` and `apps/web` are independently deployable. Multi-tenancy is demonstrated through a **tenant switcher**
in the console that sets a trusted `x-tenant-id` header — resolved by the library's `tenantIdResolver`, not a
second backend. Full diagram in
[docs/OVERVIEW.md §3](docs/OVERVIEW.md#3-architecture-at-a-glance).

> **Coverage rule.** Every public export of `@bymax-one/nest-notification` (the `.`, `./shared`, and `./react`
> subpaths) is referenced from at least one file under `apps/` — the
> [Feature Coverage Matrix](docs/OVERVIEW.md#6-feature-coverage-matrix) maps each one to where it is used.

---

## 📖 Documentation

| Doc                                          | What it covers                                        |
| -------------------------------------------- | ----------------------------------------------------- |
| [OVERVIEW](docs/OVERVIEW.md)                 | Product blueprint & repository layout (master spec)   |
| [DEVELOPMENT_PLAN](docs/DEVELOPMENT_PLAN.md) | The phased build plan, quality gates & CI matrix      |
| [Task files](docs/tasks/README.md)           | Per-phase task breakdown & status conventions         |
| [Design system](docs/design_system.html)     | The shared Bymax UI design system (open in a browser) |

The full reference set (Getting Started, Features, Architecture, Environment, Providers, Multi-Tenancy, Database,
Deployment, Troubleshooting, Releases) is authored alongside the application build.

---

## License

MIT © Bymax One. `@bymax-one/nest-notification` is MIT © Bymax One. See [LICENSE](LICENSE).
