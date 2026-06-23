# nest-notification-example — Development Plan

> **Scope:** the phased build plan for `nest-notification-example`, the public reference application for `@bymax-one/nest-notification`.
> **Source spec:** [`docs/OVERVIEW.md`](./OVERVIEW.md) (the master blueprint — 21 sections, 61-row Feature Coverage Matrix).
> **Targeted library version:** `@bymax-one/nest-notification@0.1.0` (pre-publish, consumed via `file:`).
> **Document version:** `1.0 — authored before implementation`.
> **Status:** specification only — no `apps/` code yet.

This is **Layer 2** of the `spec → roadmap → phase-tasks` workflow. It does not restate the specification; it
**sequences the work** into independently shippable phases, each with an observable Definition of Done, and defines
the **autonomous execution model** by which AI agents build the repo end-to-end (one phase = one PR = one review
cycle). Layer 3 (`docs/tasks/phase-NN-*.md`) carries the per-task agent execution prompts and is scaffolded one phase
at a time from this plan. Format and conventions follow the `rust-auth` gold reference and the `nest-logger-example`
structural template, reconciled with the current vault standard.

---

## Table of Contents

- [Status legend](#status-legend)
- [Progress](#progress)
- [Phase dashboard](#phase-dashboard)
- [0. Guiding Principles](#0-guiding-principles)
- [1. Phase Map & Dependencies](#1-phase-map--dependencies)
- [2. Global Conventions](#2-global-conventions)
- [3. Autonomous Execution Model](#3-autonomous-execution-model)
- [Phases 0–14](#phase-0--foundation-tooling--ci-skeleton)
- [Appendix A — Environment Variable Registry](#appendix-a--environment-variable-registry)
- [Appendix B — Library Export → Phase Coverage Map](#appendix-b--library-export--phase-coverage-map)
- [Appendix C — Quality Gates](#appendix-c--quality-gates)
- [Appendix D — CI/CD Workflow Matrix](#appendix-d--cicd-workflow-matrix)
- [Appendix E — Go-Public Readiness Checklist](#appendix-e--go-public-readiness-checklist)
- [Update Protocol](#update-protocol)

---

## Status legend

| Symbol | Meaning                                                                          |
| ------ | -------------------------------------------------------------------------------- |
| 📋     | ToDo — not started                                                               |
| 🔄     | In Progress — exactly one phase at a time                                        |
| 👀     | Review — code complete, in PR / Copilot review                                   |
| ✅     | Done — every DoD bullet met and CI green on the merged PR                        |
| ⛔     | Blocked — a dependency or external blocker is open                               |
| 🟡     | Partial — some tasks done but the phase DoD is not fully met (never use ✅ here) |

---

## Progress

- **Overall progress:** 5 / 15 phases · 29 / 82 tasks done (35%)
- **Active phase:** P5 — OTP & Email Controllers
- **Blocked:** none

> All 15 Layer-3 task files are scaffolded under [`docs/tasks/`](./tasks/) (82 tasks total). Execute one phase at a time
> per the [Autonomous Execution Model](#3-autonomous-execution-model); update this dashboard as tasks/phases close.

---

## Phase dashboard

| ID  | Phase                                        | Tasks file                          | Status | Progress | Size | Last updated |
| --- | -------------------------------------------- | ----------------------------------- | ------ | -------- | ---- | ------------ |
| P0  | Foundation, Tooling & CI Skeleton            | `phase-00-foundation-ci.md`         | ✅     | 7 / 7    | L    | 2026-06-23   |
| P1  | Local Stack & Environment                    | `phase-01-local-stack.md`           | ✅     | 5 / 5    | M    | 2026-06-23   |
| P2  | Library Consumption & Export Audit           | `phase-02-library-consumption.md`   | ✅     | 4 / 4    | M    | 2026-06-23   |
| P3  | API Skeleton                                 | `phase-03-api-skeleton.md`          | ✅     | 6 / 6    | M    | 2026-06-23   |
| P4  | Notification Wiring & Audit Store            | `phase-04-notification-wiring.md`   | ✅     | 7 / 7    | L    | 2026-06-23   |
| P5  | OTP & Email Controllers                      | `phase-05-otp-email-controllers.md` | 🔄     | 1 / 6    | L    | 2026-06-23   |
| P6  | Audit Read-API (keyset + SSE)                | `phase-06-audit-read-api.md`        | 📋     | 0 / 5    | M    | —            |
| P7  | Roadmap Rejection Endpoints                  | `phase-07-roadmap-rejection.md`     | 📋     | 0 / 3    | S    | —            |
| P8  | Web Skeleton & Design System                 | `phase-08-web-skeleton.md`          | 📋     | 0 / 6    | M    | —            |
| P9  | Console Core (Overview · Trigger · Explorer) | `phase-09-console-core.md`          | 📋     | 0 / 6    | L    | —            |
| P10 | OTP & Providers Panels                       | `phase-10-otp-providers-panels.md`  | 📋     | 0 / 6    | L    | —            |
| P11 | Optional Auth Seam (nest-auth)               | `phase-11-auth-seam.md`             | 📋     | 0 / 3    | M    | —            |
| P12 | Testing & 100% Coverage                      | `phase-12-testing.md`               | 📋     | 0 / 6    | L    | —            |
| P13 | Mutation Hardening                           | `phase-13-mutation.md`              | 📋     | 0 / 5    | L    | —            |
| P14 | Docs, Public-Readiness & Release             | `phase-14-docs-release.md`          | 📋     | 0 / 7    | L    | —            |

---

## 0. Guiding Principles

1. **Library-faithful.** Every public export of `@bymax-one/nest-notification` (`.`, `./shared`, `./react`) is
   exercised, reconciled against the shipped `.d.ts` — never the README. The contract is the [Feature Coverage Matrix](./OVERVIEW.md#6-feature-coverage-matrix).
2. **Browser-exercisable, not probe-only.** Every feature must be reachable from the UI (the Trigger Center / panels);
   `library-probe.ts` is the floor for type/token-only exports, never a substitute for a real journey.
3. **Production-shaped.** `forRootAsync({ useFactory })`, real Prisma audit repository, Redis storage, a real
   `IEmailProvider` — wired the way a real app would, no shortcuts or stubs in the happy path.
4. **Same quality bar as the library.** **100% coverage on all four metrics (statements/branches/functions/lines)** in
   both apps, and **Stryker mutation ≥ 95 (mandatory floor), driven as close to 100% as achievable** — per the explicit
   project mandate. This resolves the sibling disagreement (nest-cache-example's lighter bar is **not** used here).
5. **CI from Phase 0.** The full, strong pipeline (static gates + 100%-coverage + audits + security scanning + mutation
   - release) exists before any feature code, so every later phase merges green. The repo is **private now, public
     later** — go-public hardening is built in from the start, not retrofitted.
6. **Design parity.** The shared design system (`docs/design_system.html` + the copied `globals.css` /
   `tailwind.config.ts` / `components.json` + `components/ui/*`) is reused **verbatim** — forced dark, orange `#ff6224`
   glass, Geist + mono. Never re-derived, never overridden by an opinionated design skill.
7. **Honest scope.** Unimplemented surfaces are shown truthfully — SMS/Push are declared-but-rejected-at-startup and
   surfaced in a Roadmap panel, not faked.
8. **One phase in progress at a time.** No phase starts until every dependency is ✅. No phase is marked ✅ while a DoD
   bullet is unmet or CI is red — use 🟡 Partial.
9. **English-only & Conventional Commits.** All code, comments, JSDoc, identifiers, and commit messages are English.
   Commits follow Conventional Commits with **no `Co-Authored-By` trailer**. Comments are timeless — **no `Phase N` /
   task references in committed source or docs-as-config** (`.github/**`). Doc-section refs are allowed.

---

## 1. Phase Map & Dependencies

```text
  FOUNDATION                    BACKEND TRACK                          FRONTEND TRACK            QUALITY & RELEASE
  ──────────                    ─────────────                          ──────────────            ─────────────────
  P0 ── P1 ── P2 ── P3 ── P4 ──┬── P5 ── P6 ─────────────┐
                               │                          │
                               └── P7 ───────────────────┤
                                                          ├── P8 ── P9 ──┬── P10 ──┐
                                                          │              └── P11 ──┤
                                                          │                        │
                                                          └────────────────────────┴── P12 ── P13 ── P14
```

**Edge list (canonical):**
`P0→P1`, `P1→P2`, `P2→P3`, `P3→P4`, `P4→P5`, `P4→P7`, `P5→P6`, `{P5,P6}→P8`, `P8→P9`, `P9→P10`, `P9→P11`,
`{P10,P11,P6,P7}→P12`, `P12→P13`, `P13→P14`.

**Critical path:** `P0 → P1 → P2 → P3 → P4 → P5 → P6 → P8 → P9 → P10 → P12 → P13 → P14` (13 phases — P8 needs both P5 and P6).

**Parallelization notes.** The backend track (P3–P7) is mostly linear because each layer consumes the previous one's
DI wiring; **P7 (roadmap rejection) can run in parallel with P5/P6** once P4 lands. The frontend track (P8–P11) opens
once the read-API (P6) exists; **P10 and P11 are independent** and parallelizable after P9. The quality track (P12–P14)
consolidates: testing and mutation are **dedicated phases** (not folded into feature phases), and feature phases still
ship their own tests at 100% as they land — P12/P13 are the hardening/gate-closing consolidation.

---

## 2. Global Conventions

Stated once here so per-phase DoDs do not restate them.

| Concern            | Convention                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager    | **pnpm 11.x** (workspaces; `pnpm-workspace.yaml: packages: ['apps/*']`), pinned via `packageManager`. The `@bymax-one/*` ecosystem standard is 10.8 — adopting 11.x for a fresh repo (see OVERVIEW §21 decision).                                                                     |
| Runtime            | **Node 24 (Active LTS)** — `.nvmrc=24`, `engines.node >=24`.                                                                                                                                                                                                                          |
| Install            | `pnpm install --frozen-lockfile` (`.npmrc: frozen-lockfile=true`).                                                                                                                                                                                                                    |
| Language           | TypeScript 5.9 **strict** + `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`, `verbatimModuleSyntax`. **Zero `any`, zero suppression comments** (`@ts-ignore`, `eslint-disable`). |
| Lint / format      | ESLint flat config (`typescript-eslint` recommendedTypeChecked, `eslint-config-prettier` last, `--max-warnings 0`) + Prettier.                                                                                                                                                        |
| Pre-commit         | husky `pre-commit` → `lint-staged` (`prettier --write` + `eslint --fix`); `commit-msg` → `commitlint`.                                                                                                                                                                                |
| Commits            | Conventional Commits (`<type>(scope): <subject>`); **no `Co-Authored-By` trailer**; signed where possible.                                                                                                                                                                            |
| Boolean naming     | `is` / `has` / `should` / `can` prefixes.                                                                                                                                                                                                                                             |
| Test coverage      | **100%** on statements/branches/functions/lines, both apps (Jest api, Vitest web). Non-executable glue excluded from scope (`*.module.ts`, `main.ts`, `*.dto.ts`, `*.d.ts`).                                                                                                          |
| Mutation score     | **Stryker break ≥ 95 (mandatory)**, driven to 100% where achievable; survivors documented as provable equivalents in `docs/stryker/`.                                                                                                                                                 |
| Audits             | `audit:exports` (every public export referenced in `apps/**`) + `audit:error-codes` (every `NOTIFICATION_ERROR_CODES` key localized in `apps/web`); CI-gating.                                                                                                                        |
| Memory-safe tests  | Jest/Vitest `maxWorkers: '50%'` baked into configs; `NODE_OPTIONS=--max-old-space-size`; `file:` over `link:`; sequential suites; **never fan out parallel test agents**.                                                                                                             |
| Design system      | Copied **verbatim** from `nest-logger-example` (`docs/design_system.html` + the 4 config files + `components/ui/*`). Never re-styled.                                                                                                                                                 |
| Library dependency | `@bymax-one/nest-notification` via `file:../../../nest-notification` pre-publish; pinned semver after publish (RELEASES.md).                                                                                                                                                          |
| Security defaults  | Helmet/security headers, CORS allow-list, `Retry-After` exposed, secrets only via env, no PII/codes in logs.                                                                                                                                                                          |
| Clean Code sizing  | Functions ≤ 50 lines; files ≤ 800 (200–400 typical); SRP/SOLID; explicit DI; DI tokens as `Symbol`.                                                                                                                                                                                   |

---

## 3. Autonomous Execution Model

This repo is built **end-to-end by autonomous agents in a Claude Code loop**. Each phase is executed, reviewed,
committed, and merged as a single unit before the next begins. The loop per phase:

1. **Scaffold the phase tasks** — `/bymax-workflow:phase-tasks <P>` generates `docs/tasks/phase-NN-*.md` with one
   self-contained agent execution prompt per task (Role · PROJECT · CURRENT PHASE · PRECONDITIONS · REQUIRED READING
   (bounded) · TASK · DELIVERABLES · Constraints · Verification (exact commands + expected output) · Completion Protocol).
2. **Branch** — `git switch -c feat/pNN-<slug>` off `main` (never commit on `main`).
3. **Implement task-by-task (TDD)** — `/bymax-quality:tdd` for new code (tests first, 100% as written) or the `tester`
   skill for adding tests. One task `🔄` at a time; never start a task until its `Depends on` are `✅`.
4. **Local gate (must all pass before review):** `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm audit:exports && pnpm audit:error-codes`.
5. **Self-review (apply all findings):** `/bymax-quality:code-review` → `/security-review` → re-run the local gate after fixes.
6. **Verify behavior:** `/bymax-workflow:verify` (run the app / the new surface; confirm the DoD observably).
7. **Commit** — Conventional Commits, scoped to the phase; no `Co-Authored-By`.
8. **Push & open a PR** to `main`. **CI must go fully green** (Appendix D) — no merge on a red or skipped required check.
9. **Copilot / agent review** — the GitHub Copilot code-review (`.github/copilot-instructions.md` +
   `agents/agent-code-reviewer.agent.md`) reviews the PR; the agent addresses every 🔴 Blocker and re-pushes until green.
10. **Merge** (squash) after green CI + resolved review. Then **update the dashboard** (this file + the phase file) per
    the [Update Protocol](#update-protocol), and proceed to the next phase.

**The three invariants** (enforced by the dashboard + each task's `Depends on` + `Verification`):

- **One-in-progress-at-a-time** — exactly one phase `🔄` and one task `🔄` within it.
- **Never-start-until-deps-green** — a phase/task begins only when every dependency is `✅`.
- **Never-mark-done-with-failing-verification** — `✅` requires every DoD/acceptance bullet met **and** CI green on the
  merged PR; otherwise `🟡 Partial`.

> **Branch protection (configured in the GitHub UI before going public):** `main` is PR-only (no direct push); required
> checks = every `ci.yml` job + `codeql` + `scorecard` (informational) + `mutation` (PR-changed workspaces); linear
> history; signed commits. Job names are **contractual** — branch protection references them by name.

---

## Phase 0 — Foundation, Tooling & CI Skeleton

**Goal:** stand up the pnpm monorepo, the full toolchain, the shared design-system files, and the **complete CI/CD +
go-public scaffolding** so every subsequent phase merges through a strong, agent-gating pipeline.

**Scope — In:** `pnpm-workspace.yaml`, root `package.json` (scripts), `tsconfig.base.json`, `eslint.config.mjs`,
`.prettierrc.mjs` + `.prettierignore`, `commitlint.config.mjs`, `.husky/`, `lint-staged.config.mjs`, `.nvmrc`,
`.npmrc`, `.editorconfig`, `.gitignore`, `.gitmessage`, `.markdown-link-check.json`; the shared design-system files
copied verbatim from `nest-logger-example`; **all `.github/workflows/`** (`ci.yml`, `codeql.yml`, `scorecard.yml`,
`mutation.yml`, `mutation-nightly.yml`, `release.yml`) as runnable skeletons; `dependabot.yml` + `renovate.json`;
the **4 Copilot review files**; `.github/ISSUE_TEMPLATE/` + `PULL_REQUEST_TEMPLATE.md` + `CODEOWNERS`; mandatory repo
files (`LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`,
`README.md`); `apps/{api,web}/Dockerfile` skeletons; `.audit-ignore.json`; `scripts/audit-library-exports.mjs` +
`scripts/audit-error-codes.mjs` stubs.

**Scope — Out:** any application logic (P3+); real audit-export results (the scripts run but pass trivially on an empty
`apps/`).

**Definition of Done:**

- `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm format:check` pass on the empty workspace.
- `ci.yml` runs green on a PR; `codeql.yml` + `scorecard.yml` run (informational); `release.yml` validates without
  publishing; least-privilege `permissions`, `concurrency`, pinned actions, and `timeout-minutes` set on every job.
- All go-public files (Appendix E) present; the 4 Copilot files customized for this stack (< 4000 chars each, no
  phase/task references).
- The design-system files are byte-identical to `nest-logger-example`'s.

**Context / preconditions:** none (first phase).
**Rules-of-phase:** no `.gitkeep`/empty-dir scaffolding; CI job names are contractual; copilot/docs-as-config carry no
phase/task references.
**References:** OVERVIEW §4, §5, §7, §8; Appendix C, D, E.
**Size:** L. **CI introduced:** the entire pipeline (skeletons).

---

## Phase 1 — Local Stack & Environment

**Goal:** a one-command, zero-credential local stack and a fail-fast environment contract.

**Scope — In:** `docker-compose.yml` (postgres:18 + redis:7 + mailpit, each healthchecked), `docker-compose.test.yml`
(high ports — Postgres `55432`, Redis `56379`), `docker/postgres/init.sql`, `.env.example`, the API Zod env schema
(`apps/api/src/config/env.schema.ts`), infra scripts (`infra:up`/`infra:down`), `apps/api` skeleton `package.json`.

**Scope — Out:** any NestJS bootstrap (P3).

**Definition of Done:**

- `pnpm infra:up` returns only when all three containers are healthy; Mailpit UI reachable at `:8025`.
- A missing/invalid env var aborts (the Zod schema is unit-tested for the failure path).
- `.env.example` documents every variable; ports match OVERVIEW §8/§9.

**Context / preconditions:** P0.
**Rules-of-phase:** all services bind `127.0.0.1`; test stack uses the high ports to never contend with dev.
**References:** OVERVIEW §8, §9; Appendix A.
**Size:** M.

---

## Phase 2 — Library Consumption & Export Audit

**Goal:** consume the sibling library pre-publish and wire the export-usage audit that makes the coverage promise real.

**Scope — In:** `file:` dependency on `../../../nest-notification` in `apps/api` (+ `apps/web` for `./shared`/`./react`);
install the required + optional peers; `apps/api/src/library-probe.ts` (+ `.spec.ts`) referencing the type/token-only
exports; `apps/web/next.config.ts` `transpilePackages`; finalize `scripts/audit-library-exports.mjs` against the
library's `dist/{server,shared,react}/index.d.ts` + `.audit-ignore.json`.

**Scope — Out:** UI hook usage (P10); error-code localization (P10/P12).

**Definition of Done:**

- The probe imports from all three subpaths; `tsc` resolves types from `dist`.
- `pnpm audit:exports` passes (every export referenced or allow-listed with a reason).
- The library `dist/` build-first workflow is documented and the link resolves.

**Context / preconditions:** P1 (workspace + apps/api skeleton).
**Rules-of-phase:** prefer `file:` over `link:`; allow-list only genuinely-internal leaked symbols, never demonstrable
exports.
**References:** OVERVIEW §6 (Coverage rule), §7; Appendix B.
**Size:** M.

---

## Phase 3 — API Skeleton

**Goal:** a bootable NestJS service with the cross-cutting plumbing the notification module needs.

**Scope — In:** `main.ts` (CORS allowing `x-tenant-id`, exposing `Retry-After`; `enableShutdownHooks`), `app.module.ts`
skeleton, `/health`, the `NotificationException` → HTTP exception filter, the `x-tenant-id` guard/decorator, the Zod
validation pipe, `RedisModule` (the `REDIS` `Symbol` token → `ioredis` client **or `null`** when `REDIS_URL` unset),
`PrismaModule` + `PrismaService` (the `@prisma/adapter-pg` ESM client).

**Scope — Out:** the notification module wiring (P4); any controllers (P5).

**Definition of Done:**

- `GET /health` → 200; the app boots with and without `REDIS_URL`.
- The exception filter serializes a `NotificationException` to `{ error: { code, message, details } }` with the right
  HTTP status (unit-tested).
- `RedisModule`/`PrismaModule` resolve; tests cover the `REDIS = null` branch.

**Context / preconditions:** P2.
**Rules-of-phase:** Prisma 7 is ESM-first — use the driver adapter and align module format; the REDIS token must
resolve to `null` (not throw) when unconfigured.
**References:** OVERVIEW §9, §11.
**Size:** M.

---

## Phase 4 — Notification Wiring & Audit Store

**Goal:** wire `BymaxNotificationModule.forRootAsync` with real providers/storage/renderer/audit, and persist the
delivery audit log.

**Scope — In:** `notification/notification.config.ts` (the `useFactory` with annotated params), the custom
`NodemailerEmailProvider` (→ Mailpit) + Resend opt-in resolution + `NoOpEmailProvider` fallback, the template registry
(`templates.ts`) using `CANONICAL_EMAIL_TEMPLATES`, the alternate renderers (Handlebars/MJML/React Email), the
`NotificationLog` Prisma schema + migration + `seed.ts` (tenants acme/globex), `PrismaNotificationLogRepository` (write
side), and the `NotificationAuditInterceptor` registered as `APP_INTERCEPTOR`.

**Scope — Out:** the HTTP controllers (P5); the audit read-API (P6).

**Definition of Done:**

- The module boots via `forRootAsync({ useFactory })`; `getEnabledChannels()` reports `['email','otp']`.
- A programmatic email send renders, lands in Mailpit, and writes a masked audit row (no code present) to Postgres.
- The atomic OTP storage (Redis or in-memory) and the renderer HTML-escape behavior are unit-proven.

**Context / preconditions:** P3.
**Rules-of-phase:** pass DI-dependent adapters as **instances** (async class-form needs a zero-arg ctor); audit
`swallowErrors: true` by default; never log codes.
**References:** OVERVIEW §9, §11, §12, §13, §14.
**Size:** L. **Matrix rows:** 1–6, 10–19, 33, 47–51.

---

## Phase 5 — OTP & Email Controllers

**Goal:** the full HTTP surface that drives every email + OTP feature.

**Scope — In:** `/otp/{generate,verify,resend,consume}` + `GET /otp/status`; `/email/{send,send-template}` (+ the
attachment-guard path); `POST /dispatch` (the `NotificationService` façade) + `GET /channels`; `GET /debug/key`; Zod
DTOs for each; the **controller-side** `OtpVerifyResult` → HTTP mapping (200/401/404/429); `Retry-After` on 429 via the
cooldown helpers.

**Scope — Out:** the audit read-API (P6); any UI (P8+).

**Definition of Done:**

- The complete OTP lifecycle works over HTTP (generate → verify → resend cooldown → max-attempts → consume → status),
  with correct status codes and `Retry-After`.
- Raw + template email sends return `{ messageId }`; oversize attachment → 413; XSS-escape proven; locale fallback
  proven; `dispatch` covers `EMAIL_MISSING_BODY` + `CHANNEL_DISABLED`.
- Every endpoint has unit + e2e specs at 100%.

**Context / preconditions:** P4.
**Rules-of-phase:** `verify` never throws — the controller maps; `not_found` → 404 (document the expiry-as-not-found
choice).
**References:** OVERVIEW §10, §11, §16.
**Size:** L. **Matrix rows:** 7–9, 13–16, 20–42, 52–54, 57.

---

## Phase 6 — Audit Read-API (keyset + SSE)

**Goal:** the queryable, live delivery audit log that powers the Explorer.

**Scope — In:** `GET /audit/logs` (keyset pagination, 410 on stale cursor), `GET /audit/stream` (`@Sse`, SSE `id` =
keyset cursor, `Last-Event-ID` resume), `GET /audit/aggregate` (time-bucketed counts by verb/channel/provider); the
`NotificationLog` indexes; the **source facet** (`providerName === '__interceptor__'`).

**Scope — Out:** UI rendering (P9).

**Definition of Done:**

- Keyset pagination + stale-cursor 410; SSE live tail emits new rows with resumable `id`s; aggregate returns the chart
  series.
- The dual-source semantics (service verbs vs interceptor `sent`/`failed`) are documented and facet-filterable.
- 100% covered.

**Context / preconditions:** P5.
**Rules-of-phase:** never per-event access-log the SSE route (feedback-loop guard).
**References:** OVERVIEW §14, §15.
**Size:** M. **Matrix rows:** 60, 61.

---

## Phase 7 — Roadmap Rejection Endpoints

**Goal:** honestly demonstrate the declared-but-rejected v0.2 surface.

**Scope — In:** `POST /admin/try-configure-{sms,push,async-useclass}` — each compiles a throwaway module in isolation
and returns the library's real startup-rejection error string.

**Scope — Out:** the UI Roadmap panel (P10).

**Definition of Done:**

- Each endpoint returns the exact thrown error for `sms` / `push` / `forRootAsync({ useClass })`; covered by isolated
  e2e modules.

**Context / preconditions:** P4 (the module + validation behavior). Parallel with P5/P6.
**Rules-of-phase:** isolated `Test.createTestingModule` per attempt; never mutate the running app's module.
**References:** OVERVIEW §6 (rows 3, 58a–c), §2.
**Size:** S. **Matrix rows:** 3, 58a–58c.

---

## Phase 8 — Web Skeleton & Design System

**Goal:** the Next.js console shell under the shared design system, ready for pages.

**Scope — In:** `apps/web` (Next 16 + React 19 + Tailwind 4), the **verbatim** design-system files, `app/layout.tsx`
(Geist + forced dark + Providers), the app shell (64px topbar / 250px sidebar), the global controls (tenant switcher,
role switcher, live toggle) persisted via `nuqs`, and the `lib/` clients (`api-client`, `sse`, `error-codes` from
`./shared`, `severity`).

**Scope — Out:** page bodies (P9+).
**UI base:** `docs/design_system.html`.

**Definition of Done:**

- `pnpm --filter web build` succeeds; `next build` resolves `./react` + `./shared`.
- A screenshot of the shell is indistinguishable from the sibling examples (design parity); global controls drive URL state.

**Context / preconditions:** P5 + P6 (the API the console will call).
**Rules-of-phase:** keep `lib/` JSX-free; never import the library `.` (server) subpath in `apps/web`; overlays above
the topbar.
**References:** OVERVIEW §10; DASHBOARD (to be authored P14).
**Size:** M. **Matrix rows:** 53, 57 (shared subpath in the browser).

---

## Phase 9 — Console Core (Overview · Trigger Center · Explorer)

**Goal:** the three daily-driver surfaces — fire every feature and watch it land.

**Scope — In:** **Overview** (delivery-health charts ← `/audit/aggregate`), **Trigger Center** (a card per feature:
send email, generate+verify OTP, trip cooldown, force max-attempts, oversize attachment, break audit sink, spoof
tenant, dispatch — each auto-pivoting the Explorer), **Audit Explorer** (faceted virtualized table + detail drawer with
the no-code-present proof + **live tail** over SSE with follow-mode).

**Scope — Out:** the OTP-verify panel + provider matrix (P10).

**Definition of Done:**

- Every backend feature is fireable from the Trigger Center and auto-pivots to its audit row.
- The Explorer searches/filters (incl. source facet), tails live, and renders the never-contains-code proof.
- 100% web coverage on the new `lib/`+`components/`.

**Context / preconditions:** P8.
**Rules-of-phase:** charts use percentile/rate series (color + icon + label); skeletons not spinners; action-oriented
empty states.
**References:** OVERVIEW §10, §14, §15.
**Size:** L. **Matrix rows:** 43, 45, 46, 50, 60, 61.

---

## Phase 10 — OTP & Providers Panels

**Goal:** the notification-specific surfaces that have no sibling analog.

**Scope — In:** **OTP Verify** (`useOtpInput` segmented box + `useOtpCountdown` expiry pill + cooldown-gated resend +
every `OTP_*` error localized from `./shared`), **Providers & Templates** (the provider/storage/renderer matrix +
email preview with Rendered/HTML/Text/Metadata tabs proving the escape behavior), the **Roadmap** panel (surfacing the
P7 rejections), and **Settings** (config status + the boot-frozen `consumeOnVerify`/`swallowErrors` display).

**Scope — Out:** the auth seam (P11).

**Definition of Done:**

- The OTP box (paste/auto-advance/backspace/`reset`/`isComplete`) + countdown drive a real verify against the backend.
- The provider matrix + email preview + roadmap rejection render; every `NOTIFICATION_ERROR_CODES` key is localized
  (`audit:error-codes` passes).
- 100% web coverage.

**Context / preconditions:** P9. Parallel with P11.
**Rules-of-phase:** the hooks are state/UX only — verifying is the app's job; honor `autocomplete="one-time-code"` +
`inputmode="numeric"`.
**References:** OVERVIEW §10 (console), §16; the React subpath (rows 55–56).
**Size:** L. **Matrix rows:** 15, 18, 19, 52, 53, 55, 56, 58a–c.

---

## Phase 11 — Optional Auth Seam (`@bymax-one/nest-auth`)

**Goal:** demonstrate the composition with `nest-auth` without bundling a full auth stack.

**Scope — In:** `notification/auth-email.provider.ts` (`NotificationAuthEmailProvider` implementing nest-auth's
`IEmailProvider` by delegating to `EmailService.sendTemplate`), and journey 13 — a nest-auth-style password-reset OTP
that renders, sends (Mailpit), and audits through this pipeline. `nest-auth` stays an illustrative peer.

**Scope — Out:** a real login/session UI.

**Definition of Done:**

- The adapter maps all 7 nest-auth email-port methods to canonical templates; journey 13 shows one event end-to-end.
- The `notification:` vs `auth:` Redis namespace isolation is documented; covered at 100%.

**Context / preconditions:** P9. Parallel with P10.
**Rules-of-phase:** nest-auth owns auth-OTP/MFA; nest-notification owns delivery — never duplicate OTP for the same
purpose.
**References:** OVERVIEW §14.
**Size:** M.

---

## Phase 12 — Testing & 100% Coverage

**Goal:** close the coverage walls — 100% on all four metrics in both apps.

**Scope — In:** consolidate Jest unit + supertest e2e (api) and Vitest unit + Playwright e2e (web) to **100%**
(statements/branches/functions/lines); bake `maxWorkers: '50%'` into the configs; the coverage-scope exclusions; the
`ci.yml` `unit`/`e2e`/`coverage-report` jobs fully green; the live journeys under Playwright.

**Scope — Out:** mutation (P13).

**Definition of Done:**

- `pnpm test:cov` reports 100% on all four metrics in `apps/api` and `apps/web`; Playwright journeys pass against the
  live stack; CI `unit` + `e2e-api` + `e2e-web` + `coverage-report` green.
- Every `it()` carries a scenario comment.

**Context / preconditions:** P10, P11, P6, P7 (all feature surfaces exist).
**Rules-of-phase:** memory-safe execution (no parallel test agents; capped workers).
**References:** OVERVIEW §17; Appendix C.
**Size:** L.

---

## Phase 13 — Mutation Hardening

**Goal:** Stryker mutation ≥ 95 (mandatory), driven toward 100, on both apps.

**Scope — In:** `apps/api/stryker.config.json` + `apps/web/stryker.config.json`; drive the score up; document
surviving mutants as provable equivalents in `docs/stryker/{BASELINE,HISTORY,IMPLEMENTATION_PLAN}.md`; wire
`mutation.yml` (incremental, PR-changed workspaces) + `mutation-nightly.yml` (full, Monday, opens a drift issue).

**Scope — Out:** docs/release (P14).

**Definition of Done:**

- `stryker run` passes `break: 95` on both apps (api targets 100; web `lib/**` 100, `components/**` driven up);
  survivors documented; `mutation.yml` + `mutation-nightly.yml` green.

**Context / preconditions:** P12.
**Rules-of-phase:** never weaken a gate to pass — fix the test or remove genuinely-dead code; document equivalents.
**References:** Appendix C, D.
**Size:** L.

---

## Phase 14 — Docs, Public-Readiness & Release

**Goal:** complete the doc-set, harden for public, and cut `v0.1.0`.

**Scope — In:** every `docs/*.md` (DASHBOARD, GETTING_STARTED, FEATURES, ARCHITECTURE, ENVIRONMENT, PROVIDERS,
TEMPLATING, MULTI_TENANCY, AUTH_INTEGRATION, DATABASE, DEPLOYMENT, TROUBLESHOOTING, RELEASES); the README badge header;
enforce `audit:exports` + `audit:error-codes`; security hardening (helmet, CSP/HSTS); the **go-public checklist**
(Appendix E — secret-scan clean, branch protection, flip to public); the `release.yml` (OIDC + GHCR images) and the
`v0.1.0` tag.

**Scope — Out:** v0.2 (SMS/Push) — tracked on `next`.

**Definition of Done:**

- All docs present + `markdown-link-check` clean; the Feature Coverage Matrix reconciles against the audit; CI fully
  green including `codeql` + `scorecard` + the security gates; the repo is ready to flip public; `v0.1.0` tagged and the
  release workflow produces images + records RELEASES.md.

**Context / preconditions:** P13.
**Rules-of-phase:** no phase/task references in any committed doc-as-config; security reports go to email per SECURITY.md.
**References:** OVERVIEW §18, §20; Appendix D, E.
**Size:** L.

---

## Appendix A — Environment Variable Registry

Canonical table: [`OVERVIEW.md §9`](./OVERVIEW.md#9-configuration--environment). Every variable is `UPPER_SNAKE_CASE`
(browser vars `NEXT_PUBLIC_`), documented in the root `.env.example`, and **validated by Zod at boot**
(`apps/api/src/config/env.schema.ts`) — a missing/invalid var aborts startup. Production guards: `WEB_ORIGIN` must be
`https://`; managed `DATABASE_URL`/`REDIS_URL` (no loopback) in production.

---

## Appendix B — Library Export → Phase Coverage Map

The contract is the [Feature Coverage Matrix](./OVERVIEW.md#6-feature-coverage-matrix) (61 rows). `scripts/audit-library-exports.mjs`
parses the library's shipped `dist/{server,shared,react}/index.d.ts`, extracts every exported symbol, and
word-boundary-searches `apps/**`, failing CI on any unreferenced export (allow-list `.audit-ignore.json` with a reason).
`scripts/audit-error-codes.mjs` asserts every `NOTIFICATION_ERROR_CODES` key is localized in `apps/web`. Phase → matrix
mapping: P4 (rows 1–6, 10–19, 33, 47–51) · P5 (7–9, 20–42, 52–54, 57) · P6 (60–61) · P7 (3, 58a–c) · P9 (43, 45–46, 50,
60–61) · P10 (15, 18–19, 52–53, 55–56, 58a–c) · P8/P10 (`./shared`, `./react`). Every export lands in at least one
phase's DoD.

---

## Appendix C — Quality Gates

| Gate                | Tool / config                      | Threshold                    | Enforced in                            |
| ------------------- | ---------------------------------- | ---------------------------- | -------------------------------------- |
| Format              | Prettier                           | clean                        | `ci.yml` `lint`, pre-commit            |
| Lint                | ESLint flat (`--max-warnings 0`)   | 0 warnings                   | `ci.yml` `lint`                        |
| Typecheck           | `tsc --noEmit` (all packages)      | 0 errors                     | `ci.yml` `typecheck`                   |
| Unit coverage — api | Jest (`coverageThreshold.global`)  | **100%** all 4 metrics       | `ci.yml` `unit`                        |
| Unit coverage — web | Vitest (`thresholds`)              | **100%** all 4 metrics       | `ci.yml` `unit`                        |
| E2E — api           | supertest (test stack)             | pass                         | `ci.yml` `e2e-api`                     |
| E2E — web           | Playwright                         | pass                         | `ci.yml` `e2e-web`                     |
| Mutation — api      | Stryker (`break`)                  | **≥ 95** (target 100)        | `mutation.yml`, `mutation-nightly.yml` |
| Mutation — web      | Stryker (`break`)                  | **≥ 95** (`lib/**` 100)      | `mutation.yml`, `mutation-nightly.yml` |
| Export usage        | `audit-library-exports.mjs`        | every export referenced      | `ci.yml` `export-usage-check`          |
| Error-code coverage | `audit-error-codes.mjs`            | every code localized         | `ci.yml` `export-usage-check`          |
| Dependency review   | `actions/dependency-review-action` | no high vulns / bad licenses | `ci.yml` (PR)                          |
| Static security     | CodeQL (`security-extended`)       | no new alerts                | `codeql.yml`                           |
| Supply chain        | OpenSSF Scorecard                  | published (informational)    | `scorecard.yml`                        |
| Secret scan         | gitleaks/TruffleHog                | clean                        | `ci.yml` (or `codeql.yml` companion)   |
| Pre-commit          | husky + lint-staged + commitlint   | pass                         | local + `commit-msg`                   |

> **Notes.** _Coverage shim:_ `ignoreCoverageForAllDecorators: true` (Jest) + a spec tsconfig without
> `emitDecoratorMetadata` to kill phantom paramtype branches. _Mutation bar:_ `break: 95` is the mandatory floor per the
> project directive; api targets 100, web `lib/**` 100 with `components/**` (vendored shadcn) driven as high as
> achievable; survivors documented as provable equivalents. _Memory safety:_ `maxWorkers: '50%'` baked into both test
> configs; CI runs each package's coverage as a separate step; never fan out parallel test agents. _Toolchain:_ pnpm
> setup before setup-node; Jest native-ESM `--experimental-vm-modules`; Stryker JSON config.

---

## Appendix D — CI/CD Workflow Matrix

All workflows: `actions/checkout@v5`, `pnpm/action-setup@v4` (pinned), `actions/setup-node@v5` (Node 24, `cache: pnpm`,
**pnpm before node**), `pnpm install --frozen-lockfile`; top-level `permissions: contents: read` (jobs widen only what
they need); `concurrency` cancel-in-progress (except `release`); pinned actions; `timeout-minutes` per job; a placeholder
`DATABASE_URL` so `prisma generate` runs without a DB.

| Workflow                           | Triggers                       | Jobs                                                                                                                                                                                       | Lands                                 |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `ci.yml`                           | PR + push `main`/`next`        | `install` → `lint`, `typecheck`, `unit` (coverage upload), `e2e-api`, `e2e-web` (needs e2e-api), `export-usage-check` (exports + error-codes), `dependency-review` (PR), `coverage-report` | P0 (skeleton) → enriched P2/P5/P6/P12 |
| `codeql.yml`                       | PR + push `main` + weekly cron | `analyze` (JS/TS, `security-extended`, SARIF → Security tab)                                                                                                                               | P0                                    |
| `scorecard.yml`                    | push `main` + weekly cron      | OpenSSF Scorecard (supply-chain, publishes to scorecard.dev)                                                                                                                               | P0                                    |
| `mutation.yml`                     | PR (paths filter)              | `detect` (changed workspace) → `mutation-api` / `mutation-web` (`stryker --incremental`, cached)                                                                                           | P13 (skeleton P0)                     |
| `mutation-nightly.yml`             | cron Mon 03:00 UTC + dispatch  | `full-api` / `full-web` (`stryker --force`); opens a `mutation-drift` issue on failure                                                                                                     | P13                                   |
| `release.yml`                      | tag `v*`                       | `build-and-push` (OIDC, GHCR `…-api`/`…-web` images) → `update-releases-doc` (bot prepends to RELEASES.md)                                                                                 | P14 (validates from P0)               |
| `dependabot.yml` / `renovate.json` | weekly                         | npm + github-actions update PRs (never auto-merge; pins `@bymax-one/nest-notification`)                                                                                                    | P0                                    |

> **Enhancement over the sibling examples.** `nest-logger-example` / `nest-auth-example` ship only `ci`/`mutation`/
> `mutation-nightly`/`release`. Because this repo is **going public and is agent-built**, `codeql.yml`, `scorecard.yml`,
> the `dependency-review` gate, and the secret-scan are added from P0 (the canonical published-`@bymax-one/*` CI set per
> the vault `GitHub-Actions/Bymax-Conventions`).

---

## Appendix E — Go-Public Readiness Checklist

To flip the repo from private to public (gated in P0 for scaffolding, enforced in P14):

- [ ] `LICENSE` (MIT), `SECURITY.md` (report → email, not a public issue), `CODE_OF_CONDUCT.md` (Contributor Covenant
      2.1 by reference), `CONTRIBUTING.md`, `CHANGELOG.md` (with `## [X.Y.Z]` headings), `CLAUDE.md`, `AGENTS.md`.
- [ ] `.github/ISSUE_TEMPLATE/` (bug_report, feature_request, `config.yml` linking security to email) +
      `PULL_REQUEST_TEMPLATE.md` + `CODEOWNERS`.
- [ ] The 4 Copilot review files, customized for this stack (< 4000 chars each, no phase/task references).
- [ ] `README.md` with the badge header (CI, coverage, mutation, license, TS-strict, Node, NestJS, Next, React,
      Tailwind, Prisma) + architecture diagram + the Feature Coverage matrix link.
- [ ] CI fully green incl. `codeql` + `scorecard` + `dependency-review` + secret-scan; **secret scan clean** (no real
      keys — Mailpit/test fixtures only).
- [ ] Branch protection on `main` (PR-only, required checks by name, signed commits, linear history) configured in the
      GitHub UI.
- [ ] `release.yml` OIDC Trusted Publishing / GHCR configured; `v0.1.0` tag cut.

---

## Update Protocol

When a phase changes state:

1. Set the phase's **Status** emoji (and **Last updated** date) in the [Phase dashboard](#phase-dashboard) — `🔄` when
   started, `👀` in PR/review, `✅` only after merge with every DoD bullet met and CI green; `🟡 Partial` if some tasks
   are done but the DoD is not; `⛔` if blocked.
2. Update the phase's `Progress` cell (`done / total` tasks) once its Layer-3 task file exists.
3. Recompute **Overall progress** in [Progress](#progress) (`N / 15 phases`, %), and set **Active phase** / **Blocked**.
4. Mirror the change in the phase's `docs/tasks/phase-NN-*.md` header counter and task-index rows (per that file's own
   completion protocol).
5. **Never mark a phase `✅` while any Definition-of-Done bullet is unmet or any required CI check is red** — use `🟡`.
6. Commit the dashboard update with `docs(plan): <phase> → <status>` (no `Co-Authored-By`).

---

_End of the development plan for `nest-notification-example`._
