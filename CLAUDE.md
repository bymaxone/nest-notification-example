# Repository guide for AI agents

This file is the contract for any AI agent (Claude Code, Copilot, others) working in
`nest-notification-example` — the public reference application for `@bymax-one/nest-notification`. It is dense and
authoritative; read it before changing anything. The full blueprint is [docs/OVERVIEW.md](docs/OVERVIEW.md); the
phased build plan and quality gates are [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md).

## What this repo is

A runnable, production-shaped demo that exercises **every public export** of `@bymax-one/nest-notification` across a
NestJS API (`apps/api`) and a Next.js console (`apps/web`). The library is consumed pre-publish via a local `file:`
link to the sibling `../nest-notification` checkout (build it first).

## Stack

- **pnpm** workspace (`packages: ['apps/*']`), **Node 24** (`.nvmrc`), **TypeScript 5.9 strict**.
- **apps/api** — NestJS 11 + Express 5, Prisma 7 / PostgreSQL (audit), ioredis (OTP), Mailpit (local SMTP).
- **apps/web** — Next.js 16 (App Router) + React 19, Tailwind 4, the shared Bymax design system.

## Run / test / gate cheat-sheet

```bash
pnpm install                # install (frozen in CI)
pnpm infra:up               # local Postgres + Redis + Mailpit
pnpm dev                    # API + console watchers

pnpm typecheck              # tsc --noEmit, strict, zero errors
pnpm lint                   # eslint flat config, --max-warnings 0
pnpm format:check           # prettier --check
pnpm test:cov               # 100% coverage, both apps
pnpm audit:exports          # every public export referenced in apps/**
pnpm audit:error-codes      # every error code localized in apps/web
```

## Non-negotiable invariants

- **Type safety.** `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`. **Zero `any`, zero
  suppression comments** (`@ts-ignore`, `eslint-disable`). ESLint runs with `--max-warnings 0`.
- **Clean Code & SOLID.** Functions ≤ 50 lines; files ≤ 800 (200–400 typical); one responsibility per file/function;
  explicit DI; DI tokens as `Symbol`. JSDoc on every export.
- **Never leak secrets.** Never log or return an OTP code; mask recipient addresses in the audit log and responses;
  resolve the tenant from a trusted source (header/JWT claim), never the request body. See
  [docs/OVERVIEW.md §13](docs/OVERVIEW.md#13-multi-tenant-security--recipient-privacy).
- **Library-faithful.** Reconcile against the shipped `.d.ts`, never the README. Map verify in the controller, not in
  the library. Every public export is reachable from the browser, not just probe-referenced.
- **Design system is verbatim.** The shared design files (`docs/design_system.html` and, in the web app, `globals.css`
  / `tailwind.config.ts` / `components.json` / `components/ui/*`) are copied **byte-identical** from
  `nest-logger-example`. Never re-style them; never run a design skill over them.
- **Memory-safe tests.** Jest/Vitest `maxWorkers: '50%'` is baked into the configs. Run suites **sequentially with
  bounded workers**; never run both apps' suites at once; **never fan out parallel test agents** — the locally linked
  library is duplicated across workers and will exhaust memory.
- **Timeless, English-only.** All code, comments, JSDoc, identifiers, and commit messages are English. Comments
  explain _what_ and _why_, never which roadmap stage produced them — no plan-stage references in committed files.

## Commits

Conventional Commits — `<type>(<scope>): <subject>`. Scopes: `api | web | ci | docs | infra`. **No `Co-Authored-By`
trailer.** husky runs lint-staged on `pre-commit` and commitlint on `commit-msg`; do not bypass the hooks.

## CI is contractual

Workflow and job names (`ci.yml`: `install`, `lint`, `typecheck`, `unit`, `e2e-api`, `e2e-web`,
`export-usage-check`, `dependency-review`, `coverage-report`; plus `codeql`, `scorecard`, `mutation`,
`mutation-nightly`, `release`) are referenced by branch protection — never rename them. Workflows are least-privilege
(top-level `permissions: contents: read`, jobs widen only what they need, pinned actions, `timeout-minutes` per job).
