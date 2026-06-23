# Phase 13 — Mutation Hardening

> **Status**: 📋 ToDo · **Progress**: 0 / 5 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P13
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

Phase 12 closed the coverage walls: `pnpm test:cov` reports **100%** on all four metrics in both `apps/api` (Jest 30,
native ESM) and `apps/web` (Vitest 4, jsdom), the Playwright journeys pass, and CI's `unit` / `e2e-api` / `e2e-web` /
`coverage-report` jobs are green. Coverage proves every line runs; it does **not** prove the assertions are sharp.

Phase 13 adds the **mutation gate** on top. Stryker 9.6 mutates the source of both apps and re-runs the unit suite once
per mutant; a _surviving_ mutant means a behavioural change the tests did not catch. The bar (DEVELOPMENT_PLAN §2 +
[Appendix C](../DEVELOPMENT_PLAN.md#appendix-c--quality-gates)) is `break ≥ 95` **mandatory** on both apps, driven to
**100 on `apps/api`** and **100 on `apps/web` `lib/**`** with `components/**` (vendored shadcn UI) driven as high as
achievable. We **never weaken a gate to pass** — every survivor is either killed by a sharper assertion, deleted as
genuinely-dead code, or documented as a **provable equivalent\*\* in `docs/stryker/`.

When P13 is done: `pnpm --filter @nest-notification-example/api exec stryker run` and the web equivalent both pass their
`break` thresholds; the survivor inventory and the path-to-the-gate are recorded in
`docs/stryker/{BASELINE,HISTORY,IMPLEMENTATION_PLAN}.md`; and the P0 skeletons `mutation.yml` (incremental, PR-changed
workspaces) + `mutation-nightly.yml` (full, Monday, opens a `mutation-drift` issue) are wired to real configs and run
green.

The gold sources are the sibling **`nest-logger-example`** (the proven `stryker.config.json`, `jest.stryker.config.cjs`,
`docs/stryker/*` shape, and the mutation workflows) — copy and **adapt**, never invent.

---

## Rules-of-phase

1. **Never weaken a gate to pass.** A survivor is resolved by a sharper test, by deleting genuinely-dead code, or by
   documenting it as a provable equivalent — **never** by lowering `break`, enabling `ignoreStatic` on `apps/api`, or
   widening the `mutate` exclusions to hide a file.
2. **Thresholds are contractual** (Appendix C): `apps/api` `break: 100`; `apps/web` `break: 95` with `lib/**` held at
   **100** and `components/**` driven up. The mandatory floor is `95` on both — dropping below it is a CI failure.
3. **Stryker runs the UNIT suite only.** e2e/supertest specs are flaky under Stryker instrumentation — exclude them via
   the dedicated `jest.stryker.config.cjs` (api) and the Vitest runner's default test glob (web). Coverage is **off**
   inside the Stryker runner (a mutated line would falsely trip the 100% coverage gate).
4. **Memory-safe execution** — Stryker `concurrency: 4` (not unbounded); run **one app's** mutation at a time, in the
   main agent; never fan out parallel test/mutation agents (the `file:`-linked library duplicates per worker).
5. **Equivalent mutants are documented, not silenced blindly.** Each accepted survivor gets a row in
   `IMPLEMENTATION_PLAN.md` _and_ a co-located `// Stryker disable …` comment in source stating the same rationale —
   never a blanket disable.
6. **Timeless source.** The deliverable configs/comments/workflows are committed code — **no** `Phase`/`Task`/roadmap
   references in them. (This planning file may name phases freely; the artefacts it describes may not.) English-only,
   TS strict, JSDoc on every export, no suppression comments (`@ts-ignore`, `eslint-disable`).
7. **Conventional Commits**, no `Co-Authored-By` trailer.
8. **Versions** — Stryker 9.6, Node 24, pnpm 11.x ([`OVERVIEW.md §4`](../OVERVIEW.md#4-tech-stack)); pin via
   `packageManager` / the lockfile.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §5 Repository Layout (the `apps/*/stryker.config.json` + `docs/stryker/` target
  paths), §17 Testing Strategy (the mutation row + the per-`it()` scenario-comment rule), Appendix C/D references.
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P13, §2 Global Conventions (Mutation/Memory-safe rows),
  §3 Autonomous Execution Model, Appendix C (Quality Gates + the _Mutation bar_ note), Appendix D (CI Matrix —
  `mutation.yml` / `mutation-nightly.yml` rows).
- Sibling repo (gold sources): `~/Documents/MyApps/bymax-one/nest-logger-example/` —
  `apps/api/{stryker.config.json, jest.stryker.config.cjs}`, `apps/web/stryker.config.json`,
  `docs/stryker/{BASELINE.md, HISTORY.md, IMPLEMENTATION_PLAN.md}`,
  `.github/workflows/{mutation.yml, mutation-nightly.yml}`.
- `/bymax-workflow:standards` skill — universal coding rules. Re-verify Stryker 9.x JSON-config options via
  context7/WebSearch where a version moved.

---

## Task index

| ID   | Task                                                                 | Status  | Priority | Size | Depends on |
| ---- | -------------------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 13.1 | api Stryker config + baseline measurement                            | 📋 ToDo | P0       | M    | —          |
| 13.2 | api hardening → `break: 100` (kill survivors / document equivalents) | 📋 ToDo | P0       | L    | 13.1       |
| 13.3 | web Stryker config + `lib/**` → 100, `components/**` driven up       | 📋 ToDo | P0       | L    | —          |
| 13.4 | `docs/stryker/{BASELINE,HISTORY,IMPLEMENTATION_PLAN}.md`             | 📋 ToDo | P1       | M    | 13.2, 13.3 |
| 13.5 | Wire `mutation.yml` + `mutation-nightly.yml` to real configs         | 📋 ToDo | P0       | M    | 13.2, 13.3 |

---

## Tasks

### Task 13.1 — api Stryker config + baseline measurement

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Add the `apps/api` Stryker configuration (and the dedicated Jest runner config it drives) and capture the **first**
mutation measurement of the API. This task does **not** fix survivors — it establishes a runnable, threshold-aware
config and records the pre-hardening number that 13.2 drives to 100.

#### Acceptance criteria

- [ ] `apps/api/stryker.config.json` exists: `jest` runner via a custom `jest.stryker.config.cjs`, `checkers: ["typescript"]`
      with `tsconfigFile`, `coverageAnalysis: "perTest"`, the `mutate` glob excluding `*.spec.ts`/`*.module.ts`/`main.ts`/
      `*.dto.ts`/`*.d.ts`/`index.ts`/`library-probe.ts`, `thresholds: { high: 100, low: 100, break: 100 }`, `concurrency: 4`,
      `incremental: true` + `incrementalFile`, HTML+JSON reporters under `reports/mutation/api.*`.
- [ ] `apps/api/jest.stryker.config.cjs` exists: re-runs the **unit** suite only (`testMatch: src/**/*.spec.ts`),
      `collectCoverage: false`, excludes `dist/` + `.stryker-tmp/`, native-ESM transform (`useESM`, `ignoreCoverageForAllDecorators`).
- [ ] `apps/api/package.json` has `mutation` (`stryker run --force`) + `mutation:incremental` (`stryker run`) scripts and
      the Stryker devDependencies (`@stryker-mutator/core`, `jest-runner`, `typescript-checker`) at 9.6.x.
- [ ] `pnpm --filter @nest-notification-example/api run mutation` completes and prints a mutation score; the run is
      recorded for 13.4 (score, killed, survived, timeout, no-cov).
- [ ] `apps/web` is untouched by this task.

#### Files to create / modify

- `apps/api/stryker.config.json`, `apps/api/jest.stryker.config.cjs`
- `apps/api/package.json` (scripts + devDependencies)

#### Agent prompt

````
You are a senior test-quality / mutation-testing engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib: multi-tenant, pluggable providers/storage, audit log, React hooks). pnpm monorepo (apps/api NestJS 11
+ apps/web Next.js 16), Node 24, TypeScript 5.9 strict; the quality floor is 100% coverage + Stryker break ≥ 95.

CURRENT PHASE: 13 (Mutation Hardening) — Task 13.1 of 5 (FIRST)

PRECONDITIONS
- Phase 12 done: apps/api has 100% Jest unit coverage; jest.config.cjs + tsconfig.spec.json exist; e2e specs live under
  apps/api/test (supertest). No Stryker config exists yet in apps/api.

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Appendix C — Quality Gates" (the Mutation rows + the *Mutation bar* note: api break 100)
  and § "2. Global Conventions" (Mutation + Memory-safe rows).
- docs/OVERVIEW.md § "5. Repository Layout" (the apps/api/stryker.config.json path) and § "17. Testing Strategy"
  (Stryker scope = unit suite only; api break 100).
- Sibling gold sources (copy & ADAPT — change the package name + drop logger-specific excludes):
  ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/{stryker.config.json, jest.stryker.config.cjs}.

TASK
Add the apps/api Stryker + Stryker-Jest config and capture the first (pre-hardening) API mutation measurement.

DELIVERABLES
1. `apps/api/stryker.config.json` — adapted from the sibling. Key shape (adjust excludes to THIS app's tree):
   ```json
   {
     "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
     "packageManager": "pnpm",
     "plugins": ["@stryker-mutator/jest-runner", "@stryker-mutator/typescript-checker"],
     "testRunner": "jest",
     "jest": { "projectType": "custom", "configFile": "jest.stryker.config.cjs" },
     "coverageAnalysis": "perTest",
     "checkers": ["typescript"],
     "tsconfigFile": "tsconfig.json",
     "typescriptChecker": { "prioritizePerformanceOverAccuracy": true },
     "disableTypeChecks": "src/**/*.ts",
     "mutate": [
       "src/**/*.ts",
       "!src/**/*.spec.ts", "!src/**/*.module.ts", "!src/main.ts",
       "!src/**/*.dto.ts", "!src/**/*.d.ts", "!src/**/index.ts",
       "!src/library-probe.ts"
     ],
     "thresholds": { "high": 100, "low": 100, "break": 100 },
     "concurrency": 4, "timeoutMS": 60000,
     "incremental": true, "incrementalFile": "reports/stryker-incremental.json",
     "reporters": ["progress", "clear-text", "html", "json"],
     "htmlReporter": { "fileName": "reports/mutation/api.html" },
     "jsonReporter": { "fileName": "reports/mutation/api.json" },
     "tempDirName": ".stryker-tmp", "cleanTempDir": true
   }
   ```
2. `apps/api/jest.stryker.config.cjs` — runs ONLY src/**/*.spec.ts, `collectCoverage: false`, ignores dist/ +
   .stryker-tmp/, native-ESM ts-jest transform with `ignoreCoverageForAllDecorators: true`, `tsconfig.spec.json`.
3. `apps/api/package.json` — add scripts `"mutation": "stryker run --force"` and
   `"mutation:incremental": "stryker run"`; add devDependencies `@stryker-mutator/core`,
   `@stryker-mutator/jest-runner`, `@stryker-mutator/typescript-checker` at ^9.6.0.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every export, English-only, no suppression comments. Per this
  phase: do NOT enable `ignoreStatic` on api; do NOT widen `mutate` excludes to hide a file; `break` stays 100; the .cjs
  is intentional (Jest 30 needs ts-node to parse .ts config). Timeless comments — no Phase/Task references in source.
- Run mutation in the main agent only (concurrency 4); never spawn parallel test agents (memory safety).
- After editing package.json: `pnpm install --no-frozen-lockfile`, then commit the updated lockfile.

Verification:
- `pnpm --filter @nest-notification-example/api run mutation` — expected: completes, prints a mutation score and a
  survivor breakdown; writes reports/mutation/api.{html,json}. (The run MAY exit 1 if below break:100 — that is the
  pre-hardening baseline; 13.2 drives it to 100.)
- `cat apps/api/reports/mutation/api.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const m=JSON.parse(s);console.log('files:',Object.keys(m.files).length)})"`
  — expected: prints the mutated-file count (sanity that the report exists).
- Record score/killed/survived/timeout/no-cov from the clear-text summary for handoff to 13.4.

Completion Protocol (run after finishing):
1. Set this task's Status to ✅ in its block AND the ## Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Bump the file-header Progress to `1 / 5` and Last updated to today.
4. Update the P13 row Progress cell to `1 / 5` in docs/DEVELOPMENT_PLAN.md.
5. Append to ## Completion log: `- 13.1 ✅ <YYYY-MM-DD> — api Stryker config + baseline measurement`.
6. Commit: `test(api): add stryker config + jest-runner config` (no Co-Authored-By).
````

---

### Task 13.2 — api hardening → `break: 100`

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 13.1

#### Description

Drive `apps/api` to a **green `break: 100`** mutation run: work the HTML report file-by-file (survivors descending),
kill each survivor with a sharper unit assertion, delete any genuinely-dead code, and document the residue as
**provable equivalents** (a `// Stryker disable` comment in source + a row staged for `IMPLEMENTATION_PLAN.md`).

#### Acceptance criteria

- [ ] `pnpm --filter @nest-notification-example/api run mutation` exits **0** with mutation score meeting `break: 100`
      (zero _un-disabled_ survivors; only documented equivalents remain, each carrying a `// Stryker disable` comment).
- [ ] Every new/changed `it()` carries a block comment naming the scenario and the rule it protects (per OVERVIEW §17).
- [ ] No gate was weakened: `break` is still `100`, `ignoreStatic` is **not** set, and no file was added to the `mutate`
      exclusions to hide survivors (excludes remain the non-executable glue from 13.1).
- [ ] `apps/api` unit coverage is still **100%** (`pnpm --filter @nest-notification-example/api run test:cov`) — the
      hardening tests did not regress coverage.
- [ ] Each accepted equivalent has a co-located `// Stryker disable <Mutator> <reason>` comment AND a notes entry handed
      to 13.4 (file · ~line · mutator · why-equivalent).

#### Files to create / modify

- `apps/api/src/**/*.spec.ts` (new/sharpened assertions)
- `apps/api/src/**/*.ts` (only `// Stryker disable` comments on proven equivalents, or deletion of dead code)

#### Agent prompt

````
You are a senior test-quality / mutation-testing engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib:
multi-tenant, pluggable providers/storage, audit log). apps/api is the NestJS service (OTP/email/dispatch/audit/admin
controllers, the env-driven notification config factory, the custom nodemailer provider + the Prisma audit repository,
the NotificationException→HTTP filter, the x-tenant-id guard, the Zod pipe).

CURRENT PHASE: 13 (Mutation Hardening) — Task 13.2 of 5 (MIDDLE)

PRECONDITIONS
- Task 13.1 done: apps/api/stryker.config.json (break:100) + jest.stryker.config.cjs exist; the baseline run produced
  reports/mutation/api.html with a survivor list. apps/api has 100% unit coverage.

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Appendix C — Quality Gates" (the *Mutation bar* note: api break 100, survivors documented
  as provable equivalents) and § P13 (Rules-of-phase: never weaken a gate; fix the test or remove dead code).
- docs/OVERVIEW.md § "17. Testing Strategy" (Stryker scope = unit suite; the per-it() scenario-comment style;
  interceptors/filters tested with a mocked ExecutionContext, NOT supertest).
- Sibling gold source (the proven hardening recipe + the equivalent-mutant patterns — adapt the rationales to THIS
  domain): ~/Documents/MyApps/bymax-one/nest-logger-example/docs/stryker/IMPLEMENTATION_PLAN.md
  (§ "Hardening order (apps/api)", § "Stack gotchas", § "Equivalent mutants").

TASK
Drive apps/api to a green `break: 100` Stryker run — kill survivors with sharper assertions, delete dead code, and
document the residue as provable equivalents.

DELIVERABLES
1. Sharpened/added unit specs under `apps/api/src/**/*.spec.ts` killing the survivors. Patterns to apply:
   - **StringLiteral on route/path decorators** → assert the route + HTTP method via the NestJS reflector in a unit spec.
   - **ConditionalExpression / LogicalOperator / EqualityOperator** in services (OTP attempt counter, dispatch channel
     resolution, audit keyset/aggregate) → assert exact return values for every branch and the boundary values.
   - **StringLiteral in error codes / messages** → assert on the emitted NOTIFICATION_ERROR_CODES value, never on prose.
   - **Interceptor / exception-filter mutants** → unit-test with a mocked ExecutionContext (`getRequest`/`getResponse`/
     `getHandler`); do NOT use supertest (it is excluded from the Stryker runner and is flaky under instrumentation).
   - Every new/changed `it()` gets a `// scenario: <what> — protects <rule>` block comment.
2. For each GENUINELY equivalent survivor, a co-located source comment, e.g.:
   ```ts
   // Stryker disable next-line StringLiteral: caught internally, never observable by callers
   ```
   and a notes line (file · ~line · mutator · why-equivalent) handed to Task 13.4.
3. Delete any genuinely-dead code a survivor exposes (rather than disabling it).

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on exports, English-only, no @ts-ignore / eslint-disable.
- NEVER weaken the gate: break stays 100; do NOT set ignoreStatic; do NOT add files to the `mutate` exclusions to hide
  survivors. A survivor is killed, deleted, or proven-equivalent — nothing else.
- Run mutation in the main agent only (concurrency 4); never fan out parallel test/mutation agents (memory safety).
- Timeless comments — no Phase/Task references in source or in the `// Stryker disable` rationales.

Verification:
- `pnpm --filter @nest-notification-example/api run mutation` — expected: exit 0; clear-text summary shows the score
  meeting break:100 with zero un-disabled survivors.
- `pnpm --filter @nest-notification-example/api run test:cov` — expected: still 100% on all four metrics.
- `grep -rn "Stryker disable" apps/api/src` — expected: every match has an inline rationale (no blanket file-level disable).

Completion Protocol:
1. Set 13.2 Status ✅ in its block AND the ## Task index row; tick its acceptance checkboxes.
2. Bump file-header Progress to `2 / 5` + Last updated today.
3. Update the P13 row Progress cell to `2 / 5` in docs/DEVELOPMENT_PLAN.md.
4. Append to ## Completion log: `- 13.2 ✅ <YYYY-MM-DD> — api hardened to break:100`.
5. Commit: `test(api): harden mutation score to break:100` (no Co-Authored-By).
````

---

### Task 13.3 — web Stryker config + `lib/**` → 100, `components/**` driven up

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: —

#### Description

Add the `apps/web` Stryker configuration (Vitest runner) and drive the web mutation score: hold `lib/**` at **100%**
(error-code catalog, API client, SSE, filter compiler, severity helpers) and drive `components/**` (excluding the
vendored `components/ui/**` shadcn primitives) as high as achievable, meeting the mandatory `break: 95` floor.

#### Acceptance criteria

- [ ] `apps/web/stryker.config.json` exists: `vitest` runner, `coverageAnalysis: "perTest"`, `ignoreStatic: true`,
      `mutate` covers `lib/**/*.ts` + `components/**/*.tsx` and excludes `*.test.*`/`*.spec.*`/`components/ui/**`/`*.d.ts`,
      `thresholds: { high: 100, low: 95, break: 95 }`, `concurrency: 4`, `incremental` + `incrementalFile`, HTML+JSON
      reporters under `reports/mutation/web.*`.
- [ ] `apps/web/package.json` has `mutation` (`stryker run --force`) + `mutation:incremental` (`stryker run`) scripts and
      the Stryker devDependencies (`@stryker-mutator/core`, `@stryker-mutator/vitest-runner`) at 9.6.x.
- [ ] `pnpm --filter web run mutation` exits **0** meeting `break: 95`, with **`lib/**`at
100%** (every survivor in`lib/**`killed or proven-equivalent) and`components/**` driven up.
- [ ] `apps/web` unit coverage is still **100%** (`pnpm --filter web run test:cov`).
- [ ] Each accepted `lib/**` equivalent has a co-located `// Stryker disable` comment + a notes entry for 13.4; no gate
      was weakened (`break` ≥ 95, exclusions limited to `components/ui/**` + test/types).

#### Files to create / modify

- `apps/web/stryker.config.json`, `apps/web/package.json`
- `apps/web/lib/**/*.test.ts(x)`, `apps/web/components/**/*.test.tsx` (sharpened assertions)
- `apps/web/lib/**/*.ts` (only `// Stryker disable` on proven equivalents, or dead-code deletion)

#### Agent prompt

````
You are a senior test-quality / mutation-testing engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is the Notification
Console (Next.js 16 + React 19): lib/** (api-client, sse, nuqs filters, error-codes from the lib's ./shared subpath,
severity helpers) + components/** (trigger/explorer/otp/providers/charts/controls) over a verbatim shadcn ui/ kit.

CURRENT PHASE: 13 (Mutation Hardening) — Task 13.3 of 5 (MIDDLE)

PRECONDITIONS
- Phase 12 done: apps/web has 100% Vitest unit coverage; vitest.config.ts exists. No Stryker config exists in apps/web.

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Appendix C — Quality Gates" (Mutation — web: break ≥ 95, `lib/**` 100, `components/**`
  driven up) and § P13 (never weaken a gate).
- docs/OVERVIEW.md § "5. Repository Layout" (apps/web/stryker.config.json path; the lib/ vs components/ vs components/ui/
  split) and § "17. Testing Strategy" (web unit = Vitest; lib/** held at 100; components/** floored).
- Sibling gold source (copy & ADAPT thresholds — this project's web floor is break 95, NOT 90):
  ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/stryker.config.json and its
  docs/stryker/IMPLEMENTATION_PLAN.md § "Hardening order (apps/web)".

TASK
Add the apps/web Stryker config, hold lib/** at 100%, drive components/** up, and pass break: 95.

DELIVERABLES
1. `apps/web/stryker.config.json` — adapted from the sibling, with THIS project's threshold:
   ```json
   {
     "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
     "packageManager": "pnpm",
     "plugins": ["@stryker-mutator/vitest-runner"],
     "testRunner": "vitest",
     "coverageAnalysis": "perTest",
     "ignoreStatic": true,
     "mutate": [
       "lib/**/*.ts", "components/**/*.tsx",
       "!**/*.test.ts", "!**/*.test.tsx", "!**/*.spec.ts", "!**/*.spec.tsx",
       "!components/ui/**", "!lib/**/*.d.ts"
     ],
     "thresholds": { "high": 100, "low": 95, "break": 95 },
     "concurrency": 4, "timeoutMS": 60000,
     "incremental": true, "incrementalFile": "reports/stryker-incremental.json",
     "reporters": ["progress", "clear-text", "html", "json"],
     "htmlReporter": { "fileName": "reports/mutation/web.html" },
     "jsonReporter": { "fileName": "reports/mutation/web.json" },
     "tempDirName": ".stryker-tmp", "cleanTempDir": true
   }
   ```
2. `apps/web/package.json` — add `"mutation": "stryker run --force"` + `"mutation:incremental": "stryker run"` and
   devDependencies `@stryker-mutator/core`, `@stryker-mutator/vitest-runner` at ^9.6.0.
3. Sharpened tests under `apps/web/lib/**/*.test.ts(x)` (kill EVERY lib/** survivor — exact outputs for all branches and
   edge values: error-code localization, filter/query compilation, severity mapping, SSE parse) and
   `apps/web/components/**/*.test.tsx` (kill reasonable component survivors: null/undefined branches, equality checks).
4. For each genuinely-equivalent lib/** survivor, a co-located `// Stryker disable` comment + a notes line for Task 13.4.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on exports, English-only, no suppression comments.
- Floor is break: 95; lib/** must reach 100. Do NOT exclude any lib/** file or any non-ui component to inflate the score;
  the only component exclusion is the vendored `components/ui/**`. Timeless comments — no Phase/Task references.
- Run mutation in the main agent only (concurrency 4); never fan out parallel test/mutation agents (memory safety).

Verification:
- `pnpm --filter web run mutation` — expected: exit 0; clear-text summary score ≥ 95 with
  lib/** showing 100% (no un-disabled lib/** survivors).
- `pnpm --filter web run test:cov` — expected: still 100% on all four metrics.
- `node -e "const m=require('./apps/web/reports/mutation/web.json');console.log('ok')"` — expected: report exists.

Completion Protocol:
1. Set 13.3 Status ✅ in its block AND the ## Task index row; tick its acceptance checkboxes.
2. Bump file-header Progress to `3 / 5` + Last updated today.
3. Update the P13 row Progress cell to `3 / 5` in docs/DEVELOPMENT_PLAN.md.
4. Append to ## Completion log: `- 13.3 ✅ <YYYY-MM-DD> — web stryker config, lib/** 100, break:95`.
5. Commit: `test(web): add stryker config + harden lib/** to 100` (no Co-Authored-By).
````

---

### Task 13.4 — `docs/stryker/{BASELINE,HISTORY,IMPLEMENTATION_PLAN}.md`

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: M
- **Depends on**: 13.2, 13.3

#### Description

Author the mutation documentation set: the pre-hardening **BASELINE**, the append-only **HISTORY** run log, and the
**IMPLEMENTATION_PLAN** (hardening order + stack gotchas + the accepted-equivalent-mutants table) — sourcing the numbers
and rationales recorded by 13.1, 13.2 and 13.3.

#### Acceptance criteria

- [ ] `docs/stryker/BASELINE.md` records the first (pre-hardening) api + web measurements (score, killed, survived,
      timeout, no-cov, break threshold, exit code) with a per-file survivor table, and links Appendix C + the P13 task file.
- [ ] `docs/stryker/HISTORY.md` is an append-only, newest-on-top table (Date · Workspace · Score · Killed · Survived ·
      Timeout · No-cov · Ignored · Note) with the baseline rows **and** the final green rows (api `break:100`, web `break:95`).
- [ ] `docs/stryker/IMPLEMENTATION_PLAN.md` states the target (api 100, web `lib/**` 100 + `components/**` ≥ 95), the
      file-by-file hardening order, the stack gotchas (supertest excluded; mocked ExecutionContext; `.cjs` Jest config;
      static survivors killed by asserting values), and an **Equivalent mutants** table whose rows match every
      `// Stryker disable` comment in `apps/api/src` + `apps/web/lib` (file · mutator · why-equivalent).
- [ ] Every accepted-equivalent row in the table has a matching co-located `// Stryker disable` comment in source (and
      vice-versa) — the two are consistent.
- [ ] `npx markdown-link-check docs/stryker/*.md --config .markdown-link-check.json` reports no dead links.

#### Files to create / modify

- `docs/stryker/BASELINE.md`, `docs/stryker/HISTORY.md`, `docs/stryker/IMPLEMENTATION_PLAN.md`

#### Agent prompt

```
You are a senior technical writer / test-quality engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 + Next.js 16).
The mutation gate is Stryker break ≥ 95 (api 100, web lib/** 100); accepted survivors are documented as provable
equivalents. This task writes that documentation set under docs/stryker/.

CURRENT PHASE: 13 (Mutation Hardening) — Task 13.4 of 5 (MIDDLE)

PRECONDITIONS
- Tasks 13.2 + 13.3 done: apps/api passes break:100, apps/web passes break:95 (lib/** 100); reports exist under
  apps/{api,web}/reports/mutation/*.{html,json}; each accepted equivalent carries a `// Stryker disable` comment in
  source, and 13.1/13.2/13.3 handed over the baseline numbers + the per-equivalent notes (file · line · mutator · why).

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Appendix C — Quality Gates" (thresholds + the Mutation-bar note) and § P13.
- The current mutation reports (the source of truth for the numbers + the survivor inventory):
  apps/api/reports/mutation/api.json and apps/web/reports/mutation/web.json (read the summary counts), and
  `grep -rn "Stryker disable" apps/api/src apps/web/lib` (the accepted-equivalent inventory).
- Sibling gold sources (copy the STRUCTURE; replace all content with this project's data):
  ~/Documents/MyApps/bymax-one/nest-logger-example/docs/stryker/{BASELINE.md, HISTORY.md, IMPLEMENTATION_PLAN.md}.

TASK
Author docs/stryker/{BASELINE,HISTORY,IMPLEMENTATION_PLAN}.md from this project's measured numbers + the source's
`// Stryker disable` rationales.

DELIVERABLES
1. `docs/stryker/BASELINE.md` — the pre-hardening api + web snapshot tables (score/killed/survived/timeout/no-cov/break/
   exit) + a per-file survivor table; link `../DEVELOPMENT_PLAN.md#appendix-c--quality-gates` and `../tasks/phase-13-mutation.md`.
2. `docs/stryker/HISTORY.md` — append-only, newest on top:
   `| Date | Workspace | Score | Killed | Survived | Timeout | No-cov | Ignored | Note |` with the baseline rows and the
   final green rows (api 100.00% break:100; web ≥95 break:95).
3. `docs/stryker/IMPLEMENTATION_PLAN.md` — Target line; "Hardening order (apps/api)" + "Hardening order (apps/web)";
   "Stack gotchas" (supertest flaky under Stryker → mocked ExecutionContext; `.cjs` Jest config; static survivors killed
   by asserting values, NOT ignoreStatic on api); and an "Equivalent mutants (documented, accepted)" table
   `| Workspace | File | Mutator(s) | Why equivalent |` whose rows match every `// Stryker disable` in source.

Constraints:
- The numbers MUST come from the actual reports — do not invent. English-only; timeless prose (this is docs/, so it MAY
  reference the phase/task file by link, but describe the gate, not roadmap stages, in the rationale columns).
- Keep IMPLEMENTATION_PLAN's equivalent-mutant table and the source `// Stryker disable` comments in lock-step.

Verification:
- `ls docs/stryker/{BASELINE,HISTORY,IMPLEMENTATION_PLAN}.md` — expected: all three present.
- Cross-check: the count of rows in IMPLEMENTATION_PLAN's equivalent-mutant table equals
  `grep -rc "Stryker disable" apps/api/src apps/web/lib | awk -F: '{s+=$2} END{print s}'` — expected: equal.
- `npx markdown-link-check docs/stryker/BASELINE.md docs/stryker/HISTORY.md docs/stryker/IMPLEMENTATION_PLAN.md --config .markdown-link-check.json`
  — expected: no dead links.

Completion Protocol:
1. Set 13.4 Status ✅ in its block AND the ## Task index row; tick its acceptance checkboxes.
2. Bump file-header Progress to `4 / 5` + Last updated today.
3. Update the P13 row Progress cell to `4 / 5` in docs/DEVELOPMENT_PLAN.md.
4. Append to ## Completion log: `- 13.4 ✅ <YYYY-MM-DD> — stryker baseline/history/implementation-plan docs`.
5. Commit: `docs(stryker): add baseline, history, and implementation plan` (no Co-Authored-By).
```

---

### Task 13.5 — Wire `mutation.yml` + `mutation-nightly.yml` to real configs

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 13.2, 13.3

#### Description

Activate the P0 mutation workflow skeletons against the now-real Stryker configs: `mutation.yml` runs the **incremental**
mutation of only the PR-changed workspace (paths-filter + cached incremental file); `mutation-nightly.yml` runs the
**full** (`--force`) mutation weekly and opens an idempotent `mutation-drift` issue on a below-threshold run. This is the
**LAST** task — it also runs the per-phase closeout.

#### Acceptance criteria

- [ ] `.github/workflows/mutation.yml` — PR-triggered, `dorny/paths-filter` per workspace (`apps/api/**` →
      `mutation-api`, `apps/web/**` → `mutation-web`), restores/saves `reports/stryker-incremental.json` via `actions/cache`,
      runs `pnpm --filter @nest-notification-example/api run mutation:incremental` (api) / `pnpm --filter web run mutation:incremental` (web); the library is built first so the
      `file:` link resolves; least-privilege `permissions`, `concurrency` cancel-in-progress, pinned actions, `timeout-minutes`.
- [ ] `.github/workflows/mutation-nightly.yml` — Monday 03:00 UTC cron + `workflow_dispatch`, runs
      `pnpm --filter … run mutation` (`--force`) for both apps, and on a failed run opens a `mutation-drift`-labelled issue
      (idempotent: skip if an open one exists); `permissions: { contents: read, issues: write }`.
- [ ] Both workflows reference the **real** scripts/configs added in 13.1/13.3 (no placeholder `echo`); job names match
      [Appendix D](../DEVELOPMENT_PLAN.md#appendix-d--cicd-workflow-matrix); untrusted `${{ github.* }}` passed via `env:`.
- [ ] Both workflows parse (action-validator / YAML lint); a PR touching only `apps/api/**` triggers `mutation-api` and
      **not** `mutation-web` (path-filter verified).
- [ ] **Per-phase closeout** done (see Phase Completion Protocol): P13 flipped to ✅ at `5 / 5`, Active phase advanced to
      P14, Overall progress recomputed to `13 / 15 phases`.

#### Files to create / modify

- `.github/workflows/mutation.yml`, `.github/workflows/mutation-nightly.yml`
- `docs/tasks/phase-13-mutation.md` + `docs/DEVELOPMENT_PLAN.md` (closeout)

#### Agent prompt

```
You are a senior CI/CD engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification, agent-built; every PR runs a
mutation gate. pnpm monorepo (apps/api Jest+Stryker break:100, apps/web Vitest+Stryker break:95), Node 24; the lib is
consumed via `file:../../../nest-notification` and must be built before Stryker runs.

CURRENT PHASE: 13 (Mutation Hardening) — Task 13.5 of 5 (LAST)

PRECONDITIONS
- Tasks 13.2 + 13.3 done: apps/api passes break:100 and apps/web passes break:95 locally; both apps have `mutation` and
  `mutation:incremental` scripts. The P0 skeletons `.github/workflows/{mutation.yml,mutation-nightly.yml}` exist but were
  guarded no-ops; this task makes them real.

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Appendix D — CI/CD Workflow Matrix" (mutation/mutation-nightly rows + the shared hardening:
  checkout@v5, pnpm/action-setup@v4, setup-node@v5 Node 24 cache pnpm — pnpm BEFORE node, --frozen-lockfile, top-level
  permissions: contents: read, concurrency cancel-in-progress, timeout-minutes, placeholder DATABASE_URL) and § P13.
- Sibling gold sources (copy & ADAPT — replace the package filters with @nest-notification-example/api (api) and bare web (web) and the
  drift-issue body text): ~/Documents/MyApps/bymax-one/nest-logger-example/.github/workflows/{mutation.yml,mutation-nightly.yml}.
- docs/tasks/phase-13-mutation.md "## Phase Completion Protocol" (the closeout this LAST task runs).

TASK
Wire mutation.yml (PR incremental, per-changed-workspace) + mutation-nightly.yml (weekly full, drift issue), then run
the per-phase closeout.

DELIVERABLES
1. `.github/workflows/mutation.yml` — PR-triggered. A `detect` job runs `dorny/paths-filter@v3` mapping
   `apps/api/** + apps/api/stryker.config.json + apps/api/jest.stryker.config.cjs` → api, and
   `apps/web/** + apps/web/stryker.config.json` → web. `mutation-api` / `mutation-web` jobs gate on the filter output;
   each: build the library so the file: link resolves, `actions/cache` restore+save `apps/<app>/reports/stryker-incremental.json`
   keyed on the workspace + sha (restore-keys fall back to the ref then main), then
   `pnpm --filter @nest-notification-example/api run mutation:incremental` (api job) / `pnpm --filter web run mutation:incremental` (web job). api job sets
   `NODE_OPTIONS: --experimental-vm-modules`. Least-privilege permissions, concurrency cancel-in-progress, pinned actions,
   timeout-minutes.
2. `.github/workflows/mutation-nightly.yml` — `schedule: cron '0 3 * * 1'` + `workflow_dispatch`. `full-api` / `full-web`
   run `pnpm --filter … run mutation` (`--force`). On failure, a step opens a `mutation-drift` GitHub issue idempotently
   (`gh issue list --label mutation-drift --state open` → skip if present; else `gh issue create`). Top-level
   `permissions: { contents: read }`, the create-issue job widens `issues: write`. Untrusted refs via `env:`.

Constraints:
- Least-privilege; pin every action; timeout-minutes on every job. Untrusted `${{ github.* }}` ONLY via `env:`.
- Job names are contractual — match Appendix D (`mutation-api`/`mutation-web`; `full-api`/`full-web`). English-only,
  TIMELESS — no Phase/Task references anywhere in the workflow YAML or comments.

Verification:
- `ls .github/workflows/mutation.yml .github/workflows/mutation-nightly.yml` — expected: both present.
- `pnpm dlx @action-validator/cli .github/workflows/mutation.yml` and `… mutation-nightly.yml` — expected: valid.
- `grep -n "mutation:incremental\|run mutation\b\|@nest-notification-example/api\|--filter web " .github/workflows/mutation*.yml`
  — expected: the real scripts/filters are referenced (no leftover placeholder `echo`).
- `grep -n "mutation-drift" .github/workflows/mutation-nightly.yml` — expected: the idempotent issue logic is present.

Completion Protocol (LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 13.5 Status ✅ in its block AND the ## Task index row; tick its acceptance checkboxes.
2. Bump file-header Progress to `5 / 5` + Last updated today.
3. Update the P13 row Progress cell to `5 / 5` in docs/DEVELOPMENT_PLAN.md.
4. Append to ## Completion log: `- 13.5 ✅ <YYYY-MM-DD> — wired mutation.yml + mutation-nightly.yml`.
5. Commit: `ci(mutation): wire incremental PR + nightly full mutation gates` (no Co-Authored-By).
PER-PHASE (after the PR merges with CI green — see "## Phase Completion Protocol"):
6. In docs/DEVELOPMENT_PLAN.md: set the P13 Status to ✅ and Progress `5 / 5`; advance Active phase to P14; recompute
   Overall progress to `13 / 15 phases (87%)`. Set this file's header Status to ✅ and Progress `5 / 5 tasks`.
7. Commit: `docs(plan): P13 complete` (no Co-Authored-By).
```

---

## Phase Completion Protocol

When **Task 13.5** is `✅` and every other task is `✅`:

1. Confirm all 5 tasks are `✅` and the P13 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P13`](../DEVELOPMENT_PLAN.md#phase-13--mutation-hardening)
   is met: `stryker run` passes `break: 100` on `apps/api` and `break: 95` on `apps/web` (`lib/**` 100, `components/**`
   driven up); every survivor is killed or documented as a provable equivalent in `docs/stryker/`; `mutation.yml` +
   `mutation-nightly.yml` are wired to the real configs and run green.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks, including the wired `mutation`
   workflow on the PR-changed workspaces).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P13 Status** to `✅`, **Progress** `5 / 5`, **Last
   updated** today; set **Active phase** to `P14`; recompute **Overall progress** to `13 / 15 phases (87%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `5 / 5 tasks`.
5. Commit `docs(plan): P13 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red (e.g. a workspace below its `break` threshold), set P13 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

_(empty — no tasks completed yet)_
