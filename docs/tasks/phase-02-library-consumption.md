# Phase 2 — Library Consumption & Export Audit

> **Status**: 📋 ToDo · **Progress**: 0 / 4 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P2
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

After P0 (the gated empty workspace) and P1 (the local stack + `apps/api` skeleton `package.json` + Zod env schema),
the repository builds and installs, but it does **not yet consume `@bymax-one/nest-notification`**. Today the lib is an
unbuilt sibling checkout three levels up (`../../../nest-notification`), its `dist/` is absent, and nothing in `apps/`
imports a single export. The export-usage audit script exists only as the P0 stub that exits 0 on the empty tree.

Phase 2 makes the **library consumption real and the coverage promise enforceable**. It (1) declares the `file:`
dependency on the sibling lib in `apps/api` and installs the required + optional peers (the `apps/web` `file:` link +
Next.js `transpilePackages` wiring is deferred to P8.1, when `apps/web` is scaffolded); (2) writes
`apps/api/src/library-probe.ts` + `.spec.ts` that reference the type/token-only exports that have no natural feature home
(resolved-options types, the SMS/Push v0.2 tokens & types, the zero-arg class-form provider resolution, the crypto
utils); (3) finalizes `scripts/audit-library-exports.mjs` to parse
the library's shipped `dist/{server,shared,react}/index.d.ts` and word-boundary-search `apps/**`; and (4) runs the audit
green by reconciling every export against a real reference or a reasoned `.audit-ignore.json` allow-list, then documents
the build-first workflow. When P2 is done, `tsc` resolves all three subpaths from `dist`, `pnpm audit:exports` passes,
and the library `dist/` build-first workflow is documented.

The gold sources are the sibling `nest-logger-example` — copy and **adapt** its proven `library-probe.ts`,
`audit-library-exports.mjs`, and `package.json` shape rather than inventing. The notification lib has **three** subpaths
(the logger has two) and a much larger surface (61-row matrix), so the probe and the audit-script subpath list both grow.

---

## Rules-of-phase

1. **`file:` over `link:`** — declare `@bymax-one/nest-notification` as `file:../../../nest-notification` (from each
   app), never a `link:` symlink (a symlink pulls the much larger sibling tree into every test worker's module graph —
   the memory hazard in [`OVERVIEW.md §8`](../OVERVIEW.md#8-local-stack--memory-safe-run)).
2. **Build the lib first** — the lib ships `"dependencies": {}` and resolves types + runtime only from its built
   `dist/` via its `exports` map; `pnpm install` here resolves nothing useful until `cd ../nest-notification && pnpm build`
   has produced `dist/{server,shared,react}/index.{d.ts,mjs,cjs}`. Document this as the consumer's first step.
3. **Allow-list only genuine internal leaks** — `.audit-ignore.json` is reserved for symbols that leak into the
   published `.d.ts` but are internal-only (each entry needs a `reason` + issue link). **Never** allow-list a
   demonstrable export to make CI green — wire it into the probe or a real surface instead.
4. **The probe is the floor, not the ceiling** — symbols that a later phase drives from a real journey or the UI
   (`EmailService`, `OtpService`, the React hooks, the error catalog in `apps/web`) are demonstrated **there**, not in
   the probe. The probe references only the otherwise-hard-to-exercise type/token-only exports.
5. **Single React instance (deferred to P8.1)** — `apps/web` imports `./react`; the workspace must keep one React
   instance (a duplicated React triggers an "invalid hook call" from `useOtpInput`). The `transpilePackages` + pnpm
   React-dedupe wiring lands in P8.1 with `apps/web`; P2 scopes consumption to `apps/api` and only allow-lists the
   `./react` surface in the audit until then.
6. **Timeless, English-only deliverables** — the code/config this phase writes carries **no** `Phase N` / `Task`
   references (it is committed source). This planning file may name phases freely; the deliverables may not.
7. **TS strict, JSDoc on every export, no suppression comments** — `@ts-ignore`/`eslint-disable` are forbidden;
   `verbatimModuleSyntax` means value imports must be kept alive by a runtime read.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — § 6 Feature Coverage Matrix (the **Coverage rule** + the 22-code catalog note),
  § 7 Library Consumption (the `file:` link, peers, the probe — the `transpilePackages` wiring lands in P8.1 with
  `apps/web`), § 5 Repository Layout (target tree), § 8 Local Stack & Memory-Safe Run (why `file:` over `link:`).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § Phase 2, § 2 Global Conventions, § 3 Autonomous Execution Model,
  Appendix B (Library Export → Phase Coverage Map), Appendix C (Quality Gates).
- The library barrels (the 3 subpaths to probe): `~/Documents/MyApps/bymax-one/nest-notification/src/{server,shared,react}/index.ts`
  and `~/Documents/MyApps/bymax-one/nest-notification/package.json` (the `exports` map + peer list).
- Sibling gold sources (copy & adapt): `~/Documents/MyApps/bymax-one/nest-logger-example/`
  {`apps/api/src/library-probe.ts`, `apps/api/src/library-probe.spec.ts`, `scripts/audit-library-exports.mjs`,
  `.audit-ignore.json`, `apps/api/package.json`}.
- `/bymax-workflow:standards` skill — universal coding rules.

---

## Task index

| ID  | Task                                                     | Status  | Priority | Size | Depends on |
| --- | -------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 2.1 | `file:` link the library + peers (apps/api)              | 📋 ToDo | P0       | M    | —          |
| 2.2 | Library export-surface probe (`library-probe.ts` + spec) | 📋 ToDo | P0       | M    | 2.1        |
| 2.3 | Finalize the 3-subpath export-usage audit script         | 📋 ToDo | P0       | M    | 2.1        |
| 2.4 | Run the audit green + document build-first workflow      | 📋 ToDo | P1       | S    | 2.2, 2.3   |

---

## Tasks

### Task 2.1 — `file:` link the library + peers (apps/api)

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Declare `@bymax-one/nest-notification` as a `file:` dependency in `apps/api` and install the required + optional peers
this app needs — so `tsc` resolves all three subpaths from the lib's built `dist/`. This phase scopes consumption to
`apps/api` only; `apps/web` does not exist yet, so its `file:` link, `react`/`react-dom`/`next` deps, and the
`next.config.ts` `transpilePackages` wiring are deferred to P8.1 (when `apps/web` is scaffolded). The export audit
(Tasks 2.3/2.4) still inspects the full `./react` + `./shared` allow-list surface — those browser subpaths are
allow-listed until P8/P10 wire them.

#### Acceptance criteria

- [ ] `apps/api/package.json` declares `"@bymax-one/nest-notification": "file:../../../nest-notification"` and the peers
      this app lights up: required (`@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs`) + optional (`ioredis`,
      `resend`, `nodemailer`, `handlebars`, `mjml`, `@react-email/render`).
- [ ] After `cd ../nest-notification && pnpm install && pnpm build`, then `pnpm install --no-frozen-lockfile` here, the
      lockfile resolves the `file:` link and `node -e "require.resolve(...)"`/a type import resolves all 3 subpaths.
- [ ] `pnpm typecheck` exits 0 (a trivial type import of each subpath in a scratch file or the probe resolves from `dist`).

#### Files to create / modify

- `apps/api/package.json`
- `pnpm-lock.yaml` (regenerated)

#### Agent prompt

````
You are a senior TypeScript build/tooling engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (a NestJS 11 email + OTP
notification library: multi-tenant, pluggable providers/storage, audit log, React hooks). pnpm monorepo (apps/api
NestJS 11; apps/web Next.js 16 + React 19 is scaffolded later in P8), Node 24, TypeScript 5.9 strict; the lib is
consumed pre-publish via file:.

CURRENT PHASE: 2 (Library Consumption & Export Audit) — Task 2.1 of 4 (FIRST)

PRECONDITIONS
- P0 done: pnpm workspace + tsconfig.base.json + CI + the audit-script P0 stubs exist; install/typecheck/lint pass.
- P1 done: apps/api skeleton package.json + Zod env schema exist; the local stack (docker-compose) exists.
- The sibling library lives at ../../../nest-notification (a checkout); its dist/ is NOT yet built in this environment.
- apps/web does NOT exist yet (it is scaffolded in P8.1); this task touches apps/api only.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "7. Library Consumption" (the file: link, the build-first note, the peers list) and § "8. Local
  Stack & Memory-Safe Run" (why file: over link:).
- docs/DEVELOPMENT_PLAN.md § "Phase 2 — Library Consumption & Export Audit" (Scope-In / Rules-of-phase).
- The library's peer surface: ~/Documents/MyApps/bymax-one/nest-notification/package.json (the `exports` map +
  peerDependencies + peerDependenciesMeta — which peers are optional).
- The sibling config (copy & adapt — note the logger has TWO subpaths, notification has THREE):
  ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/package.json.

TASK
Declare the file: dependency on @bymax-one/nest-notification in apps/api and install the peers this app needs, so tsc
resolves all three subpaths from the lib's built dist/. Scope this task to apps/api only — the apps/web file: link +
next.config.ts transpilePackages wiring is deferred to P8.1, when apps/web is scaffolded.

DELIVERABLES
1. `apps/api/package.json` — add the dependency + peers:
   ```jsonc
   {
     "dependencies": {
       "@bymax-one/nest-notification": "file:../../../nest-notification",
       "@nestjs/common": "^11", "@nestjs/core": "^11", "reflect-metadata": "^0.2", "rxjs": "^7.8",
       "ioredis": "^5",       // RedisOtpStorage (opt-in peer)
       "resend": "^4",        // ResendEmailProvider (opt-in peer)
       "nodemailer": "^7",    // the example's custom IEmailProvider → Mailpit
       "handlebars": "^4", "mjml": "^4", "@react-email/render": "^1"  // alternate renderers
     }
   }
   ```
   Keep the existing P1 fields (name, type:module, engines, scripts). Add `@types/nodemailer` to devDependencies if the
   renderer/provider code will need it later (optional now — keep minimal).
2. Regenerate the lockfile: build the lib, then install here.

Constraints (follow /bymax-workflow:standards):
- TS strict; English-only, timeless comments — NO Phase/Task references in package.json comments.
- Use file: NOT link: (memory-safety rule). Mark optional peers as normal dependencies on the APP (the app installs the
  channels it uses; the library declares them optional). No suppression comments.
- Do NOT create apps/web or any apps/web file here — it does not exist until P8.

Verification:
- `cd ../nest-notification && pnpm install && pnpm build` — expected: produces dist/{server,shared,react}/index.{d.ts,mjs,cjs}.
- `pnpm install --no-frozen-lockfile` (repo root) — expected: resolves the file: link; lockfile updates.
- `node -e "console.log(require.resolve('@bymax-one/nest-notification', { paths: ['apps/api'] }))"` — expected: a path
  under node_modules/@bymax-one/nest-notification/dist/server.
- `pnpm typecheck` — expected: exit 0 (a type import of `.`/`./shared`/`./react` resolves from dist).

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 4` and Last updated to today.
4. Update the P2 row Progress to `1 / 4` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 2.1 ✅ <YYYY-MM-DD> — file: link the library + peers (apps/api)`.
6. Commit: `chore(deps): link @bymax-one/nest-notification (file:) + peers in apps/api` (no Co-Authored-By).
````

---

### Task 2.2 — Library export-surface probe (`library-probe.ts` + spec)

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 2.1

#### Description

Write `apps/api/src/library-probe.ts` (+ `.spec.ts`) that references the otherwise-hard-to-exercise exports of the `.`
(server) subpath — the resolved-options types, the SMS/Push v0.2 tokens & types, the zero-arg class-form provider
resolution, and the crypto utils — so the export-usage audit can prove those type/token-only symbols are demonstrated.

#### Acceptance criteria

- [ ] `apps/api/src/library-probe.ts` imports from `@bymax-one/nest-notification` (the `.` subpath) and references, at
      minimum, the type/token-only exports with no natural feature home: the resolved-options types
      (`ResolvedNotificationOptions`/`ResolvedGlobalOptions`/`ResolvedEmailOptions`/`ResolvedOtpOptions`/`ResolvedAuditOptions`),
      the v0.2 declared-only surface (`BYMAX_NOTIFICATION_SMS_PROVIDER`/`_PUSH_PROVIDER` tokens, `ISmsProvider`/`IPushProvider`
  - `SmsChannelOptions`/`PushChannelOptions` types), the options-factory contract (`BymaxNotificationModuleOptionsFactory`,
    `BymaxNotificationModuleAsyncOptions`), the DI tokens (`BYMAX_NOTIFICATION_OPTIONS`/`_EMAIL_PROVIDER`/`_OTP_STORAGE`/
    `_TEMPLATE_RENDERER`/`_LOG_REPOSITORY`), the zero-arg class-form providers (`NoOpEmailProvider`/`InMemoryOtpStorage`),
    and the crypto utils (`generateOtpCode`/`safeCompare`).
- [ ] Each value import is kept alive under `verbatimModuleSyntax` by a runtime read (`.name`, `.toString()`, an
      invocation); each type-only import is proven by a type alias / typed const. Every export has JSDoc.
- [ ] A frozen `probe` aggregate constant collects every runtime proof so one import asserts the surface.
- [ ] `apps/api/src/library-probe.spec.ts` (Jest, `@jest/globals`) asserts the runtime proofs (token labels, the
      generated-code shape, `safeCompare` true/false, the class names) at 100% of the executable lines.
- [ ] `pnpm typecheck` exits 0; `pnpm --filter @nest-notification-example/api exec jest --maxWorkers=2 library-probe` passes.

#### Files to create / modify

- `apps/api/src/library-probe.ts`, `apps/api/src/library-probe.spec.ts`

#### Agent prompt

````
You are a senior NestJS / TypeScript engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (a NestJS 11 email + OTP
notification library: multi-tenant, pluggable providers/storage, audit log, React hooks). pnpm monorepo (apps/api
NestJS 11 + apps/web Next.js 16), Node 24, TypeScript 5.9 strict, 100% coverage + Stryker ≥95 bar.

CURRENT PHASE: 2 (Library Consumption & Export Audit) — Task 2.2 of 4 (MIDDLE)

PRECONDITIONS
- Task 2.1 done: @bymax-one/nest-notification is a file: dependency of apps/api; its dist/ is built and resolves; the
  3 subpaths type-resolve. apps/api has Jest configured (from P0/P1) with `--experimental-vm-modules`.

REQUIRED READING (only these — do not load more):
- The server barrel (the EXACT exported names of the `.` subpath — copy names from here, never from memory):
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/index.ts.
- The gold probe (copy its shape & JSDoc style, then RE-CUSTOMIZE for the notification surface — it has 3 subpaths and
  more tokens than the logger's 2): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/{library-probe.ts,
  library-probe.spec.ts}.
- docs/OVERVIEW.md § "7. Library Consumption" (the probe is the FLOOR — only otherwise-hard-to-exercise type/token-only
  exports; UI-drivable symbols are demonstrated in later phases, not here) and the § "6" matrix rows 4, 5, 38, 58c, 59
  (the exact exports the probe is responsible for).

TASK
Author apps/api/src/library-probe.ts (+ .spec.ts) that references the type/token-only exports of the `.` (server)
subpath that have no natural feature home, so the export-usage audit can prove them demonstrated.

DELIVERABLES
1. `apps/api/src/library-probe.ts` — a `@module`-documented file. Illustrative skeleton (adapt names to the EXACT
   server barrel — verify each against src/server/index.ts):
   ```ts
   /**
    * @fileoverview Library export-surface probe for @bymax-one/nest-notification.
    * References every public `.` (server) export with no natural feature-level home — the resolved-options types, the
    * declared-only v0.2 SMS/Push surface, the options-factory contract, the DI tokens, the zero-arg class-form
    * providers, and the crypto utils — so the export-usage audit (scripts/audit-library-exports.mjs) proves the
    * type/token-only surface is demonstrated. Feature-drivable exports are demonstrated in their own surfaces, not here.
    * @module
    */
   import {
     BYMAX_NOTIFICATION_OPTIONS, BYMAX_NOTIFICATION_EMAIL_PROVIDER, BYMAX_NOTIFICATION_OTP_STORAGE,
     BYMAX_NOTIFICATION_TEMPLATE_RENDERER, BYMAX_NOTIFICATION_LOG_REPOSITORY,
     BYMAX_NOTIFICATION_SMS_PROVIDER, BYMAX_NOTIFICATION_PUSH_PROVIDER,
     NoOpEmailProvider, InMemoryOtpStorage, generateOtpCode, safeCompare,
     type BymaxNotificationModuleOptionsFactory, type BymaxNotificationModuleAsyncOptions,
     type ISmsProvider, type IPushProvider, type SmsChannelOptions, type PushChannelOptions,
     type ResolvedNotificationOptions, type ResolvedGlobalOptions, type ResolvedEmailOptions,
     type ResolvedOtpOptions, type ResolvedAuditOptions,
   } from '@bymax-one/nest-notification'

   /** Type-position proof: the class-based options-factory contract (the rejected useClass alternative to useFactory). */
   export type ServerOptionsFactory = BymaxNotificationModuleOptionsFactory
   /** Type-position proof: the async-options contract accepted by forRootAsync (the useFactory form). */
   export type ServerAsyncOptions = BymaxNotificationModuleAsyncOptions
   /** Type-position proof: the declared-only v0.2 SMS/Push provider contracts + channel options. */
   export type V02Surface = [ISmsProvider, IPushProvider, SmsChannelOptions, PushChannelOptions]
   /** Type-position proof: the advanced resolved-options read surface. */
   export type ResolvedSurface =
     [ResolvedNotificationOptions, ResolvedGlobalOptions, ResolvedEmailOptions, ResolvedOtpOptions, ResolvedAuditOptions]

   /** Runtime proof: the seven DI-token symbols are unique; their labels prove the advanced DI surface resolved. */
   export const injectionTokenLabels: readonly string[] = [
     BYMAX_NOTIFICATION_OPTIONS, BYMAX_NOTIFICATION_EMAIL_PROVIDER, BYMAX_NOTIFICATION_OTP_STORAGE,
     BYMAX_NOTIFICATION_TEMPLATE_RENDERER, BYMAX_NOTIFICATION_LOG_REPOSITORY,
     BYMAX_NOTIFICATION_SMS_PROVIDER, BYMAX_NOTIFICATION_PUSH_PROVIDER,
   ].map((t) => t.toString())

   /** Runtime proof: the zero-arg class-form providers (useClass async resolution needs a zero-arg ctor). */
   export const zeroArgClassNames: readonly [string, string] = [NoOpEmailProvider.name, InMemoryOtpStorage.name]
   /** Runtime proof: a generated OTP code of the requested length (crypto util resolved). */
   export const sampleCodeLength: number = generateOtpCode(6, 'numeric').length
   /** Runtime proof: constant-time comparison resolved (true for equal inputs). */
   export const compareMatches: boolean = safeCompare('123456', '123456')

   /** Aggregates every runtime proof so a single import asserts the whole `.` token/util surface. */
   export const probe = { injectionTokenLabels, zeroArgClassNames, sampleCodeLength, compareMatches } as const
   ```
   IMPORTANT: verify the EXACT signature of `generateOtpCode`/`safeCompare`/the token names against the server barrel —
   adapt the calls if the real signatures differ. Do not invent exports that the barrel does not list.
2. `apps/api/src/library-probe.spec.ts` — Jest (`@jest/globals`), one `it()` per runtime proof, each with a scenario
   comment, asserting: each token label matches its `Symbol(...)` string, the two zero-arg class names, the sample code
   length (6), and `compareMatches === true` (plus a `safeCompare` mismatch case for branch coverage). 100% of the
   executable lines of library-probe.ts must be covered.

Constraints (follow /bymax-workflow:standards):
- TS strict, no `any`, no suppression comments. JSDoc on EVERY export. English-only, timeless — NO Phase/Task references.
- Keep value imports alive (verbatimModuleSyntax) via a runtime read; type imports via `type` + a typed alias/const.
- The probe references ONLY type/token-only exports — do NOT pull in EmailService/OtpService/the React hooks (those are
  demonstrated in later phases' real surfaces).

Verification:
- `pnpm typecheck` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest --maxWorkers=2 library-probe` — expected: the spec passes.
- `pnpm --filter @nest-notification-example/api exec jest --maxWorkers=2 --coverage --collectCoverageFrom='src/library-probe.ts' library-probe`
  — expected: 100% on the four metrics for library-probe.ts.

Completion Protocol (run after finishing):
1. Set 2.2 Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `2 / 4` and Last updated to today.
4. Update the P2 row Progress to `2 / 4` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 2.2 ✅ <YYYY-MM-DD> — library export-surface probe + spec`.
6. Commit: `feat(api): add library-probe for the notification export surface` (no Co-Authored-By).
````

---

### Task 2.3 — Finalize the 3-subpath export-usage audit script

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 2.1

#### Description

Replace the P0 export-audit stub with the real, dependency-free script that parses the library's shipped
`dist/{server,shared,react}/index.d.ts`, extracts every exported symbol, word-boundary-searches `apps/**`, and fails on
any unreferenced export (allow-listed via `.audit-ignore.json`) — the CI gate that makes the Coverage rule enforceable.

#### Acceptance criteria

- [ ] `scripts/audit-library-exports.mjs` parses **three** subpaths (`.` → `dist/server/index.d.ts`,
      `./shared` → `dist/shared/index.d.ts`, `./react` → `dist/react/index.d.ts`) under
      `node_modules/@bymax-one/nest-notification/dist`.
- [ ] It extracts every outward-facing export (`export declare …`, `export type|interface …`, and
      `export { A, B as C, type D } [from '…']` re-export blocks — taking the outward name), word-boundary-searches the
      `apps/**` corpus (skipping `node_modules`/`dist`/`.next`/`coverage`/`reports`/`.stryker-tmp`, never following
      symlinks), and reads `.audit-ignore.json`.
- [ ] Exit codes: `0` = every non-ignored export referenced; `1` = one or more unused; `2` = infra error (a declaration
      file missing → a clear "build & link the library first" message).
- [ ] `scripts/audit-error-codes.mjs` remains a no-op-passing stub here (error-code localization is a web concern, wired
      in P10/P12) — do not break it.
- [ ] `pnpm audit:exports` runs (once the lib is built + linked) and reports per-subpath used/unused/ignored counts;
      `audit:exports` is wired in the root `package.json`.

#### Files to create / modify

- `scripts/audit-library-exports.mjs`
- `.audit-ignore.json` (ensure present with the `$comment` + empty `ignored`)
- `package.json` (confirm the `audit:exports` script points at the finalized file)

#### Agent prompt

````
You are a senior CI/CD / tooling engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (a NestJS 11 email + OTP
notification library with THREE published subpaths: `.` server, `./shared` isomorphic, `./react` browser hooks).
pnpm monorepo (apps/api + apps/web), Node 24, agent-built; every PR must pass the export-usage gate.

CURRENT PHASE: 2 (Library Consumption & Export Audit) — Task 2.3 of 4 (MIDDLE)

PRECONDITIONS
- Task 2.1 done: the lib is a file: dependency; its dist/{server,shared,react}/index.d.ts exist under
  node_modules/@bymax-one/nest-notification/dist after a build. The P0 stub of this script exists and exits 0 on empty.

REQUIRED READING (only these — do not load more):
- The gold script (copy its parser + walker verbatim, then change the package name + the SUBPATHS list from 2 to 3):
  ~/Documents/MyApps/bymax-one/nest-logger-example/scripts/audit-library-exports.mjs and its .audit-ignore.json.
- The library's exports map (confirm the 3 dist .d.ts paths): ~/Documents/MyApps/bymax-one/nest-notification/package.json
  (the `exports` field) — types resolve to dist/{server,shared,react}/index.d.ts.
- docs/OVERVIEW.md § "6. Feature Coverage Matrix" — the **Coverage rule** blockquote (what the script enforces) + the
  22-code catalog note (catalog-only codes may be allow-listed with a reason, like unreferenced exports).
- docs/DEVELOPMENT_PLAN.md § "Appendix B" (Library Export → Phase Coverage Map).

TASK
Finalize scripts/audit-library-exports.mjs to parse all three subpaths and gate on unreferenced exports.

DELIVERABLES
1. `scripts/audit-library-exports.mjs` — dependency-free Node ESM (`node:fs`, `node:path`, `node:process` only).
   Change from the logger gold:
   ```js
   const PKG = 'node_modules/@bymax-one/nest-notification/dist'
   const SUBPATHS = [
     { name: '.',       dts: join(PKG, 'server', 'index.d.ts') },
     { name: './shared', dts: join(PKG, 'shared', 'index.d.ts') },
     { name: './react',  dts: join(PKG, 'react',  'index.d.ts') },
   ]
   const APP_ROOTS = ['apps/api', 'apps/web']   // no apps/worker in this repo
   ```
   Keep the gold's `extractExports` (handles `export declare`, `export type|interface`, and `export { A, B as C, type D }`
   re-export blocks — take the OUTWARD name), `collectSources` (skip node_modules/dist/.next/coverage/reports/
   .stryker-tmp; never follow symlinks), `isUsed` (word-boundary regex), the `.audit-ignore.json` read, and the
   exit-code contract (0 ok / 1 unused / 2 infra: a missing declaration file → "build & link the library first").
   Print per-subpath `# @bymax-one/nest-notification '<subpath>' — N exports` then `✓ used` / `✗ UNUSED` / `– ignored`.
2. `.audit-ignore.json` — ensure it carries the standard `$comment` (allow-list only genuinely-internal leaked symbols,
   each with a reason + issue link) and `"ignored": []` (leave EMPTY here; Task 2.4 adds reasoned entries only if the
   reconciliation genuinely needs them).
3. `package.json` — confirm `"audit:exports": "node scripts/audit-library-exports.mjs"` is wired (it was stubbed in P0).

Constraints (follow /bymax-workflow:standards):
- Dependency-free Node ESM; @fileoverview JSDoc on the module + JSDoc on each function. English-only, timeless — NO
  Phase/Task references in the script (it is committed source). No suppression comments.
- Do NOT change the exit-code contract (CI + branch protection depend on it). Do NOT delete the audit-error-codes stub.

Verification:
- After `cd ../nest-notification && pnpm build` + `pnpm install` here: `node scripts/audit-library-exports.mjs` —
  expected: prints three `# … 'subpath' — N exports` sections and exits 0 or 1 (1 is fine NOW — Task 2.4 drives it to 0).
- `node -e "process.exit(require('node:fs').existsSync('node_modules/@bymax-one/nest-notification/dist/react/index.d.ts')?0:1)"`
  — expected: exit 0 (the react .d.ts exists).
- `pnpm audit:exports` — expected: runs the script (same output as the direct invocation).

Completion Protocol (run after finishing):
1. Set 2.3 Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `3 / 4` and Last updated to today.
4. Update the P2 row Progress to `3 / 4` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 2.3 ✅ <YYYY-MM-DD> — finalize the 3-subpath export-usage audit`.
6. Commit: `ci(audit): export-usage audit across the 3 notification subpaths` (no Co-Authored-By).
````

---

### Task 2.4 — Run the audit green + document build-first workflow

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: S
- **Depends on**: 2.2, 2.3

#### Description

Run `pnpm audit:exports` against the built + linked library, reconcile every unreferenced export — extend the probe (or
a real surface) for demonstrable exports, allow-list only genuinely-internal leaks with a reason — until the audit
passes, then document the lib's build-first consumption workflow so a fresh clone resolves the link.

#### Acceptance criteria

- [ ] `pnpm audit:exports` exits 0: every export of all three subpaths is referenced in `apps/**` or allow-listed in
      `.audit-ignore.json` with a `reason` + issue link.
- [ ] Any allow-listed entry is a **genuinely-internal** leaked symbol (not a demonstrable export); the reason explains
      why it leaks into the `.d.ts` and why no consumer uses it. Demonstrable exports left unreferenced are added to the
      probe (Task 2.2's file) or noted as owned by a later phase's real surface — never silenced.
- [ ] The library build-first workflow is documented where a consumer will find it: a `## Library consumption` /
      build-first note in `README.md` (and/or `CONTRIBUTING.md`) — `cd ../nest-notification && pnpm install && pnpm build`
      before `pnpm install` here; prefer `file:` over `link:`; rebuild the lib when its source changes.
- [ ] `pnpm typecheck && pnpm lint && pnpm audit:exports` all exit 0; the probe spec passes.

#### Files to create / modify

- `.audit-ignore.json` (reasoned entries only if genuinely needed)
- `apps/api/src/library-probe.ts` (extend if a demonstrable type/token export is still unreferenced)
- `README.md` (and/or `CONTRIBUTING.md`) — the build-first consumption note

#### Agent prompt

````
You are a senior developer-experience / build engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (a NestJS 11 email + OTP
notification library; 3 subpaths: `.` server, `./shared`, `./react`). pnpm monorepo, Node 24, TS 5.9 strict; the
export-usage audit is the CI gate that makes the "every export demonstrated" Coverage rule real.

CURRENT PHASE: 2 (Library Consumption & Export Audit) — Task 2.4 of 4 (LAST)

PRECONDITIONS
- Task 2.1 done: the lib is a file: dependency; dist/ is built + linked.
- Task 2.2 done: apps/api/src/library-probe.ts (+ spec) references the type/token-only `.` exports.
- Task 2.3 done: scripts/audit-library-exports.mjs parses all 3 subpaths and gates on unreferenced exports.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "6. Feature Coverage Matrix" — the **Coverage rule** blockquote + the 22-code catalog note (which
  catalog-only codes are allow-listable) + § "7. Library Consumption" (the build-first workflow + the probe-is-the-floor
  rule).
- docs/DEVELOPMENT_PLAN.md § "Phase 2" (Definition of Done) + § "Appendix B" + the § Phase dashboard P2 row.
- The 3 barrels (to map any unreferenced symbol to its owner phase or the probe):
  ~/Documents/MyApps/bymax-one/nest-notification/src/{server,shared,react}/index.ts.
- The gold allow-list shape: ~/Documents/MyApps/bymax-one/nest-logger-example/.audit-ignore.json.

TASK
Run pnpm audit:exports against the built + linked library, reconcile every unreferenced export until it exits 0, and
document the build-first consumption workflow.

DELIVERABLES
1. A GREEN `pnpm audit:exports`. For each `✗ UNUSED` the script reports, decide:
   - It is a **type/token-only** export with no feature home → add a reference in apps/api/src/library-probe.ts (extend
     the probe's imports + a typed alias or runtime read) and re-run.
   - It is **feature-drivable** but its owning phase is later (e.g. `useOtpInput`/`useOtpCountdown` from ./react owned by
     P10; the error catalog localized in apps/web owned by P10/P12; `EmailService`/`OtpService` owned by P4/P5) →
     reference it in the probe as a TYPE-position proof so the audit passes now (the real journey lands in its phase), OR
     allow-list it with a reason "demonstrated in P<n>'s <surface>" + issue link — choose the probe reference unless the
     symbol is browser-only (./react) and cannot be imported in apps/api, in which case allow-list with the phase reason.
   - It is a **genuinely-internal leaked symbol** (appears only in an internal class signature, never constructed by a
     consumer) → allow-list in .audit-ignore.json with a precise reason + issue link.
   NOTE: ./react exports (useOtpInput/useOtpCountdown + their option/state types) are browser-only and live in apps/web;
   until P8/P10 wire them, allow-list each with reason "React hook demonstrated in apps/web (P10 OTP panel)" + issue link,
   OR add a minimal type-only reference in a apps/web file if one already exists. Prefer the allow-list for ./react now.
2. `.audit-ignore.json` — every entry carries `symbol`, `reason`, `issue`. NO entry silences a `.`-subpath demonstrable
   export that the probe could hold.
3. The build-first consumption note in README.md (a `## Library consumption` section) and/or CONTRIBUTING.md:
   ```md
   ## Library consumption
   `@bymax-one/nest-notification` is consumed pre-publish via `file:../../../nest-notification`. Build the library first:
   ```bash
   cd ../nest-notification && pnpm install && pnpm build   # produces dist/{server,shared,react}
   cd ../nest-notification-example && pnpm install         # resolves the file: link
   ```
   Rebuild the library whenever its source changes. We use `file:` (not `link:`) so a symlinked sibling tree is not
   pulled into every test worker's module graph (see the memory-safe run recipe).
   ```

Constraints (follow /bymax-workflow:standards):
- Allow-list ONLY genuine internal leaks or browser-only ./react hooks with a phase reason — never a demonstrable
  `.`-subpath export. English-only, timeless in committed SOURCE/config (the README note may say "P10" since README is a
  doc, but the .audit-ignore.json reasons SHOULD prefer "demonstrated in apps/web's OTP panel" over a bare "Phase 10").
- No suppression comments; TS strict; JSDoc on any new probe export.

Verification:
- `pnpm audit:exports` — expected: exit 0, every subpath fully `✓ used` / `– ignored`.
- `pnpm typecheck && pnpm lint` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest --maxWorkers=2 library-probe` — expected: passes (if the probe was extended).
- `grep -c '"symbol"' .audit-ignore.json` — expected: matches the number of genuinely-internal/browser-only entries you
  documented (each with a reason + issue).

Completion Protocol — this is the LAST task: run the PER-TASK protocol, THEN the PER-PHASE protocol.
PER-TASK:
1. Set 2.4 Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `4 / 4` and Last updated to today.
4. Update the P2 row Progress to `4 / 4` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 2.4 ✅ <YYYY-MM-DD> — audit:exports green + build-first workflow documented`.
6. Commit: `docs(consumption): green export audit + document build-first workflow` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol" — only after the PR is MERGED and CI is GREEN):
confirm the P2 Definition of Done (the probe imports all 3 subpaths; tsc resolves types from dist; pnpm audit:exports
passes; the build-first workflow is documented). Then in docs/DEVELOPMENT_PLAN.md set the **P2 Status to ✅** and
Progress `4 / 4`, advance **Active phase** to P3, recompute **Overall progress** to `2 / 15 phases (13%)`; set this
file's header Status to ✅; commit `docs(plan): P2 complete` (no Co-Authored-By). If any DoD bullet is unmet or CI is
red, set P2 to 🟡 Partial, not ✅.
````

---

## Phase Completion Protocol

When **Task 2.4** is `✅` and every other task is `✅`:

1. Confirm all 4 tasks are `✅` and the P2 **Definition of Done** in
   [`DEVELOPMENT_PLAN.md § Phase 2`](../DEVELOPMENT_PLAN.md#phase-2--library-consumption--export-audit) is met: the probe
   imports from all three subpaths and `tsc` resolves their types from `dist`; `pnpm audit:exports` passes (every export
   referenced or allow-listed with a reason); the library `dist/` build-first workflow is documented and the `file:`
   link resolves.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks, including `export-usage-check`).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P2 Status** to `✅`, **Progress** `4 / 4`, **Last
   updated** today; set **Active phase** to `P3`; recompute **Overall progress** to `2 / 15 phases (13%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `4 / 4 tasks`.
5. Commit `docs(plan): P2 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P2 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

_(empty — no tasks completed yet)_
