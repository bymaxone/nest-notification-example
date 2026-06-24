# Phase 14 — Docs, Public-Readiness & Release

> **Status**: 🔄 In Progress · **Progress**: 6 / 7 tasks · **Last updated**: 2026-06-24
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P14
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

This is the **final phase**. By now the product is feature-complete and green: the API (P3–P7) and the console
(P8–P11) exercise every public export of `@bymax-one/nest-notification`, the suites pass at **100% coverage** (P12),
and **Stryker** clears the **≥ 95** mutation floor (P13). The CI/CD pipeline, the security workflows (`codeql`,
`scorecard`, secret-scan), the `release.yml` skeleton, the audit-script stubs, and every go-public governance file
were all scaffolded back in **P0** and have been growing green ever since.

What is still **missing** is the **human-facing doc-set**. The repository carries `OVERVIEW.md`, `DEVELOPMENT_PLAN.md`,
`design_system.html`, and the per-phase task files — but **none** of the sibling `docs/*.md` that a public reference
app must ship (`GETTING_STARTED`, `FEATURES`, `ARCHITECTURE`, `ENVIRONMENT`, `PROVIDERS`, `TEMPLATING`,
`MULTI_TENANCY`, `AUTH_INTEGRATION`, `DATABASE`, `DEPLOYMENT`, `TROUBLESHOOTING`, `DASHBOARD`, `RELEASES`), and the
root `README.md` is still the pre-implementation P0 badge stub.

Phase 14 produces the **finished, public-ready repository**: it authors every `docs/*.md` analog re-themed for the
notification domain, refreshes the `README` against the now-real surface, **reconciles** the OVERVIEW §6 Feature
Coverage Matrix against the export/error-code audits (making `audit:exports` + `audit:error-codes` pass on the real
tree), runs a **security-hardening pass** (helmet/CSP/HSTS, dependency review, secret-scan clean), walks the
**go-public checklist** (Appendix E), and finally cuts **`v0.1.0`** so `release.yml` builds + pushes the GHCR images
and records the row in `RELEASES.md`. When P14 is done the repo can be flipped from private to public.

The gold sources for the doc-set are the sibling repos — copy each file's **shape and voice**, then re-theme every
line for notification (email + OTP, providers/renderers, multi-tenant masking, audit log) rather than logging:
`nest-logger-example` and `nest-auth-example` (both under `~/Documents/MyApps/bymax-one/`).

---

## Rules-of-phase

1. **Docs match the real surface, not the blueprint** — every command, URL, route, env var, and code snippet in a
   `docs/*.md` must match the **shipped** `apps/api` / `apps/web` exactly (the scripts that exist, the ports in
   OVERVIEW §8, the routes in §5). Reconcile against the code, never paraphrase the OVERVIEW from memory.
2. **No phase/task references in any committed doc-as-config** — the `docs/*.md`, `README.md`, `RELEASES.md`,
   `CHANGELOG.md`, and `.github/**` are timeless. A doc-**section** ref (`OVERVIEW.md §6`) is fine; a plan-**stage**
   ref (`Phase 14`, `P14-3`) is not. (This planning file under `docs/tasks/` is exempt — it may name phases freely.)
3. **Security reports go to email per `SECURITY.md`** — never a public issue; cross-link that channel from any doc
   that mentions reporting a vulnerability.
4. **The audit is the contract** — `audit:exports` (every public export referenced in `apps/**`) and
   `audit:error-codes` (every `NOTIFICATION_ERROR_CODES` key localized in `apps/web`) must both exit 0 on the real
   tree; the OVERVIEW §6 matrix is regenerated **from** the audit output, not hand-edited to match.
5. **Never log OTP codes / unmasked PII** — the security pass must preserve the never-log-codes + `maskRecipient`
   invariants (OVERVIEW §13); helmet/CSP must not break the console or the SSE stream.
6. **`v0.1.0` is the first tag** — the annotated tag points at the **release commit**; it is **not pushed** until the
   phase is merged and the library-availability prerequisite is met. `CHANGELOG.md` gets the matching `## [0.1.0]`
   heading first.
7. **English-only, Conventional Commits, no `Co-Authored-By` trailer.** `markdown-link-check` must pass on every doc.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §5 Repository Layout (the `docs/*` set + the target tree), §6 Feature Coverage
  Matrix (the audit contract), §8 Local Stack (commands + ports), §9 Configuration, §13 Multi-Tenant Security,
  §14 Auth coexistence, §18 Deployment Notes, §19 Versioning, §20 Contributing, §21 License/Status.
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P14, §2 Global Conventions, §3 Autonomous Execution Model,
  Appendix B (export→matrix map), Appendix C (Quality Gates), Appendix D (CI/CD Matrix), Appendix E (Go-Public).
- Sibling gold sources (copy the shape + voice, re-theme for notification):
  `~/Documents/MyApps/bymax-one/nest-logger-example/docs/{GETTING_STARTED,FEATURES,ARCHITECTURE,ENVIRONMENT,
DEPLOYMENT,TROUBLESHOOTING,DATABASE,RELEASES,DASHBOARD}.md` + `README.md` + `.github/workflows/release.yml`;
  `~/Documents/MyApps/bymax-one/nest-auth-example/docs/{GETTING_STARTED,FEATURES,ARCHITECTURE,EMAIL,ENVIRONMENT,
DEPLOYMENT,TROUBLESHOOTING,RELEASES}.md`.
- `/bymax-workflow:standards` skill — universal coding/docs rules.
- Vault: [[Example-App-Standard]], [[Bymax-Lib-Standards/README-Badges]], [[GitHub-Actions/Bymax-Conventions]].

---

## Task index

| ID   | Task                                                                                | Status  | Priority | Size | Depends on             |
| ---- | ----------------------------------------------------------------------------------- | ------- | -------- | ---- | ---------------------- |
| 14.1 | `GETTING_STARTED.md` + `FEATURES.md` (front door + feature tour)                    | ✅ Done | P0       | L    | —                      |
| 14.2 | `ARCHITECTURE.md` + `DATABASE.md` + `DASHBOARD.md` (deep dives)                     | ✅ Done | P0       | L    | 14.1                   |
| 14.3 | `ENVIRONMENT.md` + `PROVIDERS.md` + `TEMPLATING.md` (config & extension)            | ✅ Done | P0       | L    | 14.1                   |
| 14.4 | `MULTI_TENANCY.md` + `AUTH_INTEGRATION.md` + `DEPLOYMENT.md` + `TROUBLESHOOTING.md` | ✅ Done | P0       | L    | 14.1                   |
| 14.5 | `README.md` badge header + `RELEASES.md` + `CHANGELOG.md` `[0.1.0]`                 | ✅ Done | P0       | M    | 14.1, 14.2, 14.3, 14.4 |
| 14.6 | Audit reconciliation + security-hardening pass (§6 matrix, helmet/CSP, deps)        | ✅ Done | P0       | L    | 14.5                   |
| 14.7 | Go-public gate + `v0.1.0` release (link-check, Appendix E, tag, RELEASES row)       | 📋 ToDo | P0       | M    | 14.6                   |

---

## Tasks

### Task 14.1 — `GETTING_STARTED.md` + `FEATURES.md` (front door + feature tour)

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: —

#### Description

Write the two entry-point docs: the 5-minute quickstart (clean clone → first sent email in Mailpit + first verified
OTP) and the guided feature tour that fires every library feature and shows it working, plus the end-to-end journeys.

#### Acceptance criteria

- [ ] `docs/GETTING_STARTED.md` — H1 + one-line promise; **Prerequisites** (Node ≥ 24 / pnpm 11.x / Docker Compose v2
      **plus** the sibling `../nest-notification` checkout + `pnpm build --watch`, the lib is pre-publish); a **Quick
      start** fenced block with the **real** ordered commands (build linked lib → `pnpm install` → `pnpm infra:up` →
      `cp .env.example apps/api/.env` → `pnpm --filter @nest-notification-example/api db:migrate` + `db:seed` → `pnpm dev`); a **What you should see**
      table with real URLs (web `:3000`?/console, API `/health`, Mailpit `:8025`); a **first email + first OTP**
      `curl` walkthrough; a "fire it from the Trigger Center instead" note; a **Common snags** tail (3–4 rows) linking into
      `TROUBLESHOOTING.md`.
- [ ] `docs/FEATURES.md` — a guided tour mapping each OVERVIEW §6 matrix group to its `curl` + its console surface
      (OTP generate/verify/resend/consume, email send/send-template, dispatch/channels, audit logs/stream/aggregate,
      provider/renderer matrix, roadmap rejection, multi-tenant masking) **and** every end-to-end journey from OVERVIEW §16.
- [ ] Every internal link is relative `./FILE.md#anchor` and resolves; ports/routes/commands match the shipped code.

#### Files to create / modify

- `docs/GETTING_STARTED.md`, `docs/FEATURES.md`

#### Agent prompt

````
You are a senior developer-experience / technical-writer engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib: multi-tenant, pluggable providers/renderers, audit log, React hooks). pnpm monorepo (apps/api
NestJS 11 + apps/web Next.js 16 / React 19), Node 24, TypeScript 5.9 strict; feature-complete and green at this point.

CURRENT PHASE: 14 (Docs, Public-Readiness & Release) — Task 14.1 of 7 (FIRST)

PRECONDITIONS
- P0–P13 are merged: the apps/api routes (/otp/*, /email/*, /dispatch, /channels, /audit/*, /admin/try-configure-*,
  /debug/key, /health) and apps/web console exist and pass at 100% coverage + Stryker ≥95. The root scripts
  (infra:up/down, dev, db:migrate, db:seed) and docker-compose (postgres+redis+mailpit) exist. No docs/*.md narrative
  prose exists yet beyond OVERVIEW.md / DEVELOPMENT_PLAN.md.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "8. Local Stack & Memory-Safe Run" (the exact commands + ports), § "5. Repository Layout" (routes
  + the docs/* set), § "6. Feature Coverage Matrix" (the groups the tour must cover), § "16. Demonstrated Journeys".
- docs/DEVELOPMENT_PLAN.md § "Phase 14" (scope) + § "2. Global Conventions" (versions, English-only, no phase refs).
- Gold sources (copy the shape + terse numbered voice, RE-THEME every line for email/OTP — not logging/traces):
  ~/Documents/MyApps/bymax-one/nest-logger-example/docs/{GETTING_STARTED.md,FEATURES.md} and
  ~/Documents/MyApps/bymax-one/nest-auth-example/docs/{GETTING_STARTED.md,FEATURES.md}.

TASK
Author the front-door quickstart and the guided feature tour so a newcomer goes from clone to a first email in
Mailpit + a first verified OTP, then sees every library feature exercised with both a curl and a console surface.

DELIVERABLES
1. `docs/GETTING_STARTED.md` — H1 + promise; Prerequisites (Node ≥24 / pnpm 11.x / Docker v2 + the sibling
   `../nest-notification` `pnpm build --watch`, lib is pre-publish — cross-link OVERVIEW §7); a Quick-start fenced
   block with the REAL scripts that exist (verify against root package.json + apps/api package.json):
   ```bash
   cd ../nest-notification && pnpm install && pnpm build --watch   # keep running
   # repo root:
   pnpm install
   pnpm infra:up                         # postgres + redis + mailpit, --wait
   cp .env.example apps/api/.env
   pnpm --filter @nest-notification-example/api db:migrate && pnpm --filter @nest-notification-example/api db:seed
   pnpm dev
   ```
   a "What you should see" table (web console URL, API `/health`, Mailpit inbox `http://localhost:8025`); a first
   email + first OTP walkthrough (`curl -X POST .../email/send …` lands in Mailpit; `curl .../otp/generate` then
   `/otp/verify`); a "fire it from the Trigger Center instead" note → FEATURES.md; a Common-snags tail (3–4 rows)
   linking into TROUBLESHOOTING.md (e.g. "email never arrives", "Cannot find module '@bymax-one/nest-notification'",
   "OTP verify always fails", "`pnpm dev` freezes the machine").
2. `docs/FEATURES.md` — a guided tour: one section per OVERVIEW §6 group, each with the curl + the console surface
   that drives it, then a "Journeys" section reproducing OVERVIEW §16 end-to-end (incl. the multi-tenant masking proof
   and the never-log-codes green check).

Constraints:
- Follow /bymax-workflow:standards. English-only, timeless — NO Phase/Task/plan-stage references in either file.
- Every command/route/port/URL MUST match the shipped apps (read the code if unsure); do not invent a script.
- Relative `./FILE.md#anchor` links only; forward-links to docs authored in 14.2–14.4 are allowed (they will exist).

Verification:
- `ls docs/GETTING_STARTED.md docs/FEATURES.md` — expected: both present.
- `npx markdown-link-check docs/GETTING_STARTED.md --config .markdown-link-check.json` — expected: no dead links
  (forward-links to not-yet-written sibling docs are config-ignored or will resolve after 14.4; re-run in 14.7).
- `grep -riE "phase [0-9]|task [0-9]|P1[0-4]-[0-9]" docs/GETTING_STARTED.md docs/FEATURES.md` — expected: no matches.

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 7` and Last updated to today.
4. Update the P14 row Progress to `1 / 7` in docs/DEVELOPMENT_PLAN.md (and its Last updated).
5. Append to Completion log: `- 14.1 ✅ <YYYY-MM-DD> — GETTING_STARTED + FEATURES docs`.
6. Commit: `docs: getting-started + features guide` (no Co-Authored-By).
````

---

### Task 14.2 — `ARCHITECTURE.md` + `DATABASE.md` + `DASHBOARD.md` (deep dives)

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: 14.1

#### Description

Author the three structural deep-dives: the delivery pipeline + module boundaries (public vs internal), the
`NotificationLog` audit schema + how to query the audit tier, and the full console build/design spec.

#### Acceptance criteria

- [ ] `docs/ARCHITECTURE.md` — the end-to-end notification delivery pipeline (controller → service façade →
      provider/renderer → audit interceptor → `NotificationLog`), the `forRootAsync({ useFactory })` wiring, the
      module boundaries (which `@bymax-one/nest-notification` exports are public vs internal), and an ASCII diagram
      mirroring OVERVIEW §3.
- [ ] `docs/DATABASE.md` — the `NotificationLog` (audit) + `Tenant` + demo `PendingUser` Prisma schema, the
      `@prisma/adapter-pg` client, the keyset-pagination + aggregate queries the audit read-API uses, and how recipient
      masking is persisted.
- [ ] `docs/DASHBOARD.md` — the `apps/web` console: information architecture (Overview · Trigger Center · Audit
      Explorer · OTP · Providers · Roadmap · Settings), global controls (tenant switcher + role), the SSE live-tail
      architecture, and the **verbatim** design-system note (forced dark, orange `#ff6224` glass, Geist + mono).
- [ ] All three cross-link each other + `OVERVIEW.md`; diagrams/routes/tables match the shipped code.

#### Files to create / modify

- `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DASHBOARD.md`

#### Agent prompt

```
You are a senior software-architecture / technical-writer engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib,
multi-tenant, pluggable providers/renderers, Prisma audit log, React hooks). pnpm monorepo (apps/api NestJS 11 +
apps/web Next.js 16), Node 24, TS 5.9 strict; feature-complete and green.

CURRENT PHASE: 14 (Docs, Public-Readiness & Release) — Task 14.2 of 7 (MIDDLE)

PRECONDITIONS
- Task 14.1 done (GETTING_STARTED.md + FEATURES.md exist). The apps/api pipeline (notification.config.ts, the custom
  Nodemailer IEmailProvider, the PrismaNotificationLogRepository, the NotificationAuditInterceptor, the template
  registry) and the apps/web console (Overview/Trigger/Explorer/OTP/Providers/Roadmap/Settings) are shipped.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "3. Architecture at a Glance", § "5. Repository Layout", § "11. The Notification Delivery
  Pipeline (Deep Dive)", § "15. Audit Log & Delivery Tracking", § "10. The Demo Domain & Notification Console".
- docs/DEVELOPMENT_PLAN.md § "Phase 14" + § "2. Global Conventions".
- Gold sources (shape + voice, RE-THEME for notification): ~/Documents/MyApps/bymax-one/nest-logger-example/docs/
  {ARCHITECTURE.md, DATABASE.md, DASHBOARD.md} and ~/Documents/MyApps/bymax-one/nest-auth-example/docs/
  {ARCHITECTURE.md, DATABASE.md}.

TASK
Author the three deep-dive docs (pipeline + boundaries, audit schema + queries, the console build/design spec).

DELIVERABLES
1. `docs/ARCHITECTURE.md` — the delivery pipeline (controller → NotificationService façade → IEmailProvider +
   IEmailTemplateRenderer + IOtpStorage → NotificationAuditInterceptor → NotificationLog), the forRootAsync useFactory
   wiring, public-vs-internal export boundary table, an ASCII diagram mirroring OVERVIEW §3, a "See also" tail.
2. `docs/DATABASE.md` — the Prisma models (NotificationLog audit, Tenant, demo PendingUser), the @prisma/adapter-pg
   driver-adapter client, the keyset (`/audit/logs`) + aggregate (`/audit/aggregate`) query shapes, masked-recipient
   persistence, migration/seed commands (match apps/api scripts).
3. `docs/DASHBOARD.md` — apps/web information architecture, global controls (tenant switcher + header-role RBAC), the
   SSE live-tail architecture (`/audit/stream`), and the design-system-verbatim note.

Constraints:
- Follow /bymax-workflow:standards. English-only, timeless — NO Phase/Task/plan-stage references.
- Schema fields, route paths, page names MUST match the shipped code (read apps/api/prisma + apps/web/app if unsure).
- Relative `./FILE.md#anchor` links; cross-link the three docs + OVERVIEW.

Verification:
- `ls docs/ARCHITECTURE.md docs/DATABASE.md docs/DASHBOARD.md` — expected: all present.
- `npx markdown-link-check docs/ARCHITECTURE.md docs/DATABASE.md docs/DASHBOARD.md --config .markdown-link-check.json`
  — expected: no dead links (re-run the full set in 14.7).
- `grep -riE "phase [0-9]|task [0-9]|P1[0-4]-[0-9]" docs/ARCHITECTURE.md docs/DATABASE.md docs/DASHBOARD.md`
  — expected: no matches.

Completion Protocol:
1. Set 14.2 Status to ✅ (block + Task index row); tick the acceptance checkboxes.
2. Header Progress → `2 / 7`, Last updated → today.
3. Update the P14 row Progress to `2 / 7` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 14.2 ✅ <YYYY-MM-DD> — architecture + database + dashboard docs`.
5. Commit: `docs: architecture, database, and console deep-dives` (no Co-Authored-By).
```

---

### Task 14.3 — `ENVIRONMENT.md` + `PROVIDERS.md` + `TEMPLATING.md` (config & extension)

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: 14.1

#### Description

Author the configuration + extension docs: the full env-var reference (matching the Zod schema), the
bring-your-own-provider guide (`IEmailProvider` / `IOtpStorage`), and the renderer/templating contract.

#### Acceptance criteria

- [ ] `docs/ENVIRONMENT.md` — every variable from the Zod env schema (`apps/api/src/config/env.schema.ts`) +
      `NEXT_PUBLIC_*` browser vars, each with type/default/effect, reconciled against OVERVIEW §9 and `.env.example`; the
      production guards (`WEB_ORIGIN` must be `https://`; managed `DATABASE_URL`/`REDIS_URL` in production).
- [ ] `docs/PROVIDERS.md` — how to write & wire a custom `IEmailProvider` (the shipped Nodemailer→Mailpit demo +
      the opt-in Resend path), a custom `IOtpStorage`, and the provider/channel matrix; the BYO-provider lesson.
- [ ] `docs/TEMPLATING.md` — the `IEmailTemplateRenderer` contract, the canonical templates (`otp_code`, `welcome`),
      the handlebars/mjml/react-email renderer demos, i18n fallback, and the XSS-escape guarantee.
- [ ] All three cross-link `OVERVIEW.md` + each other; every variable/interface/template name matches the code.

#### Files to create / modify

- `docs/ENVIRONMENT.md`, `docs/PROVIDERS.md`, `docs/TEMPLATING.md`

#### Agent prompt

```
You are a senior platform / technical-writer engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib,
multi-tenant, pluggable IEmailProvider/IOtpStorage/IEmailTemplateRenderer, audit log). pnpm monorepo (apps/api +
apps/web), Node 24, TS 5.9 strict; feature-complete and green.

CURRENT PHASE: 14 (Docs, Public-Readiness & Release) — Task 14.3 of 7 (MIDDLE)

PRECONDITIONS
- Task 14.1 done. apps/api ships: the Zod env schema (config/env.schema.ts), the custom Nodemailer IEmailProvider →
  Mailpit (Resend opt-in via env), the Redis IOtpStorage path, the handlebars/mjml/react-email renderers, and the
  template registry (otp_code, welcome). `.env.example` exists at the repo root.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "9. Configuration & Environment" (the canonical env table + production guards), § "12. Channels
  & Providers Showcase", § "7. Library Consumption" (the IEmailProvider/IOtpStorage/renderer interfaces).
- docs/DEVELOPMENT_PLAN.md § "Phase 14", § "Appendix A — Environment Variable Registry", § "2. Global Conventions".
- The live contract: apps/api/src/config/env.schema.ts + the repo-root .env.example (the source of truth for the env
  table — reconcile against these, not from memory).
- Gold sources (shape + voice, RE-THEME): ~/Documents/MyApps/bymax-one/nest-logger-example/docs/{ENVIRONMENT.md,
  DESTINATIONS.md} and ~/Documents/MyApps/bymax-one/nest-auth-example/docs/{ENVIRONMENT.md,EMAIL.md}.

TASK
Author the configuration + extension docs (full env reference, BYO-provider guide, renderer/templating contract).

DELIVERABLES
1. `docs/ENVIRONMENT.md` — a complete table of every variable in env.schema.ts + `.env.example` + each `NEXT_PUBLIC_*`
   browser var, with type / default / effect / required-in-prod; the production guards; a "fail-fast at boot" note
   (a missing/invalid var aborts startup).
2. `docs/PROVIDERS.md` — write-and-wire a custom IEmailProvider (the shipped Nodemailer→Mailpit class as the worked
   example, the Resend opt-in path), a custom IOtpStorage (Redis vs in-memory), the provider/channel matrix, and the
   bring-your-own-provider lesson (zero-credential default).
3. `docs/TEMPLATING.md` — the IEmailTemplateRenderer contract, the canonical templates (otp_code, welcome), the
   handlebars / mjml / react-email renderer demos, i18n fallback, and the XSS-escape guarantee.

Constraints:
- Follow /bymax-workflow:standards. English-only, timeless — NO Phase/Task/plan-stage references.
- The env table MUST match env.schema.ts + .env.example exactly (no fabricated vars/defaults). Interface + template
  names MUST match the shipped code. Relative `./FILE.md#anchor` links.

Verification:
- `ls docs/ENVIRONMENT.md docs/PROVIDERS.md docs/TEMPLATING.md` — expected: all present.
- Cross-check: every key in `.env.example` appears in ENVIRONMENT.md (e.g.
  `comm -23 <(grep -oE '^[A-Z_]+' .env.example | sort -u) <(grep -oE '[A-Z_]{3,}' docs/ENVIRONMENT.md | sort -u)`
  prints nothing).
- `grep -riE "phase [0-9]|task [0-9]|P1[0-4]-[0-9]" docs/ENVIRONMENT.md docs/PROVIDERS.md docs/TEMPLATING.md`
  — expected: no matches.

Completion Protocol:
1. Set 14.3 Status to ✅ (block + Task index row); tick the acceptance checkboxes.
2. Header Progress → `3 / 7`, Last updated → today.
3. Update the P14 row Progress to `3 / 7` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 14.3 ✅ <YYYY-MM-DD> — environment + providers + templating docs`.
5. Commit: `docs: environment, providers, and templating guides` (no Co-Authored-By).
```

---

### Task 14.4 — `MULTI_TENANCY.md` + `AUTH_INTEGRATION.md` + `DEPLOYMENT.md` + `TROUBLESHOOTING.md`

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: 14.1

#### Description

Author the security/ecosystem/operations docs: the multi-tenant privacy guarantees, the production deployment
checklist, and the symptom→cause→fix troubleshooting guide — and **verify/reconcile** the already-authored
`AUTH_INTEGRATION.md` (the `@bymax-one/nest-auth` coexistence seam) against the shipped adapter, do not re-author it.

#### Acceptance criteria

- [ ] `docs/MULTI_TENANCY.md` — the sha256 storage keys (`sha256(tenantId:recipient)`), the `tenantIdResolver`
      anti-spoofing model (audit tenant is resolver-derived, not body-derived), `maskRecipient`, and the never-log-codes
      invariant + its regression-test proof (OVERVIEW §13).
- [ ] `docs/AUTH_INTEGRATION.md` is **verified/reconciled** (it was authored alongside the adapter, not re-authored
      here): confirm it still matches the shipped seam — how `nest-notification` composes with `@bymax-one/nest-auth` (the
      `NotificationAuthEmailProvider` adapter, the two-Redis-namespace boundary, "why there is no OTP conflict") per
      OVERVIEW §14 — and fix only drift (stale names, routes, links).
- [ ] `docs/DEPLOYMENT.md` — the production checklist from OVERVIEW §18 (managed Postgres/Redis, Resend + verified
      `MAIL_FROM`, gateway-verified `tenantIdResolver`, `audit.swallowErrors: true`, shutdown hooks, `WEB_ORIGIN` https,
      the two GHCR container images + `release.yml`), and the version pins.
- [ ] `docs/TROUBLESHOOTING.md` — symptom → cause → fix entries keyed to the real `NOTIFICATION_ERROR_CODES` +
      common snags (email not arriving / Mailpit, OTP verify fails / TTL, `Cannot find module …`, CORS/`Retry-After`,
      the memory-safe run recipe), each cross-linked from `GETTING_STARTED.md`.
- [ ] All four cross-link `OVERVIEW.md`; the troubleshooting anchors match the `GETTING_STARTED.md` Common-snags links.

#### Files to create / modify

- `docs/MULTI_TENANCY.md`, `docs/DEPLOYMENT.md`, `docs/TROUBLESHOOTING.md` (create); `docs/AUTH_INTEGRATION.md`
  (verify/reconcile only — already authored with the adapter)

#### Agent prompt

```
You are a senior application-security / SRE / technical-writer engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib,
multi-tenant, audit log, optional @bymax-one/nest-auth seam). pnpm monorepo (apps/api + apps/web), Node 24, TS 5.9
strict; feature-complete and green; two GHCR container images shipped via release.yml on a v* tag.

CURRENT PHASE: 14 (Docs, Public-Readiness & Release) — Task 14.4 of 7 (MIDDLE)

PRECONDITIONS
- Task 14.1 done. apps/api ships: sha256 storage keys + GET /debug/key, maskRecipient, the NotificationAuditInterceptor
  (resolver-derived tenant), the never-log-codes regression test, the optional NotificationAuthEmailProvider adapter,
  helmet/CORS + Retry-After, and the NOTIFICATION_ERROR_CODES catalog. GETTING_STARTED.md links into this file's anchors.
- `docs/AUTH_INTEGRATION.md` ALREADY EXISTS — it was authored alongside the NotificationAuthEmailProvider adapter.
  This task VERIFIES/RECONCILES it against the shipped adapter; it does NOT re-author it.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "13. Multi-Tenant Security & Recipient Privacy", § "14. Ecosystem Fit — Coexistence with
  @bymax-one/nest-auth", § "18. Deployment Notes", § "8. Local Stack & Memory-Safe Run".
- docs/DEVELOPMENT_PLAN.md § "Phase 14" + § "2. Global Conventions" (security defaults row) + § "Appendix E".
- Gold sources (shape + voice, RE-THEME for notification): ~/Documents/MyApps/bymax-one/nest-logger-example/docs/
  {DEPLOYMENT.md, TROUBLESHOOTING.md, REDACTION.md} and ~/Documents/MyApps/bymax-one/nest-auth-example/docs/
  {DEPLOYMENT.md, TROUBLESHOOTING.md, REDIS.md}.

TASK
Author the security, operations, and troubleshooting docs, and verify/reconcile the already-authored ecosystem doc
(AUTH_INTEGRATION.md) against the shipped adapter.

DELIVERABLES
1. `docs/MULTI_TENANCY.md` — sha256(tenantId:recipient) keys (+ the /debug/key proof), the tenantIdResolver
   anti-spoofing model, maskRecipient, the never-log-codes invariant + its `JSON.stringify(auditEntry).includes(code)
   === false` test proof.
2. `docs/AUTH_INTEGRATION.md` — VERIFY/RECONCILE the existing file (do NOT re-author): read the shipped
   NotificationAuthEmailProvider adapter + OVERVIEW §14, then confirm the doc still matches — the adapter, the
   `notification:` vs `auth:` Redis namespace boundary, the "no OTP conflict" explanation (different layers/ownership) —
   and correct only drift (stale names, routes, anchors, dead links). Leave it untouched if it is already accurate.
3. `docs/DEPLOYMENT.md` — the OVERVIEW §18 production checklist (managed Postgres/Redis, Resend + verified MAIL_FROM,
   gateway-verified tenantIdResolver, audit.swallowErrors true, enableShutdownHooks, WEB_ORIGIN https + Retry-After,
   the two GHCR images via release.yml), a Container section, and Version pins.
4. `docs/TROUBLESHOOTING.md` — symptom→cause→fix sections, one per real failure mode + each NOTIFICATION_ERROR_CODES
   class an operator can hit; the anchors MUST match the links GETTING_STARTED.md points at (e.g.
   `#email-never-arrives`, `#otp-verify-always-fails`, `#cannot-find-module-bymax-onenest-notification`,
   `#pnpm-dev-freezes-the-machine`).

Constraints:
- Follow /bymax-workflow:standards. English-only, timeless — NO Phase/Task refs. Security reports → email per
  SECURITY.md (cross-link, never a public issue). Codes/PII must never be shown unmasked in any example.
- Names (codes, tokens, routes) MUST match the shipped code. Relative `./FILE.md#anchor` links.

Verification:
- `ls docs/MULTI_TENANCY.md docs/AUTH_INTEGRATION.md docs/DEPLOYMENT.md docs/TROUBLESHOOTING.md` — all present
  (AUTH_INTEGRATION.md pre-existed; this task only reconciles it).
- AUTH_INTEGRATION.md still matches the shipped NotificationAuthEmailProvider adapter (names/routes/anchors verified;
  link-check passes for it).
- The anchors referenced by GETTING_STARTED.md resolve into TROUBLESHOOTING.md (link-check passes for that pair).
- `grep -riE "phase [0-9]|task [0-9]|P1[0-4]-[0-9]" docs/MULTI_TENANCY.md docs/AUTH_INTEGRATION.md docs/DEPLOYMENT.md docs/TROUBLESHOOTING.md`
  — expected: no matches.

Completion Protocol:
1. Set 14.4 Status to ✅ (block + Task index row); tick the acceptance checkboxes.
2. Header Progress → `4 / 7`, Last updated → today.
3. Update the P14 row Progress to `4 / 7` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 14.4 ✅ <YYYY-MM-DD> — multi-tenancy + auth + deployment + troubleshooting docs`.
5. Commit: `docs: multi-tenancy, auth integration, deployment, troubleshooting` (no Co-Authored-By).
```

---

### Task 14.5 — `README.md` badge header + `RELEASES.md` + `CHANGELOG.md` `[0.1.0]`

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 14.1, 14.2, 14.3, 14.4

#### Description

Refresh the root `README` against the now-real surface (badge header, quick start, feature checklist, architecture
diagram, the full Documentation table), seed `RELEASES.md`, and write the `## [0.1.0]` CHANGELOG entry.

#### Acceptance criteria

- [ ] `README.md` — centered `<h1>` + tagline; the badge row (CI, coverage, mutation, license, TS-strict, Node 24,
      NestJS 11, Next 16, React 19, Tailwind 4, Prisma 7, `@bymax-one/nest-notification` `^0.1.0`); a nav-link row;
      `## Overview`; `## Quick start` matching `GETTING_STARTED.md`; an ASCII architecture diagram (mirror OVERVIEW §3);
      a `## What's inside` feature checklist; a `## Documentation` table linking **every** `docs/*.md` authored in
      14.1–14.4 + OVERVIEW/DEVELOPMENT_PLAN; `## License`.
- [ ] `docs/RELEASES.md` — the Branch→library-version table (`main` → `^0.1.0`, `next` → v0.2 SMS/Push) + a
      Tested-version log table with the `_pending_ / _pre-release_` seed row the `release.yml` bot prepends to.
- [ ] `CHANGELOG.md` — a `## [0.1.0] - <date>` section under `## [Unreleased]` summarizing the initial public release.
- [ ] `npx markdown-link-check README.md` passes (badge endpoints allow-listed per the config).

#### Files to create / modify

- `README.md`, `docs/RELEASES.md`, `CHANGELOG.md`

#### Agent prompt

```
You are a senior developer-experience / release-documentation engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
pnpm monorepo (apps/api NestJS 11 + apps/web Next.js 16 / React 19), Node 24, TS 5.9 strict, Tailwind 4, Prisma 7;
100% coverage + Stryker ≥95; two GHCR images via release.yml on a v* tag.

CURRENT PHASE: 14 (Docs, Public-Readiness & Release) — Task 14.5 of 7 (MIDDLE)

PRECONDITIONS
- Tasks 14.1–14.4 done: every docs/*.md exists (GETTING_STARTED, FEATURES, ARCHITECTURE, DATABASE, DASHBOARD,
  ENVIRONMENT, PROVIDERS, TEMPLATING, MULTI_TENANCY, AUTH_INTEGRATION, DEPLOYMENT, TROUBLESHOOTING). The P0 README is a
  pre-implementation badge stub; CHANGELOG.md has `## [Unreleased]`; RELEASES.md does not exist yet.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "3. Architecture at a Glance" (the ASCII diagram), § "5. Repository Layout" (the docs/* set the
  Documentation table links), § "19. Versioning & Release Tracking", § "21. License, Attribution & Status".
- docs/DEVELOPMENT_PLAN.md § "Phase 14" + § "Appendix E — Go-Public Readiness Checklist" (the README badge list).
- Gold sources (copy the badge house-style + Documentation-table pattern, RE-THEME): vault
  [[Bymax-Lib-Standards/README-Badges]]; ~/Documents/MyApps/bymax-one/nest-logger-example/{README.md, docs/RELEASES.md}.
- The current root README.md + CHANGELOG.md (the stubs to refresh).

TASK
Refresh the README against the real surface, seed RELEASES.md, and write the CHANGELOG [0.1.0] entry.

DELIVERABLES
1. `README.md` — centered `<h1 align="center">nest-notification-example</h1>` + a `<p align="center">` tagline
   (email + OTP notification reference app); the shields.io badge row (CI status, coverage, mutation, license MIT,
   TypeScript-strict, Node ≥24, NestJS 11, Next.js 16, React 19, Tailwind 4, Prisma 7, and a
   `@bymax-one/nest-notification ^0.1.0` badge); a nav-link row (Library · Quick Start · Features · Architecture ·
   Docs); `## ✨ Overview`; `## 🚀 Quick start` (mirroring GETTING_STARTED.md exactly); a `## 🏗️ Architecture` ASCII
   diagram (mirror OVERVIEW §3); a `## ✅ What's inside` checklist (OTP, email, dispatch, audit, providers/renderers,
   multi-tenant masking, roadmap rejection, the React hooks, the optional auth seam); a `## 📖 Documentation` table
   linking every docs/*.md + OVERVIEW + DEVELOPMENT_PLAN; `## License` (MIT © Bymax One).
2. `docs/RELEASES.md` — Branch→library-version table (`main` `^0.1.0` local link→published; `next` v0.2 SMS/Push) +
   a "Tested-version log" table seeded with `| _pending_ | _pre-release_ | `0.1.0` (local link:/file:) | … |` (the
   exact row shape the release.yml bot's regex prepends above — match nest-logger-example/docs/RELEASES.md).
3. `CHANGELOG.md` — add `## [0.1.0] - <YYYY-MM-DD>` under `## [Unreleased]`: initial public release (the API surface,
   the console, 100% coverage + Stryker ≥95, the GHCR images).

Constraints:
- Follow /bymax-workflow:standards. English-only, timeless — NO Phase/Task refs in any of these committed files.
- The RELEASES.md "Tested-version log" seed row MUST match the release.yml prepend regex (read
  ~/Documents/MyApps/bymax-one/nest-logger-example/.github/workflows/release.yml update-releases-doc step and the
  sibling RELEASES.md to copy the exact `| _pending_` row shape). Badges may point at the live CI.

Verification:
- `ls README.md docs/RELEASES.md && grep -q "0.1.0" CHANGELOG.md && echo ok` — expected: prints `ok`.
- `npx markdown-link-check README.md --config .markdown-link-check.json` — expected: no dead links (every docs/*.md it
  links now exists).
- `grep -riE "phase [0-9]|task [0-9]|P1[0-4]-[0-9]" README.md docs/RELEASES.md CHANGELOG.md` — expected: no matches.

Completion Protocol:
1. Set 14.5 Status to ✅ (block + Task index row); tick the acceptance checkboxes.
2. Header Progress → `5 / 7`, Last updated → today.
3. Update the P14 row Progress to `5 / 7` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 14.5 ✅ <YYYY-MM-DD> — README badge header + RELEASES + CHANGELOG [0.1.0]`.
5. Commit: `docs: refresh README + seed RELEASES + changelog 0.1.0` (no Co-Authored-By).
```

---

### Task 14.6 — Audit reconciliation + security-hardening pass

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: 14.5

#### Description

Reconcile the OVERVIEW §6 Feature Coverage Matrix against the export/error-code audits (making both audits pass on the
real tree), then run the go-public security-hardening pass (helmet/CSP/HSTS, dependency review, secret-scan clean).

#### Acceptance criteria

- [ ] `pnpm audit:exports` exits 0 — every public export of `@bymax-one/nest-notification` (`.`, `./shared`, `./react`)
      is referenced in `apps/**`; any genuinely type/token-only export is in `.audit-ignore.json` **with a reason**, and
      `library-probe.ts` carries the sanctioned proof for the rest.
- [ ] `pnpm audit:error-codes` exits 0 — every `NOTIFICATION_ERROR_CODES` key is localized in `apps/web`.
- [ ] OVERVIEW §6 Feature Coverage Matrix is **regenerated from** the audit output (row count + "Demonstrated in"
      columns reconcile against the real routes/panels); no row maps to an unreferenced export.
- [ ] Security pass: helmet + a CSP/HSTS posture wired in `apps/api` (and `apps/web` headers) **without breaking the
      console or the SSE stream**; the security-headers behavior is covered by an e2e/unit test; the never-log-codes +
      `maskRecipient` invariants still hold.
- [ ] `pnpm audit --audit-level=high` is clean (or remaining advisories are dev/build-only, documented); `gitleaks
detect --no-git` is clean; `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov` all green.

#### Files to create / modify

- `docs/OVERVIEW.md` (§6 matrix reconcile), `.audit-ignore.json` (only if a justified type/token-only export), and the
  minimal `apps/api` / `apps/web` security-header wiring + its test (paths under OVERVIEW §5)

#### Agent prompt

```
You are a senior application-security / supply-chain engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib),
going PUBLIC. pnpm monorepo (apps/api + apps/web), Node 24, TS 5.9 strict; 100% coverage + Stryker ≥95; the export +
error-code audits are CI-gating (`ci.yml` export-usage-check).

CURRENT PHASE: 14 (Docs, Public-Readiness & Release) — Task 14.6 of 7 (MIDDLE)

PRECONDITIONS
- Task 14.5 done: the full doc-set + refreshed README + RELEASES + CHANGELOG exist. The library is linked
  (`file:../../../nest-notification`) with its dist/{server,shared,react}/index.d.ts present. scripts/
  audit-library-exports.mjs + audit-error-codes.mjs exist (from P0) and run against the now-real apps/.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "6. Feature Coverage Matrix" (the contract to reconcile), § "13. Multi-Tenant Security" (the
  invariants the security pass must preserve), § "5. Repository Layout" (where the api/web security wiring lives).
- docs/DEVELOPMENT_PLAN.md § "Phase 14", § "Appendix B — Library Export → Phase Coverage Map", § "Appendix C — Quality
  Gates", § "2. Global Conventions" (security-defaults row).
- The live audit scripts: scripts/audit-library-exports.mjs + scripts/audit-error-codes.mjs + .audit-ignore.json.
- Gold source for the security posture (shape, RE-THEME): ~/Documents/MyApps/bymax-one/nest-logger-example/docs/
  DEPLOYMENT.md (helmet/headers) + its security e2e; re-verify current helmet/CSP usage via context7 before wiring.

TASK
Make both audits pass on the real tree, regenerate the §6 matrix from the audit, and run the security-hardening pass.

DELIVERABLES
1. Run `pnpm audit:exports`; for every flagged export either reference it in a real apps/ journey, add a sanctioned
   reference in apps/api/src/library-probe.ts (the proof file), or — only if genuinely type/token-only — add it to
   `.audit-ignore.json` with a `reason`. Goal: exit 0.
2. Run `pnpm audit:error-codes`; localize any missing NOTIFICATION_ERROR_CODES key in apps/web. Goal: exit 0.
3. Reconcile docs/OVERVIEW.md § "6. Feature Coverage Matrix" against the audit output — fix the "Demonstrated in"
   columns/row set so every row resolves to a referenced export (do NOT hand-edit to hide an unreferenced export;
   reference it for real). Keep the §6 edits timeless and English-only.
4. Security pass: wire helmet + a CSP/HSTS posture in apps/api (and apps/web response headers) that does NOT break the
   console or the `/audit/stream` SSE; add/extend the security-headers test; confirm the never-log-codes +
   maskRecipient invariants still hold (the regression tests stay green).

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on any new export, English-only, NO suppression comments
  (@ts-ignore / eslint-disable). Any new SOURCE/config is TIMELESS — no Phase/Task references in it.
- Do not weaken coverage: any new code ships at 100% with a test. Untrusted CSP origins via env, not hard-coded.

Verification:
- `pnpm audit:exports` — expected: exit 0.
- `pnpm audit:error-codes` — expected: exit 0.
- `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov` — expected: all exit 0, coverage 100%.
- `pnpm audit --audit-level=high` — expected: clean (or only documented dev/build advisories).
- `gitleaks detect --no-git -v` (if installed) — expected: no leaks.

Completion Protocol:
1. Set 14.6 Status to ✅ (block + Task index row); tick the acceptance checkboxes.
2. Header Progress → `6 / 7`, Last updated → today.
3. Update the P14 row Progress to `6 / 7` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 14.6 ✅ <YYYY-MM-DD> — audit reconciliation + security hardening`.
5. Commit: `chore(security): reconcile coverage matrix + helmet/CSP hardening` (no Co-Authored-By).
```

---

### Task 14.7 — Go-public gate + `v0.1.0` release

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 14.6

#### Description

The closeout: run the repo-wide `markdown-link-check`, walk the Appendix E go-public checklist, confirm CI is fully
green, write the annotated `v0.1.0` tag (so `release.yml` builds + pushes the GHCR images and records the RELEASES.md
row), then run the per-phase completion protocol.

#### Acceptance criteria

- [ ] `npx markdown-link-check '**/*.md'` (or the CI step) is clean across **every** `docs/*.md` + `README.md` +
      governance files — no dead links.
- [ ] Appendix E go-public checklist is walked and every box checkable: all governance files present (from P0), the 4
      Copilot files customized + < 4000 chars, the README badge header complete, CI fully green incl.
      `codeql`/`scorecard`/`dependency-review`/secret-scan, secret scan clean, branch-protection note recorded.
- [ ] `CHANGELOG.md` `## [0.1.0]` is finalized with the release date; the annotated `v0.1.0` tag is prepared
      (`git tag -a v0.1.0 -m "…"` on the release commit) — **created, not pushed** until merge + library availability.
- [ ] `release.yml` is confirmed to (on the `v0.1.0` tag) build + push `ghcr.io/bymaxone/nest-notification-example-api`
      / `…-web` and have the `update-releases-doc` job prepend the RELEASES.md row (the tag↔version + idempotency logic
      validated).
- [ ] This is the LAST task — the per-phase protocol flips P14 to ✅ N/N and advances the dashboard.

#### Files to create / modify

- `CHANGELOG.md` (finalize the `[0.1.0]` date), `docs/DEVELOPMENT_PLAN.md` (dashboard), this file (header + log); the
  `v0.1.0` annotated tag (git object, not a file)

#### Agent prompt

```
You are a senior release-engineering / public-readiness engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
pnpm monorepo (apps/api + apps/web), Node 24, TS 5.9 strict; 100% coverage + Stryker ≥95; release.yml ships two GHCR
images via OIDC on a v* tag and a bot prepends a RELEASES.md row. The repo is PRIVATE now and about to go PUBLIC.

CURRENT PHASE: 14 (Docs, Public-Readiness & Release) — Task 14.7 of 7 (LAST)

PRECONDITIONS
- Task 14.6 done: both audits exit 0, the §6 matrix is reconciled, the security pass is in, CI is green. The full
  doc-set + README + RELEASES (with the `_pending_` seed row) + CHANGELOG `## [0.1.0]` exist. All P0 governance files
  + the 4 Copilot files + the security workflows already ship.

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Appendix E — Go-Public Readiness Checklist" (the boxes to walk), § "Appendix D — CI/CD
  Workflow Matrix" (release.yml shape), § "Phase 14" + § "Update Protocol" (the dashboard closeout).
- docs/OVERVIEW.md § "19. Versioning & Release Tracking" (the v0.1.0 policy).
- The live release.yml: .github/workflows/release.yml (the build-and-push + update-releases-doc jobs — confirm the
  image names ghcr.io/bymaxone/nest-notification-example-{api,web} + the tag↔version + idempotency logic) and
  docs/RELEASES.md (the seed row the bot prepends to).
- docs/tasks/README.md § "Per-phase Completion Protocol" (the exact closeout steps).

TASK
Run the go-public gate, finalize + tag v0.1.0, then run the per-phase completion protocol.

DELIVERABLES
1. Repo-wide link check: `npx markdown-link-check` over every docs/*.md + README.md + governance files; fix any dead
   link until clean.
2. Walk Appendix E: confirm each box is satisfiable (governance files, Copilot files <4000 chars, README badges, CI
   green incl. codeql/scorecard/dependency-review/secret-scan, secret-scan clean). Record the branch-protection note
   (PR-only, required checks by name, signed commits, linear history) in DEPLOYMENT.md or the go-public note if not
   already present.
3. Finalize `CHANGELOG.md` `## [0.1.0] - <today>` with the release date.
4. Prepare the annotated tag: `git tag -a v0.1.0 -m "v0.1.0 — initial public release"` on the release commit. Do NOT
   push it until the PR is merged and `@bymax-one/nest-notification` is available to CI (the export audit needs the
   library dist/). Confirm release.yml (on that tag) builds + pushes the two GHCR images and the update-releases-doc
   bot prepends the RELEASES.md row (validate the tag↔version + `docker manifest inspect` idempotency logic by reading,
   not by pushing).

Constraints:
- Follow /bymax-workflow:standards. English-only, timeless — NO Phase/Task references in CHANGELOG/RELEASES/docs.
- The tag is annotated and points at the release commit; never fabricate a RELEASES.md version row by hand (the bot
  owns that table); never push the tag from this runner.

Verification:
- `npx markdown-link-check docs/*.md README.md --config .markdown-link-check.json` — expected: no dead links.
- `git tag -l v0.1.0` — expected: prints `v0.1.0` (annotated; `git cat-file -t v0.1.0` → `tag`).
- `grep -q "0.1.0" CHANGELOG.md && grep -q "_pending_\|0.1.0" docs/RELEASES.md && echo ok` — expected: `ok`.
- `grep -riE "phase [0-9]|task [0-9]|P1[0-4]-[0-9]" docs/*.md README.md CHANGELOG.md` — expected: no matches.

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 14.7 Status to ✅ (block + Task index row); tick the acceptance checkboxes.
2. Header Progress → `7 / 7`, Last updated → today.
3. Update the P14 row Progress to `7 / 7` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 14.7 ✅ <YYYY-MM-DD> — go-public gate + v0.1.0 release`.
5. Commit: `docs: go-public gate + cut v0.1.0` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, in
docs/DEVELOPMENT_PLAN.md set the **P14 Status to ✅** and **Progress `7 / 7`** + Last updated; set **Active phase** to
`— (complete)`; recompute **Overall progress** to `14 / 15 phases` (then `15 / 15` once the release workflow's tag run
records the RELEASES.md row); set this file's header **Status to ✅**; commit `docs(plan): P14 complete` (no Co-Authored-By).
```

---

## Phase Completion Protocol

When **Task 14.7** is `✅` and every other task is `✅`:

1. Confirm all 7 tasks are `✅` and the P14 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P14`](../DEVELOPMENT_PLAN.md#phase-14--docs-public-readiness--release)
   is met: every `docs/*.md` present + `markdown-link-check` clean; the §6 Feature Coverage Matrix reconciles against
   the audit (`audit:exports` + `audit:error-codes` exit 0); CI fully green including `codeql` + `scorecard` + the
   security gates; the repo is ready to flip public; `v0.1.0` tagged and the release workflow produces the GHCR images
   - records the `RELEASES.md` row.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P14 Status** to `✅`, **Progress** `7 / 7`, **Last
   updated** today; set **Active phase** to `— (complete)`; recompute **Overall progress** to `14 / 15 phases` (the
   15th phase closes when the `v0.1.0` release workflow run records the `RELEASES.md` row).
4. Set this file's header **Status** to `✅` and **Progress** to `7 / 7 tasks`.
5. Commit `docs(plan): P14 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P14 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 14.6 ✅ 2026-06-24 — audit reconciliation + security hardening (audit:exports + audit:error-codes exit 0, helm/CSP verified, format:check green)
- 14.5 ✅ 2026-06-24 — README badge header + RELEASES seed row + CHANGELOG [0.1.0]
- 14.4 ✅ 2026-06-24 — multi-tenancy + auth integration + deployment + troubleshooting docs
- 14.3 ✅ 2026-06-24 — environment + providers + templating guides
- 14.2 ✅ 2026-06-24 — architecture + database + console deep-dives
- 14.1 ✅ 2026-06-24 — GETTING_STARTED + FEATURES docs
