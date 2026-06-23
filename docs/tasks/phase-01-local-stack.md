# Phase 1 — Local Stack & Environment

> **Status**: 🔄 In Progress · **Progress**: 3 / 5 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P1
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

Phase 0 produced a **building, fully-gated, empty pnpm monorepo**: the workspace + TypeScript toolchain, lint / format /
commit governance, every go-public file, the complete CI/CD pipeline, the Copilot review config, and the audit-script
stubs. There is still **no `apps/` code** and **no local backends**.

Phase 1 stands up the **one-command, zero-credential local stack and the fail-fast environment contract**. It adds the
`docker-compose.yml` dev stack (PostgreSQL `18` + Redis `7` + Mailpit, each healthchecked and loopback-bound), the
high-port `docker-compose.test.yml`, the `docker/postgres/init.sql` database bootstrap, the root `.env.example`
documenting every variable, the API's Zod environment schema (`apps/api/src/config/env.schema.ts`, unit-tested for the
failure path), the `infra:up` / `infra:down` scripts, and a minimal `apps/api` skeleton `package.json` so the workspace
package exists for later phases to fill in. When P1 is done, `pnpm infra:up` returns only when all three containers are
healthy, the Mailpit UI is reachable at `http://localhost:8025`, a missing/invalid env var aborts with a precise
message, and `.env.example` documents every variable with the ports from OVERVIEW §8/§9.

**No NestJS bootstrap is written in this phase** — `main.ts`, `app.module.ts`, and the controllers belong to P3+. The
only `apps/api` source file added here is the env schema (+ its spec); everything else is infra and configuration.

The gold sources for the actual file contents are the sibling repos — copy and **adapt** their proven configs rather
than inventing: `nest-logger-example` (compose dev/test, init.sql, env schema shape, infra scripts) and
`nest-auth-example` (the redis + mailpit service shapes), both under `~/Documents/MyApps/bymax-one/`.

---

## Rules-of-phase

1. **No NestJS bootstrap** — only infra (compose / init.sql / scripts), `.env.example`, the Zod env schema (+ spec), and
   the minimal `apps/api` skeleton `package.json`. `main.ts` / `app.module.ts` / modules belong to P3+.
2. **All services bind `127.0.0.1`** — every published port is loopback-bound (`'127.0.0.1:<host>:<container>'`), never
   `0.0.0.0`; the dev stack is for the developer's machine only.
3. **Test stack uses the high ports** — `docker-compose.test.yml` maps Postgres `55432` and Redis `56379` so it never
   contends with the running dev stack; use `tmpfs` so nothing persists between runs.
4. **Pinned, healthchecked images** — `postgres:18-alpine`, `redis:7-alpine`, `axllent/mailpit` (digest-pinned); every
   service carries a healthcheck so `pnpm infra:up --wait` only returns when the stack is ready.
5. **Fail-fast env** — the Zod schema validates `process.env` at boot; a missing/invalid var aborts with a readable,
   aggregated message; production guards reject loopback `DATABASE_URL` / `REDIS_URL` and a non-`https` `WEB_ORIGIN`.
6. **Ports are contractual** — `apps/api` → `3001`, `apps/web` → `3003`, Postgres `5432`, Redis `6379`, Mailpit SMTP
   `1025` / UI `8025`. Match [`OVERVIEW.md §8`](../OVERVIEW.md#8-local-stack--memory-safe-run) and
   [§9](../OVERVIEW.md#9-configuration--environment) exactly.
7. **Copy-and-adapt the siblings** — `nest-logger-example` / `nest-auth-example` are the proven sources; do not hand-roll
   from memory. Re-verify current tool docs via context7 where a version moved.
8. **No `.gitkeep` / empty-directory placeholders** — directories emerge from real files only; create `docker/postgres/`
   and `apps/api/src/config/` only by writing a real file into them.
9. **Timeless, English-only** — no `Phase N` / `Task` / roadmap-stage references in any committed file (compose, SQL,
   env schema, comments). Doc-section refs (`OVERVIEW.md §8`) are allowed.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §5 Repository Layout (the target tree), §8 Local Stack & Memory-Safe Run (services,
  ports, healthchecks), §9 Configuration & Environment (the env-var table + the `forRootAsync` wiring it feeds).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P1, §2 Global Conventions, §3 Autonomous Execution Model,
  Appendix A (Environment Variable Registry).
- Sibling repos (gold config sources): `~/Documents/MyApps/bymax-one/nest-logger-example/`
  {`docker-compose.yml`, `docker-compose.test.yml`, `docker/postgres/init.sql`, `.env.example`,
  `apps/api/src/config/env.schema.ts`, `package.json` infra scripts}; and
  `~/Documents/MyApps/bymax-one/nest-auth-example/docker-compose.yml` (redis + mailpit service shapes).
- `/bymax-workflow:standards` skill — universal coding rules.
- Vault: [[Example-App-Standard]], [[NestJS/Bymax-Conventions]].

---

## Task index

| ID  | Task                                     | Status  | Priority | Size | Depends on |
| --- | ---------------------------------------- | ------- | -------- | ---- | ---------- |
| 1.1 | `apps/api` skeleton package              | ✅ Done | P0       | S    | —          |
| 1.2 | Docker Compose dev stack + Postgres init | ✅ Done | P0       | M    | 1.1        |
| 1.3 | Docker Compose test stack (high ports)   | ✅ Done | P1       | S    | 1.2        |
| 1.4 | `.env.example` + infra scripts           | 📋 ToDo | P0       | S    | 1.2        |
| 1.5 | Zod env schema + failure-path unit test  | 📋 ToDo | P0       | M    | 1.1, 1.4   |

---

## Tasks

### Task 1.1 — `apps/api` skeleton package

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: —

#### Description

Create the minimal `apps/api` workspace package so the monorepo has a real backend member for later phases to fill in,
and so the env schema (Task 1.5) has a home (`apps/api/src/config/`). No NestJS bootstrap — just the package manifest,
a package-scoped `tsconfig.json` extending the base, and the `zod` dependency the schema needs.

#### Acceptance criteria

- [x] `apps/api/package.json` — private, `"type": "module"`, `"name": "@nest-notification-example/api"`, version `0.0.0`; a `typecheck` script
      (`tsc --noEmit -p tsconfig.json`) and a placeholder `test` script; `zod` as a dependency.
- [x] `apps/api/tsconfig.json` extends `../../tsconfig.base.json`, sets `rootDir: src`, `outDir: dist`, and includes
      `src`.
- [x] The package is picked up by the workspace: `pnpm -F api exec tsc --version` resolves; `pnpm install` succeeds.
- [x] `pnpm typecheck` (root) still exits 0 (the package has no source other than what Task 1.5 adds; an empty `src`
      must not break `tsc` — add the env schema's directory on demand, do not pre-create empty dirs).

#### Files to create / modify

- `apps/api/package.json`, `apps/api/tsconfig.json`
- root `package.json` (no change required if root `typecheck`/`test:cov` already fan out with `pnpm -r`)

#### Agent prompt

````
You are a senior TypeScript build/tooling engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for the @bymax-one/nest-notification library
(NestJS 11 notification lib: email + OTP, multi-tenant, pluggable providers/storage). pnpm monorepo, Node 24,
TypeScript 5.9 strict; apps/api (NestJS) is the centerpiece, apps/web (Next.js 16) added later.

CURRENT PHASE: 1 (Local Stack & Environment) — Task 1.1 of 5 (FIRST)

PRECONDITIONS
- Phase 0 done: pnpm workspace + tsconfig.base.json exist; `pnpm install`, `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check` pass on the empty tree; root scripts fan out with `pnpm -r --workspace-concurrency=1 --if-present`.
- No apps/ directory exists yet.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "5. Repository Layout" (the apps/api tree — only the package manifest + tsconfig matter here).
- docs/DEVELOPMENT_PLAN.md § "2. Global Conventions" (workspace / TS-strict / install rules).
- Sibling files (copy & adapt, do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/
  {package.json, tsconfig.json} — copy the package skeleton shape (private, "type":"module", scripts), then STRIP
  every logger/Nest/OTel dependency; keep only what a bare package needs + add `zod`.

TASK
Create the minimal apps/api workspace package (manifest + package-scoped tsconfig) so later phases have a backend member
and Task 1.5's env schema has a home. No NestJS bootstrap.

DELIVERABLES
1. `apps/api/package.json`:
   ```jsonc
   {
     "name": "@nest-notification-example/api",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "scripts": {
       "typecheck": "tsc --noEmit -p tsconfig.json",
       "test": "echo \"no tests yet\" && exit 0"
     },
     "dependencies": { "zod": "^3.x" }
   }
   ```
   (Use the current zod major — re-verify via context7 if unsure; the auth/logger siblings use zod for env validation.)
2. `apps/api/tsconfig.json`:
   ```jsonc
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": { "rootDir": "src", "outDir": "dist" },
     "include": ["src"]
   }
   ```

Constraints:
- No NestJS, no main.ts, no app.module.ts (P3+). Do NOT pre-create an empty `src/` dir or a .gitkeep — the env schema
  (Task 1.5) creates `apps/api/src/config/` on demand. If `tsc` complains there are no input files, either let Task 1.5
  supply the first file, or guard with `"files": []` plus `"include": ["src"]` — prefer a config that exits 0 cleanly on
  the current tree without placeholder files. Follow /bymax-workflow:standards. English-only, timeless comments.
- After editing package.json run `pnpm install --no-frozen-lockfile`, then commit the updated lockfile.

Verification:
- `pnpm install` — expected: succeeds; apps/api appears as a workspace package.
- `pnpm -F api exec tsc --version` — expected: prints the TS 5.9 version.
- `pnpm typecheck` (root) — expected: exits 0.

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 5` and Last updated to today.
4. Update the P1 row Progress to `1 / 5` in docs/DEVELOPMENT_PLAN.md (Phase dashboard) + its Last updated.
5. Append to ## Completion log: `- 1.1 ✅ <YYYY-MM-DD> — apps/api skeleton package`.
6. Commit: `chore(api): scaffold apps/api skeleton package` (no Co-Authored-By).
````

---

### Task 1.2 — Docker Compose dev stack + Postgres init

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 1.1

#### Description

Author the `docker-compose.yml` dev stack — PostgreSQL `18`, Redis `7`, and Mailpit, each loopback-bound and
healthchecked — plus `docker/postgres/init.sql` that creates the `notification_example` database. This is the
zero-credential local backend the API connects to.

#### Acceptance criteria

- [x] `docker-compose.yml` defines three services, all ports bound to `127.0.0.1`:
  - `postgres` — `postgres:18-alpine`, port `5432`, persistent volume + `init.sql` mounted read-only, healthcheck
    `pg_isready`.
  - `redis` — `redis:7-alpine`, port `6379`, healthcheck `redis-cli ping`.
  - `mailpit` — `axllent/mailpit` (digest-pinned), SMTP `1025` + UI `8025`, healthcheck on the `:8025` HTTP info
    endpoint.
- [x] `docker/postgres/init.sql` — re-run-safe (`\gexec` guard) `CREATE DATABASE notification_example`.
- [x] A named network (`local-dev`) + named volumes (`pg-data`, `redis-data`).
- [x] `docker compose -f docker-compose.yml config` validates; `docker compose up -d --wait` returns only when all three
      are healthy; `curl -fsS http://localhost:8025/api/v1/info` returns 200.

#### Files to create / modify

- `docker-compose.yml`, `docker/postgres/init.sql`

#### Agent prompt

````
You are a senior platform / local-infrastructure engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
The happy path runs with ZERO external credentials: a local Postgres (audit store), Redis (OTP storage), and Mailpit
(SMTP inbox) make delivery tangible. pnpm monorepo, Node 24.

CURRENT PHASE: 1 (Local Stack & Environment) — Task 1.2 of 5 (MIDDLE)

PRECONDITIONS
- Task 1.1 done: apps/api skeleton package exists; `pnpm install`/`pnpm typecheck` pass.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "8. Local Stack & Memory-Safe Run" — the service table (image / host port / purpose / healthcheck)
  and the port map (api 3001, web 3003; Postgres 5432, Redis 6379, Mailpit SMTP 1025 / UI 8025).
- Sibling files (copy & adapt, do NOT invent):
  - ~/Documents/MyApps/bymax-one/nest-auth-example/docker-compose.yml — the EXACT redis (redis:7-alpine, redis-cli ping)
    + mailpit (axllent/mailpit digest-pinned, wget :8025/api/v1/info healthcheck) + postgres (postgres:18-alpine,
    pg_isready) service shapes + the local-dev bridge network + named volumes.
  - ~/Documents/MyApps/bymax-one/nest-logger-example/docker/postgres/init.sql — the \gexec re-run-safe CREATE DATABASE
    guard pattern.

TASK
Author docker-compose.yml (postgres:18 + redis:7 + mailpit, each loopback-bound + healthchecked) and the Postgres
init.sql that creates the notification_example database.

DELIVERABLES
1. `docker-compose.yml`:
   ```yaml
   name: nest-notification-example
   services:
     postgres:
       image: postgres:18-alpine
       restart: unless-stopped
       environment:
         POSTGRES_USER: ${POSTGRES_USER:-postgres}
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
         POSTGRES_DB: ${POSTGRES_DB:-notification_example}
       ports: ['127.0.0.1:5432:5432']
       volumes:
         - pg-data:/var/lib/postgresql/data
         - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
       healthcheck:
         test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-notification_example}']
         interval: 5s
         timeout: 5s
         retries: 10
       networks: [local-dev]
     redis:
       image: redis:7-alpine
       restart: unless-stopped
       ports: ['127.0.0.1:6379:6379']
       healthcheck:
         test: ['CMD', 'redis-cli', 'ping']
         interval: 5s
         timeout: 5s
         retries: 10
       networks: [local-dev]
     mailpit:
       image: axllent/mailpit@sha256:<pin-current-digest>
       restart: unless-stopped
       ports: ['127.0.0.1:1025:1025', '127.0.0.1:8025:8025']
       healthcheck:
         test: ['CMD-SHELL', 'wget -qO- http://localhost:8025/api/v1/info || exit 1']
         interval: 5s
         timeout: 5s
         retries: 10
       networks: [local-dev]
   networks:
     local-dev: { driver: bridge }
   volumes:
     pg-data:
     redis-data:
   ```
   (Pin the axllent/mailpit digest to the current one — copy the sibling's pin or re-resolve it; do not leave a
   floating tag if the siblings pin.)
2. `docker/postgres/init.sql` — the \gexec re-run-safe guard, adapted from the logger sibling:
   ```sql
   -- Runs once on first volume initialization (data dir empty), against the default `postgres` DB.
   -- Postgres lacks `CREATE DATABASE IF NOT EXISTS`, so use the \gexec guard to stay re-run-safe.
   -- The entrypoint already creates POSTGRES_DB; this guard covers a renamed POSTGRES_DB.
   SELECT 'CREATE DATABASE notification_example'
   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notification_example')\gexec
   ```

Constraints:
- Every published port is bound to 127.0.0.1 (never 0.0.0.0). Pin images. English-only, timeless comments — no
  phase/task references in the compose file or SQL. Redis here is the dev OTP store; absent ⇒ the API falls back to
  in-memory (do NOT add auth/persistence config the notification lib does not need).
- Follow /bymax-workflow:standards.

Verification:
- `docker compose -f docker-compose.yml config` — expected: valid (no error).
- `docker compose up -d --wait` — expected: returns only when all three services report healthy.
- `curl -fsS http://localhost:8025/api/v1/info` — expected: HTTP 200 (Mailpit UI reachable).
- `docker compose exec postgres psql -U postgres -lqt | grep notification_example` — expected: the DB exists.
- `docker compose down` to clean up.

Completion Protocol:
1. Set 1.2 ✅ in its block + the Task index row; tick the satisfied criteria.
2. Header Progress `2 / 5`, Last updated today.
3. Update the P1 row Progress to `2 / 5` in docs/DEVELOPMENT_PLAN.md + Last updated.
4. Append `- 1.2 ✅ <YYYY-MM-DD> — docker compose dev stack + postgres init` to ## Completion log.
5. Commit: `chore(infra): docker compose dev stack (postgres/redis/mailpit) + init.sql` (no Co-Authored-By).
````

---

### Task 1.3 — Docker Compose test stack (high ports)

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: S
- **Depends on**: 1.2

#### Description

Author `docker-compose.test.yml` — a dedicated, ephemeral test stack on deliberately high ports (Postgres `55432`,
Redis `56379`) with `tmpfs` storage, so the opt-in integration tier runs alongside the dev stack without port or data
collision.

#### Acceptance criteria

- [x] `docker-compose.test.yml` — `name: nest-notification-example-test`, a `ci` bridge network; `postgres`
      (`postgres:18-alpine`) on `127.0.0.1:55432:5432` with `POSTGRES_DB: notification_example_test` and `tmpfs`; `redis`
      (`redis:7-alpine`) on `127.0.0.1:56379:6379` with `tmpfs`; both healthchecked with short intervals.
- [x] No Mailpit in the test stack (the test tier mocks the email provider) — note this in a comment.
- [x] `docker compose -f docker-compose.test.yml config` validates; `docker compose -f docker-compose.test.yml up -d
--wait` returns healthy on the high ports without touching the dev stack.

#### Files to create / modify

- `docker-compose.test.yml`

#### Agent prompt

````
You are a senior platform / CI-infrastructure engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
The opt-in integration tier needs an ephemeral Postgres + Redis on high ports that never contend with the dev stack.
pnpm monorepo, Node 24; tests run sequentially with bounded workers (memory-safe).

CURRENT PHASE: 1 (Local Stack & Environment) — Task 1.3 of 5 (MIDDLE)

PRECONDITIONS
- Task 1.2 done: docker-compose.yml dev stack (postgres 5432 / redis 6379 / mailpit) exists and comes up healthy.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "8. Local Stack & Memory-Safe Run" — the line: "The test stack (docker-compose.test.yml) uses
  deliberately high ports — Postgres 55432, Redis 56379 — so it never contends with the running dev stack."
- Sibling file (copy & adapt, do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/docker-compose.test.yml
  — the EXACT pattern: a named test project, a `ci` bridge network, tmpfs storage, alternate host ports, short
  healthcheck intervals, test-only static credentials. Drop the logger's `loki` service; add a `redis` service.

TASK
Author docker-compose.test.yml: an ephemeral, high-port Postgres + Redis test stack with tmpfs storage on a dedicated
network, so the integration tier runs beside the dev stack.

DELIVERABLES
1. `docker-compose.test.yml`:
   ```yaml
   name: nest-notification-example-test
   # Ephemeral test stack — alternate host ports (runs alongside the dev stack) + tmpfs
   # (nothing persists between runs). Static test-only credentials; never reuse outside CI.
   # Everything is bound to 127.0.0.1. No Mailpit — the test tier mocks the email provider.
   services:
     postgres:
       image: postgres:18-alpine
       environment:
         POSTGRES_USER: ${POSTGRES_USER:-postgres}
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
         POSTGRES_DB: notification_example_test
       ports: ['127.0.0.1:55432:5432']
       tmpfs: ['/var/lib/postgresql']
       healthcheck:
         test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER:-postgres} -d notification_example_test']
         interval: 3s
         timeout: 3s
         retries: 15
       networks: [ci]
     redis:
       image: redis:7-alpine
       ports: ['127.0.0.1:56379:6379']
       tmpfs: ['/data']
       healthcheck:
         test: ['CMD', 'redis-cli', 'ping']
         interval: 3s
         timeout: 3s
         retries: 15
       networks: [ci]
   networks:
     ci: { driver: bridge }
   ```

Constraints:
- High ports 55432 / 56379 only; loopback-bound. tmpfs storage (no named volumes). English-only, timeless comments —
  no phase/task references. Follow /bymax-workflow:standards.

Verification:
- `docker compose -f docker-compose.test.yml config` — expected: valid.
- `docker compose -f docker-compose.test.yml up -d --wait --wait-timeout 120` — expected: both services healthy on
  55432 / 56379 with the dev stack still untouched.
- `nc -z 127.0.0.1 55432 && nc -z 127.0.0.1 56379` (or `pg_isready -h 127.0.0.1 -p 55432`) — expected: reachable.
- `docker compose -f docker-compose.test.yml down -v` to clean up.

Completion Protocol:
1. Set 1.3 ✅ in its block + the Task index row; tick the satisfied criteria.
2. Header Progress `3 / 5`, Last updated today.
3. Update the P1 row Progress to `3 / 5` in docs/DEVELOPMENT_PLAN.md + Last updated.
4. Append `- 1.3 ✅ <YYYY-MM-DD> — docker compose test stack (high ports)` to ## Completion log.
5. Commit: `chore(infra): ephemeral high-port test stack (postgres/redis)` (no Co-Authored-By).
````

---

### Task 1.4 — `.env.example` + infra scripts

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 1.2

#### Description

Author the root `.env.example` documenting **every** environment variable (with the dev defaults from OVERVIEW §9 /
Appendix A) and wire the `infra:*` scripts into the root `package.json` so `pnpm infra:up` / `pnpm infra:down` drive the
compose stacks.

#### Acceptance criteria

- [ ] `.env.example` documents every variable from OVERVIEW §9: `PORT`, `DATABASE_URL`, `REDIS_URL`, `SMTP_URL`,
      `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME`, `DEFAULT_LOCALE`, `OTP_DEFAULT_TTL_SECONDS`,
      `OTP_RESEND_COOLDOWN_SECONDS`, `AUDIT_MASK_RECIPIENT`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL` — each with an inline
      comment naming its service + purpose, grouped by section, defaults matching §9 (e.g. `PORT=3001`,
      `SMTP_URL=smtp://localhost:1025`, `WEB_ORIGIN=http://localhost:3003`, `NEXT_PUBLIC_API_URL=http://localhost:3001`).
- [ ] `REDIS_URL` and `RESEND_API_KEY` are present but commented/empty (unset ⇒ in-memory OTP / Nodemailer→Mailpit) so
      the documented behavior is clear.
- [ ] Root `package.json` scripts: `infra:up` (`docker compose up -d --wait`), `infra:down` (`docker compose down`),
      `infra:nuke` (`docker compose down -v`), `infra:logs` (`docker compose logs -f`), `infra:test:up`
      (`docker compose -f docker-compose.test.yml up -d --wait --wait-timeout 180`), `infra:test:down`
      (`docker compose -f docker-compose.test.yml down -v`).
- [ ] `.env.example` is git-tracked; `.env` is git-ignored (already in `.gitignore` from P0 — verify).

#### Files to create / modify

- `.env.example`, root `package.json` (replace the P0 `infra:up`/`infra:down` placeholders with the real commands +
  add the test/nuke/logs variants)

#### Agent prompt

````
You are a senior developer-experience engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
The happy path is zero-credential: a local Postgres/Redis/Mailpit stack via docker compose. Every env var is
UPPER_SNAKE_CASE, browser vars are NEXT_PUBLIC_, and the API validates its env with Zod at boot. pnpm monorepo, Node 24.

CURRENT PHASE: 1 (Local Stack & Environment) — Task 1.4 of 5 (MIDDLE)

PRECONDITIONS
- Task 1.2 done: docker-compose.yml dev stack exists (postgres 5432 / redis 6379 / mailpit 1025+8025). Root
  package.json already has `infra:up`/`infra:down` placeholders from Phase 0.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "9. Configuration & Environment" — the env-var table (variable / service / dev default / used for)
  is the SINGLE source of truth for the .env.example rows. Use those exact names + defaults.
- docs/DEVELOPMENT_PLAN.md § "Appendix A — Environment Variable Registry" (the fail-fast + production-guard intent).
- Sibling files (copy the STYLE only, adapt every variable): ~/Documents/MyApps/bymax-one/nest-logger-example/
  {.env.example (the section-banner comment style), package.json (the infra:up/down/nuke/logs/test:up/test:down script
  shapes)}.

TASK
Author the root .env.example documenting every OVERVIEW §9 variable with dev defaults + inline comments, and wire the
real infra:* scripts into the root package.json.

DELIVERABLES
1. `.env.example` — grouped, every variable with an inline comment, e.g.:
   ```dotenv
   # ── API runtime ──────────────────────────────────────────────────────────
   PORT=3001                                            # apps/api HTTP port (web 3003)
   WEB_ORIGIN=http://localhost:3003                     # CORS allow-origin (+ exposes Retry-After)

   # ── Audit store (Postgres) ───────────────────────────────────────────────
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/notification_example  # Prisma audit store

   # ── OTP storage (Redis — optional) ───────────────────────────────────────
   # REDIS_URL=redis://localhost:6379                   # unset ⇒ InMemoryOtpStorage
   OTP_DEFAULT_TTL_SECONDS=600                          # default OTP TTL (overridable per-purpose)
   OTP_RESEND_COOLDOWN_SECONDS=60                       # resend cooldown

   # ── Email delivery (Mailpit by default) ──────────────────────────────────
   SMTP_URL=smtp://localhost:1025                       # custom Nodemailer→Mailpit provider
   # RESEND_API_KEY=                                    # set ⇒ ResendEmailProvider; unset ⇒ Nodemailer/NoOp
   MAIL_FROM=no-reply@notification.local                # defaultFrom
   MAIL_FROM_NAME=Bymax Notification Example            # defaultFromName
   DEFAULT_LOCALE=en                                    # template locale fallback
   AUDIT_MASK_RECIPIENT=true                            # maskRecipient toggle (jane@acme.com → j***@acme.com)

   # ── Console (apps/web) ───────────────────────────────────────────────────
   NEXT_PUBLIC_API_URL=http://localhost:3001            # the console's API base
   ```
   (Match OVERVIEW §9 names + defaults exactly; comment REDIS_URL and RESEND_API_KEY out to document the unset⇒fallback
   behavior.)
2. Root `package.json` scripts (replace the P0 placeholders):
   ```jsonc
   "infra:up": "docker compose up -d --wait",
   "infra:down": "docker compose down",
   "infra:nuke": "docker compose down -v",
   "infra:logs": "docker compose logs -f",
   "infra:test:up": "docker compose -f docker-compose.test.yml up -d --wait --wait-timeout 180",
   "infra:test:down": "docker compose -f docker-compose.test.yml down -v"
   ```

Constraints:
- .env.example documents EVERY OVERVIEW §9 variable — no more, no fewer. English-only, timeless comments — no
  phase/task references. Never put real secrets in .env.example. Verify `.env` is already git-ignored (from Phase 0);
  if not, add it. Follow /bymax-workflow:standards.

Verification:
- `grep -E '^(#\s*)?(PORT|DATABASE_URL|REDIS_URL|SMTP_URL|RESEND_API_KEY|MAIL_FROM|MAIL_FROM_NAME|DEFAULT_LOCALE|OTP_DEFAULT_TTL_SECONDS|OTP_RESEND_COOLDOWN_SECONDS|AUDIT_MASK_RECIPIENT|WEB_ORIGIN|NEXT_PUBLIC_API_URL)=' .env.example | wc -l`
  — expected: 13 (every §9 variable present).
- `pnpm infra:up` then `pnpm infra:down` — expected: stack comes up healthy and tears down cleanly.
- `git check-ignore .env` — expected: prints `.env` (it is ignored).

Completion Protocol:
1. Set 1.4 ✅ in its block + the Task index row; tick the satisfied criteria.
2. Header Progress `4 / 5`, Last updated today.
3. Update the P1 row Progress to `4 / 5` in docs/DEVELOPMENT_PLAN.md + Last updated.
4. Append `- 1.4 ✅ <YYYY-MM-DD> — .env.example + infra scripts` to ## Completion log.
5. Commit: `chore(infra): document env vars + wire infra:* scripts` (no Co-Authored-By).
````

---

### Task 1.5 — Zod env schema + failure-path unit test

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 1.1, 1.4

#### Description

Author the API's Zod environment schema (`apps/api/src/config/env.schema.ts`) — the fail-fast contract that validates
`process.env` at boot and aborts with a precise, aggregated message on a missing/invalid var — and its unit test
covering both the happy path (defaults applied) and the failure path (an invalid value throws). This closes Phase 1.

#### Acceptance criteria

- [ ] `apps/api/src/config/env.schema.ts` exports `envSchema`, the inferred `Env` type, and a `validateEnv(config)`
      function used as the `ConfigModule.forRoot({ validate })` entrypoint; it validates every OVERVIEW §9 variable
      (`PORT` coerced int, `DATABASE_URL` URL, `REDIS_URL` optional URL, `SMTP_URL` URL with default,
      `RESEND_API_KEY` optional, `MAIL_FROM` string, `MAIL_FROM_NAME` optional, `DEFAULT_LOCALE` default `en`,
      `OTP_DEFAULT_TTL_SECONDS` / `OTP_RESEND_COOLDOWN_SECONDS` coerced int with defaults, `AUDIT_MASK_RECIPIENT` coerced
      boolean default `true`, `WEB_ORIGIN` URL default `http://localhost:3003`, plus `NODE_ENV` enum).
- [ ] Production guards (`superRefine`): in `production`, `DATABASE_URL` / `REDIS_URL` must not be loopback and
      `WEB_ORIGIN` must be `https://`; `validateEnv` throws an `Error` whose message aggregates every offending key + reason.
- [ ] Every export carries JSDoc; zero `any`, zero suppression comments.
- [ ] `apps/api/src/config/env.schema.spec.ts` — covers: defaults applied on a minimal valid env; a missing required var
      throws; an invalid value (e.g. non-URL `DATABASE_URL`) throws with the key named; the production loopback +
      non-https guards fire. The file passes under the api test runner.
- [ ] `pnpm -F api typecheck` exits 0; the spec passes (the failure path is asserted — see the DoD).

#### Files to create / modify

- `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.schema.spec.ts`

#### Agent prompt

````
You are a senior NestJS / TypeScript backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
The API validates its environment with Zod at boot — a missing/invalid var aborts startup with a precise, aggregated
message. pnpm monorepo, Node 24, TypeScript 5.9 strict (zero any, zero suppression comments).

CURRENT PHASE: 1 (Local Stack & Environment) — Task 1.5 of 5 (LAST)

PRECONDITIONS
- Task 1.1 done: apps/api package exists with zod + tsconfig (the env schema's home is apps/api/src/config/).
- Task 1.4 done: .env.example documents every variable the schema validates.
- No NestJS bootstrap exists yet (P3 adds main.ts/app.module.ts); this task ships ONLY the schema + its spec.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "9. Configuration & Environment" — the env-var table (the EXACT variables, services, defaults to
  validate) and the note that the API "validates its environment with Zod at boot (a missing/invalid var aborts
  startup with a precise message)".
- docs/DEVELOPMENT_PLAN.md § "Appendix A — Environment Variable Registry" — the production guards: WEB_ORIGIN must be
  https://; managed DATABASE_URL/REDIS_URL (no loopback) in production.
- Sibling file (copy the STRUCTURE — schema + superRefine + validateEnv + JSDoc — adapt every variable to §9):
  ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/config/env.schema.ts (the isLoopbackUrl helper,
  PRODUCTION_NON_LOOPBACK_URLS guard, the aggregated-message validateEnv). Do NOT carry over logger/OTel variables.

TASK
Author apps/api/src/config/env.schema.ts (the fail-fast Zod env contract for every OVERVIEW §9 variable, with
production guards) and its unit test covering the happy path AND the failure path.

DELIVERABLES
1. `apps/api/src/config/env.schema.ts`:
   ```typescript
   /**
    * Zod-validated environment schema for `apps/api`.
    *
    * Layer: app/config. Used as the `ConfigModule.forRoot({ validate: validateEnv })`
    * entrypoint so a misconfigured deploy fails fast with a readable, aggregated message.
    */
   import { z } from 'zod'

   const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

   /** Whether a URL string resolves to a loopback host (parse failure ⇒ false). */
   function isLoopbackUrl(value: string): boolean {
     try { return LOOPBACK_HOSTS.has(new URL(value).hostname) } catch { return false }
   }

   /** Environment-variable schema for `apps/api`. */
   export const envSchema = z
     .object({
       NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
       PORT: z.coerce.number().int().positive().default(3001),
       DATABASE_URL: z.url(),
       REDIS_URL: z.url().optional(),                        // unset ⇒ InMemoryOtpStorage
       SMTP_URL: z.url().default('smtp://localhost:1025'),
       RESEND_API_KEY: z.string().min(1).optional(),         // set ⇒ ResendEmailProvider
       MAIL_FROM: z.string().min(1).default('no-reply@notification.local'),
       MAIL_FROM_NAME: z.string().optional(),
       DEFAULT_LOCALE: z.string().min(2).default('en'),
       OTP_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().default(600),
       OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),
       AUDIT_MASK_RECIPIENT: z.coerce.boolean().default(true),
       WEB_ORIGIN: z.url().default('http://localhost:3003'),
     })
     .superRefine((env, ctx) => {
       if (env.NODE_ENV !== 'production') return
       for (const key of ['DATABASE_URL', 'REDIS_URL'] as const) {
         const v = env[key]
         if (v !== undefined && isLoopbackUrl(v)) {
           ctx.addIssue({ code: 'custom', path: [key], message: 'must not point to localhost in production' })
         }
       }
       try {
         if (new URL(env.WEB_ORIGIN).protocol !== 'https:') {
           ctx.addIssue({ code: 'custom', path: ['WEB_ORIGIN'], message: 'must use https:// in production' })
         }
       } catch { /* already reported by z.url() */ }
     })

   /** Parsed, fully-defaulted environment shape. */
   export type Env = z.infer<typeof envSchema>

   /**
    * Validate raw environment variables, applying defaults.
    * @param config - Raw environment record (typically `process.env`).
    * @returns The parsed {@link Env}.
    * @throws {Error} When any variable fails validation; the message aggregates every offending key + reason.
    */
   export function validateEnv(config: Record<string, unknown>): Env {
     const parsed = envSchema.safeParse(config)
     if (!parsed.success) {
       const issues = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
         .join('\n')
       throw new Error(`Invalid environment configuration:\n${issues}`)
     }
     return parsed.data
   }
   ```
   (Re-verify the current Zod API via context7 — `z.url()` vs `z.string().url()`, `z.coerce`, and the issue shape moved
   between Zod majors; match whatever major Task 1.1 pinned.)
2. `apps/api/src/config/env.schema.spec.ts` — happy + failure paths:
   - valid minimal env (`DATABASE_URL` only) ⇒ `validateEnv` returns with defaults applied (PORT 3001, DEFAULT_LOCALE
     'en', AUDIT_MASK_RECIPIENT true, WEB_ORIGIN the dev default).
   - missing `DATABASE_URL` ⇒ throws, message names `DATABASE_URL`.
   - invalid `DATABASE_URL` (`'not-a-url'`) ⇒ throws.
   - `NODE_ENV=production` + loopback `DATABASE_URL` ⇒ throws (the production guard).
   - `NODE_ENV=production` + `WEB_ORIGIN=http://example.com` ⇒ throws (non-https guard).
   Use the api test runner (`describe`/`it`/`expect`); every `it()` carries a one-line comment explaining the branch.

Constraints:
- TS strict: zero `any`, zero suppression comments (`@ts-ignore`/`eslint-disable`). JSDoc on every export. English-only,
  timeless comments — no phase/task references. Functions ≤ 50 lines; SRP. Follow /bymax-workflow:standards.
- Do NOT write a NestJS module/bootstrap — only the schema + spec (P3 wires it into ConfigModule).

Verification:
- `pnpm -F api typecheck` — expected: exits 0.
- `pnpm -F api exec <jest|vitest> src/config/env.schema.spec.ts` (whichever the api runner is) — expected: all specs
  pass, including the failure-path assertions.
- `grep -rE "@ts-ignore|eslint-disable|: any" apps/api/src/config` — expected: no matches.

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 1.5 ✅ in its block + the Task index row; tick the satisfied criteria.
2. Header Progress `5 / 5`, Last updated today.
3. Update the P1 row Progress to `5 / 5` in docs/DEVELOPMENT_PLAN.md + Last updated.
4. Append `- 1.5 ✅ <YYYY-MM-DD> — Zod env schema + failure-path unit test` to ## Completion log.
5. Commit: `feat(api): fail-fast Zod env schema + unit test` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, in
docs/DEVELOPMENT_PLAN.md set the **P1 Status to ✅** and Progress `5 / 5` (Phase dashboard), set this file's header
Status to ✅, advance **Active phase** to `P2`, recompute **Overall progress** to `1 / 15 phases (7%)`, and commit
`docs(plan): P1 complete` (no Co-Authored-By).
````

---

## Phase Completion Protocol

When **Task 1.5** is `✅` and every other task is `✅`:

1. Confirm all 5 tasks are `✅` and the P1 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P1`](../DEVELOPMENT_PLAN.md#phase-1--local-stack--environment)
   is met: `pnpm infra:up` returns only when all three containers are healthy and the Mailpit UI is reachable at
   `:8025`; a missing/invalid env var aborts (the Zod schema is unit-tested for the failure path); `.env.example`
   documents every variable and the ports match OVERVIEW §8/§9.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P1 Status** to `✅`, **Progress** `5 / 5`, **Last
   updated** today (Phase dashboard); set **Active phase** to `P2`; recompute **Overall progress** to
   `1 / 15 phases (7%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `5 / 5 tasks`.
5. Commit `docs(plan): P1 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P1 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 1.3 ✅ 2026-06-23 — docker compose test stack (high ports: postgres 55432, redis 56379)
- 1.2 ✅ 2026-06-23 — docker compose dev stack (postgres/redis/mailpit) + init.sql
- 1.1 ✅ 2026-06-23 — apps/api skeleton package
