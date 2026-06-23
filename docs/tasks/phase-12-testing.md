# Phase 12 — Testing & 100% Coverage

> **Status**: 📋 ToDo · **Progress**: 0 / 6 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P12
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded *REQUIRED READING* — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

By the time this phase starts, every feature surface exists: the API (P3–P7 — `/health`, `/otp/*`, `/email/*`,
`/dispatch`, `/channels`, `/debug/key`, `/audit/{logs,stream,aggregate}`, `/admin/try-configure-*`) and the web console
(P8–P11 — Overview, Trigger Center, Audit Explorer, OTP, Providers, Roadmap, Settings, plus the `lib/**` clients,
hooks, and the error-code localization). Each prior phase shipped its own tests at, or near, 100% as it landed. The
`ci.yml` `unit` / `e2e-api` / `e2e-web` / `coverage-report` jobs exist as skeletons (P0) but are not yet fully wired or
green.

Phase 12 is the **hardening / gate-closing consolidation**: it consolidates the test infrastructure of both apps and
**closes the coverage walls** to a hard **100% on all four metrics** (statements / branches / functions / lines) in
`apps/api` (Jest + supertest) **and** `apps/web` (Vitest + Playwright). It bakes the `maxWorkers: '50%'` memory-safety
cap into both test configs, applies the coverage-scope exclusions (`*.module.ts`, `main.ts`, `*.dto.ts`, `*.d.ts`,
vendored `components/ui/**`) so the number stays meaningful, installs the **phantom-branch coverage shim** (a spec
tsconfig with `emitDecoratorMetadata: false` + Jest `ignoreCoverageForAllDecorators: true`), and makes the live
Playwright journeys pass against a running stack. When P12 is done, `pnpm test:cov` reports 100% in both workspaces, the
Playwright journeys pass against the live stack, every `it()` carries a scenario comment, and the CI `unit` +
`e2e-api` + `e2e-web` + `coverage-report` jobs are fully green.

The gold sources for the test configs are the sibling repos — copy and **adapt** their proven Jest / Vitest / Playwright
setups rather than inventing: `nest-logger-example` and `nest-auth-example` (both under `~/Documents/MyApps/bymax-one/`).
Note the siblings do **not** yet bake `maxWorkers: '50%'` into their configs — this phase **adds** that cap.

---

## Rules-of-phase

1. **Memory-safe execution — non-negotiable.** Bake `maxWorkers: '50%'` into **both** the Jest and Vitest configs;
   run suites **sequentially, one package at a time**, with `NODE_OPTIONS=--max-old-space-size=4096` as a guard.
   **Never fan out parallel test agents** and never run both apps' suites concurrently — the `file:` library link is
   duplicated into every worker, so peak memory = `workers × runners × agents`.
2. **No gate weakening to pass.** Reach 100% by writing real tests for genuine gaps or by removing genuinely-dead code —
   **never** by lowering a `coverageThreshold`, broadening a coverage exclusion to hide an untested file, or adding a
   suppression comment (`@ts-ignore`, `eslint-disable`, `/* istanbul ignore */`, `c8 ignore`).
3. **Coverage scope is meaningful.** Exclude only non-executable glue: `*.module.ts`, `main.ts`, `*.dto.ts`, `*.d.ts`
   (api); `components/ui/**` (vendored shadcn) and spec files (web). Every hand-written executable file is in scope.
4. **Phantom-branch shim.** The api unit project compiles with `emitDecoratorMetadata: false` (a `tsconfig.spec.json`)
   plus Jest `ignoreCoverageForAllDecorators: true`, so the unreachable `__metadata("design:paramtypes", …)` `: Object`
   fallback arms do not count as missed branches. The e2e project keeps `emitDecoratorMetadata` on (it boots real DI).
5. **Every `it()` carries a scenario comment** — a one-line block comment naming the scenario **and** the rule it
   protects (e.g. *"verify returns invalid_code with remainingAttempts — protects the atomic attempt counter from
   off-by-one"*). This is a coverage-of-intent gate, enforced by review.
6. **Live Playwright journeys** run against the **dedicated test stack** (`docker-compose.test.yml`, high ports), never
   the dev stack; the API `webServer` brings the stack up, migrates, and seeds before the journeys run.
7. **Timeless, English-only deliverables.** The committed test code, configs, and comments must be self-explanatory and
   carry **no** `Phase N` / `Task` / roadmap-stage references (this planning file may name phases freely; the code it
   describes may not).
8. **CI job names are contractual** — `unit`, `e2e-api`, `e2e-web`, `coverage-report` per
   [Appendix D](../DEVELOPMENT_PLAN.md#appendix-d--cicd-workflow-matrix). Do not rename them.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §17 Testing Strategy (the layer/tool matrix + the assertion style), §5 Repository
  Layout (the `apps/api/test/`, `apps/web/e2e/` trees + the coverage-scope exclusions), §8 Local Stack (the
  `maxWorkers` cap rationale).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P12, §2 Global Conventions (the coverage/memory-safe rows),
  §3 Autonomous Execution Model, Appendix C (Quality Gates + the coverage-shim & maxWorkers notes), Appendix D (CI
  matrix: `unit` / `e2e-api` / `e2e-web` / `coverage-report`).
- Sibling repos (gold test-config sources): `~/Documents/MyApps/bymax-one/nest-logger-example/`
  (`apps/api/{jest.config.cjs, tsconfig.spec.json, tsconfig.test.json}`, `apps/api/test/{jest-e2e.config.cjs, tsconfig.json}`,
  `apps/web/{vitest.config.ts, vitest.setup.ts, playwright.config.ts, e2e/}`) and
  `~/Documents/MyApps/bymax-one/nest-auth-example/apps/web/{playwright.config.ts, e2e/}` (the live-journey + global-setup pattern).
- `/bymax-workflow:standards` skill — universal coding rules. `tester` skill — for adding tests to existing code.
- Vault: [[Example-App-Standard]], [[NestJS/Bymax-Conventions]], [[Next.js/Bymax-Conventions]].

---

## Task index

| ID | Task | Status | Priority | Size | Depends on |
| --- | --- | --- | --- | --- | --- |
| 12.1 | API Jest harness + coverage shim + maxWorkers cap | 📋 ToDo | P0 | M | — |
| 12.2 | API unit coverage → 100% (services, providers, filter, config) | 📋 ToDo | P0 | L | 12.1 |
| 12.3 | API e2e coverage → 100% (supertest HTTP surface + isolated modules) | 📋 ToDo | P0 | L | 12.1 |
| 12.4 | Web Vitest harness + setup + maxWorkers cap | 📋 ToDo | P0 | M | — |
| 12.5 | Web unit coverage → 100% (lib, hooks, components, error-codes) | 📋 ToDo | P0 | L | 12.4 |
| 12.6 | Playwright live journeys + CI `e2e`/`coverage-report` green | 📋 ToDo | P0 | L | 12.2, 12.3, 12.5 |

---

## Tasks

### Task 12.1 — API Jest harness + coverage shim + maxWorkers cap

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Stand up the consolidated Jest test harness for `apps/api`: the unit config (with the phantom-branch coverage shim and
the `maxWorkers: '50%'` cap), the e2e config, the spec/test tsconfigs, and the coverage-scope exclusions — so the
100%-on-all-four-metrics gate is wired and enforceable before the gap-filling tasks run.

#### Acceptance criteria

- [ ] `apps/api/jest.config.cjs` — `rootDir: 'src'`, `testRegex: '.*\\.spec\\.ts$'`, native ESM (`useESM`,
  `extensionsToTreatAsEsm`, `--experimental-vm-modules` via the script), `ignoreCoverageForAllDecorators: true`,
  `tsconfig: '<rootDir>/../tsconfig.spec.json'`, `moduleNameMapper` stripping `.js`, `coverageThreshold.global` = 100 on
  all four metrics, `collectCoverageFrom` excluding `*.spec.ts` / `*.module.ts` / `main.ts` / `*.dto.ts` / `*.d.ts`, and
  **`maxWorkers: '50%'`**.
- [ ] `apps/api/tsconfig.spec.json` extends the test tsconfig and sets `emitDecoratorMetadata: false` (the phantom-branch
  shim); `apps/api/tsconfig.test.json` + `apps/api/test/tsconfig.json` present (e2e compiles with decorator metadata on).
- [ ] `apps/api/test/jest-e2e.config.cjs` — `rootDir: '../'`, `testRegex: '\\.e2e-spec\\.ts$'`,
  `testPathIgnorePatterns: ['/node_modules/', '/\\.stryker-tmp/']`, `testTimeout: 30000`, decorator metadata on.
- [ ] `apps/api/package.json` test scripts: `test`, `test:cov` (`--coverage`), `test:e2e` — each prefixed
  `NODE_OPTIONS='--experimental-vm-modules'`; root `pnpm --filter @nest-notification-example/api test:cov` runs and reports a coverage table.
- [ ] `pnpm --filter @nest-notification-example/api exec jest --listTests` resolves; the harness runs the **existing** specs green (the number may be
  < 100% until 12.2/12.3 fill gaps — that is expected here).

#### Files to create / modify

- `apps/api/jest.config.cjs`, `apps/api/tsconfig.spec.json`, `apps/api/tsconfig.test.json`
- `apps/api/test/jest-e2e.config.cjs`, `apps/api/test/tsconfig.json`
- `apps/api/package.json` (test scripts)

#### Agent prompt

````
You are a senior NestJS test-infrastructure engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib: multi-tenant, pluggable providers/storage, audit log, React hooks). pnpm monorepo, Node 24,
TypeScript 5.9 strict; apps/api (NestJS 11) + apps/web (Next.js 16). Quality floor: 100% coverage + Stryker ≥ 95.

CURRENT PHASE: 12 (Testing & 100% Coverage) — Task 12.1 of 6 (FIRST)

PRECONDITIONS
- The full API surface exists (P3–P7): /health, /otp/*, /email/*, /dispatch, /channels, /debug/key,
  /audit/{logs,stream,aggregate}, /admin/try-configure-*. Each shipped some tests already.
- A `tsconfig.json` exists under apps/api (the build tsconfig). The CI `unit`/`e2e-api` jobs exist as skeletons.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "17. Testing Strategy" (the layer/tool matrix + coverage-scope exclusions + the assertion style).
- docs/DEVELOPMENT_PLAN.md § "Appendix C — Quality Gates" (the coverage-shim + maxWorkers notes) and § "2. Global
  Conventions" (Test coverage + Memory-safe tests rows).
- Sibling gold configs (copy & ADAPT — do not invent): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/
  {jest.config.cjs, tsconfig.spec.json, tsconfig.test.json} and apps/api/test/{jest-e2e.config.cjs, tsconfig.json}.
  NOTE: the sibling configs do NOT yet set `maxWorkers` — you MUST add `maxWorkers: '50%'`.

TASK
Author the consolidated Jest harness for apps/api: the unit config (phantom-branch shim + maxWorkers cap), the e2e
config, the spec/test tsconfigs, and the coverage-scope exclusions, so the 100% gate is wired and enforceable.

DELIVERABLES
1. `apps/api/jest.config.cjs` — adapt the sibling. Key shape (illustrative):
   ```js
   'use strict'
   /** @type {import('jest').Config} */
   module.exports = {
     moduleFileExtensions: ['js', 'json', 'ts'],
     rootDir: 'src',
     testRegex: '.*\\.spec\\.ts$',
     extensionsToTreatAsEsm: ['.ts'],
     maxWorkers: '50%', // memory-safety cap (file: lib duplicated per worker)
     transform: {
       '^.+\\.(t|j)s$': ['ts-jest', {
         useESM: true,
         tsconfig: '<rootDir>/../tsconfig.spec.json', // emitDecoratorMetadata:false → no phantom paramtype branches
         ignoreCoverageForAllDecorators: true,
       }],
     },
     moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
     collectCoverageFrom: ['**/*.ts','!**/*.spec.ts','!**/*.module.ts','!main.ts','!**/*.dto.ts','!**/*.d.ts'],
     coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
     coverageReporters: ['text','text-summary','json-summary'],
     coverageDirectory: '../coverage',
     testEnvironment: 'node',
   }
   ```
2. `apps/api/tsconfig.spec.json` — `{ "extends": "./tsconfig.test.json", "compilerOptions": { "emitDecoratorMetadata": false } }`.
3. `apps/api/tsconfig.test.json` + `apps/api/test/tsconfig.json` — adapt the sibling (decorator metadata ON; include
   src + test; `types: ['node','jest']`). Drop the sibling's `../worker` includes (this repo has no worker).
4. `apps/api/test/jest-e2e.config.cjs` — `rootDir: '../'`, `testRegex: '\\.e2e-spec\\.ts$'`,
   `testPathIgnorePatterns: ['/node_modules/', '/\\.stryker-tmp/']`, `tsconfig: '<rootDir>/tsconfig.test.json'`,
   `ignoreCoverageForAllDecorators: true`, `maxWorkers: '50%'`, `testTimeout: 30000`, `testEnvironment: 'node'`.
5. `apps/api/package.json` test scripts — `test`, `test:cov` (`--coverage`), `test:e2e`, each prefixed
   `NODE_OPTIONS='--experimental-vm-modules'`; add `--config jest.config.cjs` / `--config test/jest-e2e.config.cjs`.

Constraints (follow /bymax-workflow:standards):
- TS strict; JSDoc `@fileoverview` block comment atop each new config explaining WHAT + WHY (timeless — no Phase/task
  refs). English-only. No suppression comments. No `maxWorkers` higher than `'50%'`.
- Do NOT lower the 100 thresholds; do NOT broaden the coverage exclusions beyond the listed glue.

Verification:
- `pnpm --filter @nest-notification-example/api exec jest --config jest.config.cjs --listTests` — expected: exit 0, lists the *.spec.ts files.
- `cat apps/api/tsconfig.spec.json` shows `"emitDecoratorMetadata": false`.
- `pnpm --filter @nest-notification-example/api test` — expected: the existing unit specs pass (coverage may be < 100% pre-gap-fill — OK here).
- `grep -c "maxWorkers" apps/api/jest.config.cjs apps/api/test/jest-e2e.config.cjs` — expected: 1 each.

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 6` and Last updated to today.
4. Update the P12 row Progress to `1 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 12.1 ✅ <YYYY-MM-DD> — API Jest harness + coverage shim + maxWorkers cap`.
6. Commit: `test(api): jest harness + coverage shim + maxWorkers cap` (no Co-Authored-By).
````

---

### Task 12.2 — API unit coverage → 100% (services, providers, filter, config)

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 12.1

#### Description

Fill every remaining gap in the `apps/api` **unit** suite (`src/**/*.spec.ts`) so the Jest unit run reports 100% on all
four metrics: the notification config factory, the custom Nodemailer provider, the Prisma log repository, the audit
interceptor, the `NotificationException` HTTP filter, the Zod env schema, and the `library-probe` token resolution.

#### Acceptance criteria

- [ ] `pnpm --filter @nest-notification-example/api test:cov` (unit project) reports **100%** branches / functions / lines / statements; the run
  is green and the `coverageThreshold.global` of 100 passes (no threshold lowered).
- [ ] Unit specs (constructed directly, no DI container) cover: `notification/notification.config.ts` (every env branch:
  SMTP vs Resend vs No-op, attachment-guard limit, default-envelope resolution), `providers/nodemailer-email.provider.ts`
  (`send` / `isConfigured` / `name`, transport error mapping), `providers/prisma-notification-log.repository.ts`
  (write-side), the `NotificationAuditInterceptor`, the `NotificationException → HTTP` filter (every error-code → status),
  `config/` Zod schema (valid + each fail-fast branch), and `library-probe.ts` (token/type resolution).
- [ ] Every `it()` carries a one-line scenario comment naming the scenario **and** the rule it protects.
- [ ] No `any`, no suppression comment, no `/* istanbul ignore */`; functions ≤ 50 lines; files ≤ 800.
- [ ] Coverage gaps are closed with real tests or by deleting genuinely-dead code — never by editing the exclusion list.

#### Files to create / modify

- `apps/api/src/**/*.spec.ts` (new/extended unit specs — co-located with their subject)
- (only if genuinely dead) the corresponding `apps/api/src/**` source file

#### Agent prompt

````
You are a senior NestJS test engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib:
multi-tenant, pluggable providers/storage, audit log). pnpm monorepo, Node 24, TS 5.9 strict. Quality floor: 100%
coverage all four metrics (Jest, apps/api).

CURRENT PHASE: 12 (Testing & 100% Coverage) — Task 12.2 of 6 (MIDDLE)

PRECONDITIONS
- Task 12.1 done: apps/api/jest.config.cjs (unit, maxWorkers '50%', shim) + tsconfig.spec.json exist; `pnpm --filter @nest-notification-example/api
  test:cov` runs and prints a coverage table (currently below 100% on some files — your job is to close every gap).
- The full API surface exists: notification.config.ts, providers/{nodemailer-email.provider,prisma-notification-log.
  repository}.ts, the NotificationAuditInterceptor, the NotificationException HTTP filter, config/ Zod schema,
  library-probe.ts. Each may already have partial specs.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "17. Testing Strategy" (assertion style: every it() names scenario + protected rule) and the
  § "6. Feature Coverage Matrix" rows for the api surface (the behaviors to assert).
- docs/DEVELOPMENT_PLAN.md § "Appendix C — Quality Gates" (the coverage shim explains why decorator branches don't count).
- Sibling assertion style (read for STYLE only, do not copy logger domain): ~/Documents/MyApps/bymax-one/
  nest-logger-example/apps/api/src — open 1–2 existing `*.spec.ts` to mirror the it()-comment convention.

TASK
Close every gap in the apps/api UNIT suite so the Jest unit run reports 100% on all four metrics, without weakening any
gate.

DELIVERABLES
1. `apps/api/src/**/*.spec.ts` — new or extended unit specs (co-located with subject) covering EVERY uncovered branch in:
   - `notification/notification.config.ts` — env permutations: SMTP set (Nodemailer→Mailpit), RESEND_API_KEY set
     (Resend), neither (No-op fallback); maxAttachmentBytes; default-envelope (from/fromName/replyTo/tags).
   - `providers/nodemailer-email.provider.ts` — `send` happy path returns {messageId}; transport throw → mapped error;
     `isConfigured`; `name`.
   - `providers/prisma-notification-log.repository.ts` — write-side persists a row; never logs OTP codes / unmasked PII.
   - the NotificationAuditInterceptor — wraps success + failure, swallowErrors path.
   - the NotificationException → HTTP filter — each NOTIFICATION_ERROR_CODES key → its HTTP status (e.g.
     EMAIL_ATTACHMENTS_TOO_LARGE → 413, TEMPLATE_NOT_FOUND → 404, cooldown → 429 with Retry-After).
   - `config/` Zod schema — a valid env parses; each required-missing / malformed branch fails fast.
   - `library-probe.ts` — the token + resolved-type references execute.
2. Each `it()` opens with a one-line scenario comment, e.g.:
   ```ts
   it('returns invalid_code with the decremented remainingAttempts', () => {
     // verify maps a wrong code to invalid_code and surfaces remainingAttempts —
     // protects the atomic attempt counter from an off-by-one regression.
     ...
   })
   ```
3. If a line is genuinely unreachable dead code, DELETE it (with justification in the commit body) — do NOT add an ignore
   comment and do NOT exclude the file.

Constraints (follow /bymax-workflow:standards):
- TS strict, no `any`. JSDoc on any exported test helper. English-only, timeless (no Phase/task refs in the test code).
- No suppression comments (`@ts-ignore`, `eslint-disable`, `/* istanbul ignore */`). Functions ≤ 50 lines, files ≤ 800.
- Run the suite SEQUENTIALLY with the baked `maxWorkers: '50%'`; never spawn parallel test agents.

Verification:
- `NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter @nest-notification-example/api test:cov` — expected: green, and the summary shows
  100% / 100% / 100% / 100% with the global threshold satisfied (exit 0).
- `pnpm --filter @nest-notification-example/api exec eslint src --max-warnings 0` — expected: exit 0 (no suppression comments survive).

Completion Protocol:
1. Set 12.2 ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress `2 / 6`, Last updated today.
3. Update the P12 row Progress to `2 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 12.2 ✅ <date> — API unit coverage → 100%`.
5. Commit: `test(api): unit coverage to 100% (services, providers, filter, config)` (no Co-Authored-By).
````

---

### Task 12.3 — API e2e coverage → 100% (supertest HTTP surface + isolated modules)

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 12.1

#### Description

Complete the `apps/api/test/*.e2e-spec.ts` supertest suite so the full HTTP surface is exercised against
`InMemoryOtpStorage` + a mocked transport (no Mailpit/Resend needed), and the startup-rejection / options-validation
isolated-module specs prove the `forRoot` / `forRootAsync` registration paths — bringing the combined (unit + e2e)
coverage to 100%.

#### Acceptance criteria

- [ ] `pnpm --filter @nest-notification-example/api test:e2e` is green and the **combined** (unit + e2e) coverage is 100% on all four metrics.
- [ ] e2e specs cover the live HTTP surface: `/health`; `/otp/{generate,verify,resend,consume}` + `/otp/status`
  (happy + invalid_code + cooldown 429 + expiry); `/email/{send,send-template}` (raw + template + locale fallback +
  oversize-attachment 413); `/dispatch` + `/channels`; `/audit/{logs,stream,aggregate}` (keyset page + SSE event +
  aggregate); `/debug/key`; and the `/admin/try-configure-{sms,push,async-useclass}` rejection endpoints.
- [ ] Isolated-module specs (`forroot-sync.e2e-spec.ts`, `options-validation.e2e-spec.ts`) prove `forRoot` /
  `forRootAsync` registration + the `useClass`/`useExisting` rejection + the fail-fast invalid-options branch — each
  compiles a throwaway module so the global module is re-registered per spec.
- [ ] e2e boots against `InMemoryOtpStorage` + a mocked `IEmailProvider`/transport (no network, no Mailpit/Resend); the
  e2e project compiles with `emitDecoratorMetadata` ON (real DI container).
- [ ] Every `it()` carries a scenario comment; no suppression comments; OTP codes / unmasked recipient PII never asserted
  in plaintext beyond the intended fixtures.

#### Files to create / modify

- `apps/api/test/*.e2e-spec.ts` (new/extended e2e specs)
- `apps/api/test/fixtures/**` (shared in-memory storage + mock transport helpers, if needed)

#### Agent prompt

````
You are a senior NestJS e2e / integration test engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
pnpm monorepo, Node 24, TS 5.9 strict. apps/api exposes the full controller surface. 100% coverage floor (Jest).

CURRENT PHASE: 12 (Testing & 100% Coverage) — Task 12.3 of 6 (MIDDLE)

PRECONDITIONS
- Task 12.1 done: apps/api/test/jest-e2e.config.cjs exists (rootDir '../', `\\.e2e-spec\\.ts$`, decorator metadata ON,
  maxWorkers '50%'); `pnpm --filter @nest-notification-example/api test:e2e` runs.
- The full controller surface exists (P3–P7). Some e2e specs may already exist.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "17. Testing Strategy" (api e2e row: "full HTTP surface against InMemoryOtpStorage + a mocked
  transport; the startup-rejection isolated-module tests") and § "6. Feature Coverage Matrix" rows #1, #3, #6 (the
  isolated-module proofs) + the otp/email/dispatch/audit/admin rows (the behaviors to assert end-to-end).
- docs/DEVELOPMENT_PLAN.md § P12 (Scope-In) + § "Appendix C" (e2e gate row).
- Sibling gold pattern (read for STRUCTURE only — do NOT copy logger domain): ~/Documents/MyApps/bymax-one/
  nest-logger-example/apps/api/test/{forroot-async.e2e-spec.ts, options-coverage.e2e-spec.ts} for the isolated-module
  re-registration pattern (Test.createTestingModule per spec), and any `*.e2e-spec.ts` that uses supertest.

TASK
Complete the supertest e2e suite + the isolated-module registration specs so the combined (unit+e2e) coverage is 100%,
booting against InMemoryOtpStorage + a mocked transport (no Mailpit/Resend).

DELIVERABLES
1. `apps/api/test/*.e2e-spec.ts` covering the HTTP surface with supertest:
   - `health.e2e-spec.ts` — GET /health → 200.
   - `otp.e2e-spec.ts` — generate (email + manual) → verify (happy → consumed; wrong code → invalid_code +
     remainingAttempts; expired → expired) → resend (cooldown 429 + Retry-After) → consume → status (never leaks code).
   - `email.e2e-spec.ts` — send (raw → {messageId}); send-template (registered template; pt-BR → en fallback;
     TEMPLATE_NOT_FOUND 404); oversize attachment → EMAIL_ATTACHMENTS_TOO_LARGE 413.
   - `dispatch.e2e-spec.ts` — POST /dispatch façade + GET /channels readiness badges.
   - `audit.e2e-spec.ts` — GET /audit/logs (keyset page shape), /audit/stream (one SSE event), /audit/aggregate.
   - `debug.e2e-spec.ts` — GET /debug/key returns a sha256 key (never the raw recipient).
   - `admin.e2e-spec.ts` — /admin/try-configure-{sms,push,async-useclass} each return the documented rejection.
2. Isolated-module specs:
   - `forroot-sync.e2e-spec.ts` — `BymaxNotificationModule.forRoot(options)` registers in a throwaway module.
   - `options-validation.e2e-spec.ts` — `forRootAsync` with invalid options fails fast; the `useClass`/`useExisting`
     rejection (`assertUseFactory`) throws.
3. `apps/api/test/fixtures/**` — a shared `InMemoryOtpStorage` wiring + a mock `IEmailProvider` (records sends, returns a
   stub messageId) so no network/SMTP is touched.
4. Each `it()` opens with a one-line scenario comment naming the scenario + the protected rule.

Constraints (follow /bymax-workflow:standards):
- TS strict, no `any`; JSDoc on exported fixtures. English-only, timeless (no Phase/task refs).
- No suppression comments. Never assert an OTP code or unmasked recipient in plaintext except inside an intended fixture.
- The e2e project keeps `emitDecoratorMetadata` ON (boots real DI). Run SEQUENTIALLY (maxWorkers '50%'); no parallel agents.

Verification:
- `NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter @nest-notification-example/api test:e2e` — expected: green (all e2e specs pass).
- `NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter @nest-notification-example/api test:cov` then `pnpm --filter @nest-notification-example/api test:e2e` — expected: the
  combined run leaves NO uncovered file (100% on all four metrics across unit + e2e).
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health` is NOT used here (e2e boots in-process, not the
  live server) — coverage + green specs are the gate.

Completion Protocol:
1. Set 12.3 ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress `3 / 6`, Last updated today.
3. Update the P12 row Progress to `3 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 12.3 ✅ <date> — API e2e coverage → 100%`.
5. Commit: `test(api): e2e supertest surface + isolated-module specs to 100%` (no Co-Authored-By).
````

---

### Task 12.4 — Web Vitest harness + setup + maxWorkers cap

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Stand up the consolidated Vitest harness for `apps/web`: the config (jsdom, the `@` alias, v8 coverage scoped to
hand-written `lib/`+`components/` with `components/ui/**` excluded, 100% thresholds, the `maxWorkers: '50%'` cap) and the
global setup (jest-dom matchers + the jsdom polyfills that recharts / Radix / virtualized tables need) — so the
web 100% gate is wired before the gap-filling task.

#### Acceptance criteria

- [ ] `apps/web/vitest.config.ts` — `environment: 'jsdom'`, `setupFiles: ['./vitest.setup.ts']`, the `@ → ./` alias
  (mirroring tsconfig `paths`), `include` of `{app,components,lib,hooks}/**/*.{test,spec}.{ts,tsx}`, v8 coverage with
  `include: ['lib/**','components/**']`, `exclude: ['components/ui/**','**/*.{test,spec}.{ts,tsx}']`, `thresholds` = 100
  on all four metrics, and **`test.maxWorkers: '50%'`**.
- [ ] `apps/web/vitest.setup.ts` — registers `@testing-library/jest-dom/vitest`; polyfills `ResizeObserver`,
  `IntersectionObserver`, `matchMedia`, `scrollIntoView`, and a non-zero `getBoundingClientRect` / `offsetWidth/Height`
  so recharts' `ResponsiveContainer` + virtualized tables mount under test.
- [ ] `apps/web/vitest-globals.d.ts` (or equivalent) present so the jest-dom matchers typecheck.
- [ ] `apps/web/package.json` scripts: `test` (`vitest run`), `test:watch`, `test:cov` (`vitest run --coverage`).
- [ ] `pnpm --filter web test:cov` runs and prints a coverage table (number may be < 100% until 12.5 — OK here).

#### Files to create / modify

- `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`, `apps/web/vitest-globals.d.ts`
- `apps/web/package.json` (test scripts)

#### Agent prompt

````
You are a senior Next.js / React test-infrastructure engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. pnpm monorepo, Node 24,
TS 5.9 strict; apps/web is Next.js 16 + React 19 (the Notification Console). Web tests: Vitest 4 (jsdom, v8); quality
floor 100% coverage on hand-written lib/** + components/** (vendored components/ui/** excluded).

CURRENT PHASE: 12 (Testing & 100% Coverage) — Task 12.4 of 6 (MIDDLE, independent of 12.1–12.3)

PRECONDITIONS
- apps/web exists (P8–P11): app/ pages, components/ (trigger/explorer/otp/providers/charts/controls/ui), lib/ (api-client,
  sse, filters, error-codes, severity), hooks/. Some *.test.tsx may exist. The CI `unit` job exists as a skeleton.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "17. Testing Strategy" (web unit row + the coverage-scope exclusions + the assertion style).
- docs/DEVELOPMENT_PLAN.md § "2. Global Conventions" (Test coverage + Memory-safe tests rows) + § "Appendix C".
- Sibling gold configs (copy & ADAPT): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/
  {vitest.config.ts, vitest.setup.ts, vitest-globals.d.ts}. NOTE: the sibling does NOT set `maxWorkers` — you MUST add
  `test.maxWorkers: '50%'`.

TASK
Author the Vitest harness for apps/web: the config (jsdom, alias, v8 coverage scoped + thresholds 100 + maxWorkers cap)
and the global setup (jest-dom + jsdom polyfills), so the web 100% gate is wired.

DELIVERABLES
1. `apps/web/vitest.config.ts` — adapt the sibling. Key shape (illustrative):
   ```ts
   export default defineConfig({
     plugins: [react()],
     resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
     test: {
       environment: 'jsdom',
       setupFiles: ['./vitest.setup.ts'],
       include: ['{app,components,lib,hooks}/**/*.{test,spec}.{ts,tsx}'],
       maxWorkers: '50%', // memory-safety cap (file: lib duplicated per fork)
       coverage: {
         provider: 'v8',
         reporter: ['text','text-summary','json-summary','html'],
         include: ['lib/**/*.{ts,tsx}','components/**/*.{ts,tsx}'],
         exclude: ['components/ui/**','**/*.{test,spec}.{ts,tsx}'],
         thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
       },
     },
   })
   ```
2. `apps/web/vitest.setup.ts` — import `@testing-library/jest-dom/vitest`; add the `ResizeObserver` /
   `IntersectionObserver` / `matchMedia` / `scrollIntoView` stubs and the fixed 800×400 `getBoundingClientRect` +
   `offsetWidth`/`offsetHeight` so recharts + virtualized tables render their branch code under test.
3. `apps/web/vitest-globals.d.ts` — the jest-dom matcher augmentation so specs typecheck.
4. `apps/web/package.json` — `test`, `test:watch`, `test:cov` scripts.

Constraints (follow /bymax-workflow:standards):
- TS strict; `@fileoverview` JSDoc atop the config + setup (timeless — no Phase/task refs). English-only.
- No suppression comments. Do NOT raise `maxWorkers` above `'50%'`. Do NOT add `lib/**`/`components/**` to the exclude
  list (only `components/ui/**` + spec files are excluded).

Verification:
- `pnpm --filter web test:cov` — expected: runs and prints a coverage table (exit code may be non-zero if < 100% before
  12.5 — the harness loading cleanly is the gate here).
- `grep -n "maxWorkers" apps/web/vitest.config.ts` — expected: one hit, `'50%'`.
- `grep -n "components/ui/\\*\\*" apps/web/vitest.config.ts` — expected: present in `exclude`.

Completion Protocol:
1. Set 12.4 ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress `4 / 6`, Last updated today.
3. Update the P12 row Progress to `4 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 12.4 ✅ <date> — Web Vitest harness + setup + maxWorkers cap`.
5. Commit: `test(web): vitest harness + jsdom setup + maxWorkers cap` (no Co-Authored-By).
````

---

### Task 12.5 — Web unit coverage → 100% (lib, hooks, components, error-codes)

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 12.4

#### Description

Fill every remaining gap in the `apps/web` Vitest suite so the run reports 100% on all four metrics across the
hand-written `lib/**`, `hooks/**`, and `components/**` (excluding vendored `components/ui/**`): the API client, the SSE
helper, the nuqs filters, the severity map, the error-code localization, the OTP box + countdown pill, and the audit
table.

#### Acceptance criteria

- [ ] `pnpm --filter web test:cov` reports **100%** branches / functions / lines / statements over `lib/**` +
  `components/**` (excluding `components/ui/**`); the run is green and the `thresholds` of 100 pass.
- [ ] Specs cover: `lib/api-client` (request/error mapping), `lib/sse` (event parse + reconnect), `lib/filters` (nuqs
  serialize/parse round-trip), `lib/error-codes` (**every** `NOTIFICATION_ERROR_CODES` key → a localized message — this
  is also what `audit:error-codes` audits), `lib/severity`; the `useOtpInput` / `useOtpCountdown` hooks (boundary +
  expiry + paste); the OTP box, countdown pill, audit table components (render + interaction + empty/error states).
- [ ] `pnpm --filter web run lint` passes; `pnpm audit:error-codes` passes (every error code localized).
- [ ] Every `it()` carries a scenario comment; no fake/placeholder class names asserted; real branches exercised; no
  suppression comments.

#### Files to create / modify

- `apps/web/{lib,hooks,components}/**/*.{test,spec}.{ts,tsx}` (new/extended specs co-located with their subject)
- (only if genuinely dead) the corresponding `apps/web/{lib,hooks,components}/**` source file

#### Agent prompt

````
You are a senior Next.js / React test engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is the Next.js 16 +
React 19 Notification Console; tests run on Vitest 4 (jsdom, v8). 100% coverage floor over hand-written lib/** +
components/** (vendored components/ui/** excluded). Uses recharts, Radix UI, @tanstack/react-virtual.

CURRENT PHASE: 12 (Testing & 100% Coverage) — Task 12.5 of 6 (MIDDLE)

PRECONDITIONS
- Task 12.4 done: apps/web/vitest.config.ts (jsdom, alias, coverage scoped + thresholds 100, maxWorkers '50%') +
  vitest.setup.ts (jest-dom + the recharts/Radix/virtual polyfills) exist; `pnpm --filter web test:cov` runs.
- apps/web surfaces exist (P8–P11): lib/{api-client,sse,filters,error-codes,severity}, hooks/{useOtpInput,useOtpCountdown},
  components/{trigger,explorer,otp,providers,charts,controls}. Some *.test.tsx may already exist.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "17. Testing Strategy" (web unit row + assertion style) and § "6. Feature Coverage Matrix" rows for
  the OTP box / countdown / audit table / error-code localization (the behaviors to assert).
- The `tester` skill conventions (100% file coverage, every it() carries a comment, no fake classNames, real branches).
- Sibling assertion style (read for STYLE only — do NOT copy logger domain): ~/Documents/MyApps/bymax-one/
  nest-logger-example/apps/web/components or lib — open 1–2 `*.test.tsx` to mirror the render + it()-comment convention.

TASK
Close every gap in the apps/web Vitest suite so the run reports 100% on all four metrics over lib/** + components/**
(excluding components/ui/**), without weakening any gate.

DELIVERABLES
1. `apps/web/{lib,hooks,components}/**/*.{test,spec}.{ts,tsx}` covering every uncovered branch:
   - `lib/api-client` — success + each error-status → mapped client error.
   - `lib/sse` — parse a delivery event; reconnect/backoff; close.
   - `lib/filters` (nuqs) — serialize → URL → parse round-trip for each facet.
   - `lib/error-codes` — assert EVERY NOTIFICATION_ERROR_CODES key resolves to a localized string (table-drive it).
   - `lib/severity` — each branch of the severity map.
   - `hooks/useOtpInput` — typing, paste of full code → onComplete, backspace/boundary.
   - `hooks/useOtpCountdown` — ticks down from expiresAt, hits 0, resend-enabled boundary.
   - components: OTP box (render, onComplete → verify), countdown pill (low-time styling), audit table (rows, empty
     state, error state, virtualized scroll) — using the jsdom polyfills from setup.
2. Each `it()` opens with a one-line scenario comment naming the scenario + the protected rule. Assert on real,
   user-visible text / roles — never a fabricated className.
3. If a line is genuinely unreachable, DELETE it (justify in the commit body) — do NOT add an ignore comment and do NOT
   widen the coverage exclude list.

Constraints (follow /bymax-workflow:standards):
- TS strict, no `any`. English-only, timeless (no Phase/task refs in the test code). No suppression comments.
  Functions ≤ 50 lines, files ≤ 800. Run SEQUENTIALLY (maxWorkers '50%'); never spawn parallel test agents.

Verification:
- `NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter web test:cov` — expected: green, summary shows
  100% / 100% / 100% / 100% over lib/** + components/** with the thresholds satisfied (exit 0).
- `pnpm --filter web run lint` — expected: exit 0.
- `pnpm audit:error-codes` — expected: exit 0 (every NOTIFICATION_ERROR_CODES key localized in apps/web).

Completion Protocol:
1. Set 12.5 ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress `5 / 6`, Last updated today.
3. Update the P12 row Progress to `5 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 12.5 ✅ <date> — Web unit coverage → 100%`.
5. Commit: `test(web): unit coverage to 100% (lib, hooks, components, error-codes)` (no Co-Authored-By).
````

---

### Task 12.6 — Playwright live journeys + CI `e2e`/`coverage-report` green

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 12.2, 12.3, 12.5

#### Description

Author the Playwright config + the live end-to-end journeys (generate OTP → Mailpit → verify; send email → Mailpit;
audit live-tail) against the **dedicated test stack**, wire the pre-flight + teardown helpers, and enrich `ci.yml` so the
`unit`, `e2e-api`, `e2e-web`, and `coverage-report` jobs run fully green — closing the phase.

#### Acceptance criteria

- [ ] `apps/web/playwright.config.ts` — `testDir: './e2e'`, `fullyParallel: false`, `workers: 1`, a `webServer` chain
  that brings up `docker-compose.test.yml` (high ports), runs `prisma migrate deploy` + the demo seed against the TEST
  database, then starts the API + web each gated on its `/health` (and the web origin); `reuseExistingServer: true`;
  generous timeouts; `globalTeardown` that only tears down on `E2E_TEARDOWN=1`.
- [ ] `apps/web/e2e/*.spec.ts` live journeys: **generate OTP → poll Mailpit for the code → verify → success**;
  **send raw + template email → assert it lands in Mailpit**; **Audit Explorer live-tail** shows a freshly-triggered
  delivery via SSE. Each journey runs against the live stack and passes.
- [ ] `apps/web/e2e/{ensure-stack.mjs, global-teardown.ts}` (pre-flight + teardown) present; `apps/web` `test:e2e`
  script = `node e2e/ensure-stack.mjs && playwright test`.
- [ ] `.github/workflows/ci.yml` `unit` (runs `apps/api` + `apps/web` coverage as **separate sequential steps**,
  uploads coverage), `e2e-api` (supertest), `e2e-web` (needs `e2e-api`; brings up the test stack, runs Playwright), and
  `coverage-report` jobs are present and **green on a PR**; job names match Appendix D.
- [ ] `pnpm test:cov` (root, `pnpm -r --workspace-concurrency=1`) reports 100% in both apps; Playwright journeys pass
  against the live stack.

#### Files to create / modify

- `apps/web/playwright.config.ts`, `apps/web/e2e/*.spec.ts`, `apps/web/e2e/ensure-stack.mjs`, `apps/web/e2e/global-teardown.ts`
- `apps/web/package.json` (the `test:e2e` script)
- `.github/workflows/ci.yml` (enrich `unit` / `e2e-api` / `e2e-web` / `coverage-report` jobs)

#### Agent prompt

````
You are a senior end-to-end / CI test engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
pnpm monorepo, Node 24, TS 5.9 strict. apps/api (NestJS) + apps/web (Next.js 16). The zero-credential email path is
Mailpit (real emails land in a browsable :8025 inbox). Live e2e uses Playwright against a dedicated test stack.

CURRENT PHASE: 12 (Testing & 100% Coverage) — Task 12.6 of 6 (LAST)

PRECONDITIONS
- Tasks 12.2, 12.3, 12.5 done: apps/api unit + e2e coverage = 100%, apps/web unit coverage = 100%.
- The local stack exists (P1): docker-compose.yml + docker-compose.test.yml (Postgres :55432, Redis :56379, Mailpit) +
  infra scripts (`pnpm infra:test:up`). The full UI exists (P8–P11). ci.yml has `unit`/`e2e-api`/`e2e-web`/
  `coverage-report` job skeletons (P0). The api+web `dev` scripts run on their assigned ports.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "17. Testing Strategy" (web e2e row: "the live journeys (generate → Mailpit → verify) against a
  running stack") and § "8. Local Stack" (the test stack + maxWorkers note).
- docs/DEVELOPMENT_PLAN.md § P12 (DoD) + § "Appendix D — CI/CD Workflow Matrix" (the `ci.yml` row: install → lint,
  typecheck, unit (coverage upload), e2e-api, e2e-web (needs e2e-api), export-usage-check, dependency-review,
  coverage-report — the CONTRACTUAL job names).
- Sibling gold patterns (copy & ADAPT — do NOT copy logger/auth domain): ~/Documents/MyApps/bymax-one/
  nest-logger-example/apps/web/{playwright.config.ts, e2e/ensure-stack.mjs, e2e/global-teardown.ts} (the webServer
  bring-up chain + reuse + teardown) and ~/Documents/MyApps/bymax-one/nest-auth-example/apps/web/{playwright.config.ts,
  e2e/global-setup.ts, e2e/*.spec.ts} (the live-journey spec style). Re-target ports/services to THIS repo (no worker;
  Postgres :55432, Redis :56379, Mailpit :1025/:8025).

TASK
Author the Playwright config + the live journeys against the dedicated test stack, wire the pre-flight + teardown, and
enrich ci.yml so `unit`/`e2e-api`/`e2e-web`/`coverage-report` run fully green — closing the phase.

DELIVERABLES
1. `apps/web/playwright.config.ts` — `@fileoverview` JSDoc; `testDir: './e2e'`, `fullyParallel: false`, `workers: 1`,
   `retries: 0`, `globalTeardown: './e2e/global-teardown.ts'`; a `webServer` chain:
   - entry 1 (API): `pnpm infra:test:up && <TEST_DATABASE_URL> pnpm --filter @nest-notification-example/api exec prisma migrate deploy &&
     <TEST_DATABASE_URL> pnpm --filter @nest-notification-example/api run db:seed && <TEST_ENV> pnpm --filter @nest-notification-example/api dev`, gated on `${API_URL}/health`,
     `reuseExistingServer: true`, `timeout: 300_000`.
   - entry 2 (web): `pnpm --filter web dev`, gated on the web origin, `reuseExistingServer: true`.
   Keep untrusted/test-only Postgres creds as throwaway test values (assemble from fragments so a secret scanner does not
   flag the well-known `postgres` login), not real secrets.
2. `apps/web/e2e/*.spec.ts` live journeys (each `it()`/`test()` carries a scenario comment):
   - `otp-journey.spec.ts` — Trigger/OTP page → generate (deliverVia email) → POLL Mailpit (GET http://127.0.0.1:8025/
     api/v1/messages) for the code → type it into the OTP box → assert verified.
   - `email-journey.spec.ts` — send raw + send-template → assert the message appears in Mailpit.
   - `audit-tail.spec.ts` — open Audit Explorer live-tail → trigger a delivery → assert the new row streams in via SSE.
3. `apps/web/e2e/ensure-stack.mjs` (idempotent pre-flight: Docker up, test stack `up -d --wait`, kill stale dev servers)
   + `apps/web/e2e/global-teardown.ts` (tear down only on `E2E_TEARDOWN=1`). Wire `test:e2e` =
   `node e2e/ensure-stack.mjs && playwright test`.
4. `.github/workflows/ci.yml` — enrich (do NOT rename jobs):
   - `unit` — run `pnpm --filter @nest-notification-example/api test:cov` and `pnpm --filter web test:cov` as SEPARATE sequential steps
     (`NODE_OPTIONS=--max-old-space-size=4096`); upload both coverage artifacts.
   - `e2e-api` — `pnpm --filter @nest-notification-example/api test:e2e`.
   - `e2e-web` — `needs: e2e-api`; bring up the test stack, run `pnpm --filter web test:e2e` with `E2E_TEARDOWN=1`.
   - `coverage-report` — consume the uploaded coverage, post/fail-if-below-100 summary.
   Keep top-level `permissions: contents: read`, pinned actions, `timeout-minutes`, placeholder `DATABASE_URL` so
   `prisma generate` runs.

Constraints (follow /bymax-workflow:standards):
- TS strict; `@fileoverview` JSDoc on the config + helpers. English-only, timeless (no Phase/task refs in any committed
  file). No suppression comments. Live e2e touches the dedicated test stack ONLY (never the dev stack). `fullyParallel:
  false` + `workers: 1` — never fan out; never run both apps' suites concurrently.

Verification:
- `pnpm --filter web exec playwright test --list` — expected: lists the journeys (config parses).
- `pnpm test:cov` (root) — expected: 100% in apps/api AND apps/web (runs sequentially via -r --workspace-concurrency=1).
- `pnpm --filter web test:e2e` (with Docker available) — expected: the live journeys pass; Mailpit shows the OTP/email.
- `pnpm dlx @action-validator/cli .github/workflows/ci.yml` — expected: valid; `grep -E "unit|e2e-api|e2e-web|coverage-report" .github/workflows/ci.yml` shows all four job names.

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 12.6 ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress `6 / 6`, Last updated today.
3. Update the P12 row Progress to `6 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 12.6 ✅ <date> — Playwright live journeys + CI e2e/coverage-report green`.
5. Commit: `test(web): playwright live journeys + CI e2e/coverage-report green` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, in
docs/DEVELOPMENT_PLAN.md set the P12 **Status to ✅** and **Progress `6 / 6`**, advance **Active phase** to P13, recompute
**Overall progress** to `12 / 15 phases (80%)`, set this file's header Status to ✅, and commit `docs(plan): P12 complete`.
````

---

## Phase Completion Protocol

When **Task 12.6** is `✅` and every other task is `✅`:

1. Confirm all 6 tasks are `✅` and the P12 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P12`](../DEVELOPMENT_PLAN.md#phase-12--testing--100-coverage)
   is met: `pnpm test:cov` reports **100%** on all four metrics in `apps/api` **and** `apps/web`; the Playwright journeys
   pass against the live stack; CI `unit` + `e2e-api` + `e2e-web` + `coverage-report` are green; every `it()` carries a
   scenario comment.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P12 Status** to `✅`, **Progress** `6 / 6`, **Last
   updated** today; set **Active phase** to `P13`; recompute **Overall progress** to `12 / 15 phases (80%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `6 / 6 tasks`.
5. Commit `docs(plan): P12 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P12 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

_(empty — no tasks completed yet)_
