# Phase 7 — Roadmap Rejection Endpoints

> **Status**: 🔄 In Progress · **Progress**: 1 / 3 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P7
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

By the start of this phase the API skeleton (P3), the production notification wiring (P4 — `forRootAsync({ useFactory })`,
the audit store + interceptor), and the request controllers (P5 OTP/email/dispatch, P6 audit read-API) all exist and
run. The live app is wired with exactly the channels the library supports today (`email` + `otp`); the **declared but
rejected** v0.2 surface — `sms`, `push`, and the `forRootAsync({ useClass })` async form — is never exercised by the
running module.

Phase 7 adds an `admin/` controller surface that **honestly proves** that rejected surface. Each of the three endpoints
spins up a **throwaway** `BymaxNotificationModule` in an isolated `Test.createTestingModule(...)` context, supplies the
v0.2 option that the library rejects, lets the library throw at module construction, captures the **real thrown error
message string**, and returns it as a structured `200 OK` payload. The live app's own module is never touched —
the rejection happens in an ephemeral DI container that is compiled and discarded per request.

When P7 is done, `POST /admin/try-configure-sms`, `POST /admin/try-configure-push`, and
`POST /admin/try-configure-async-useclass` each return the library's exact startup-rejection message, and a set of
isolated e2e specs assert those exact strings. The observable end-state: the API tells the truth about what the library
will and will not boot with — no faking, no stubbing of the library's own validation. The web **Roadmap** panel that
renders these results is **out of scope** (it lands in P10).

The gold source for the **exact error strings** is the library itself — copy the messages verbatim from
`nest-notification/src/server/{config/validate-options.ts, bymax-notification.module.ts}`; do not paraphrase.

---

## Rules-of-phase

1. **Isolated module per attempt** — every endpoint compiles its throwaway module with `Test.createTestingModule(...)`
   in its own ephemeral DI container. **Never** mutate, re-register, or import the running app's `BymaxNotificationModule`
   from a request handler.
2. **Surface the library's real error** — the returned message must be the **exact string the library throws**, captured
   from the caught error, not a hardcoded copy in the controller. The endpoint forces compilation (`module.init()` or
   the act that triggers `forRoot`/`forRootAsync`), catches, and reports `error.message` verbatim.
3. **Rejection is the success path** — these endpoints expect the throw. If construction **does not** throw, that is a
   failure of the demo's premise → return a clear `did not reject` result (and the e2e spec fails), never a silent `200`.
4. **No v0.2 fakery** — do not implement, stub, or simulate SMS/Push delivery or the `useClass` async form. The example
   demonstrates the **declared interfaces and their startup rejection**, honestly (OVERVIEW §2 Non-Goals).
5. **Timeless deliverable code** — the controller/service/DTOs and their comments are committed source: English-only,
   no `Phase N` / `Task` / roadmap-stage references, JSDoc on every export, no suppression comments
   (`@ts-ignore`, `eslint-disable`). This planning doc may name phases; the code it asks you to write may not.
6. **TS strict throughout** — `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`; zero `any`. The throwaway-module
   options are deliberately the rejected shape — type the `sms`/`push`/`useClass` inputs against the library's declared
   `SmsChannelOptions`/`PushChannelOptions`/`BymaxNotificationModuleOptionsFactory` so the cast that triggers the throw
   is explicit and documented, never an untyped `as any`.
7. **100% covered** — these are observable HTTP surfaces; the isolated e2e specs assert the exact thrown strings and the
   `did not reject` branch is covered too.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §6 Feature Coverage Matrix rows **3, 58a, 58b, 58c**; §2 Goals & Non-Goals
  (the "no SMS/Push delivery — demonstrate declared interfaces + startup rejection, honestly" non-goal); §5 Repository
  Layout (the `apps/api/src/admin/` target tree).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P7, §2 Global Conventions, §3 Autonomous Execution Model.
- Library gold sources (copy the **exact** error strings, do not paraphrase):
  `~/Documents/MyApps/bymax-one/nest-notification/src/server/config/validate-options.ts` (the `sms` / `push` throws) and
  `~/Documents/MyApps/bymax-one/nest-notification/src/server/bymax-notification.module.ts` (`assertUseFactory` — the
  `useClass`/`useExisting` throw).
- `/bymax-workflow:standards` skill — universal coding rules.

---

## Task index

| ID  | Task                                                  | Status  | Priority | Size | Depends on |
| --- | ----------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 7.1 | Admin DTOs + isolated-module rejection probe helper   | ✅ Done | P0       | M    | —          |
| 7.2 | AdminController + AdminModule — the three endpoints   | 📋 ToDo | P0       | M    | 7.1        |
| 7.3 | Isolated e2e specs asserting the exact thrown strings | 📋 ToDo | P0       | M    | 7.2        |

---

## Tasks

### Task 7.1 — Admin DTOs + isolated-module rejection probe helper

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Create the response DTO and the shared `attemptConfigure` helper that compiles a throwaway `BymaxNotificationModule` in
an isolated `Test.createTestingModule(...)` container, forces the rejection, catches the thrown error, and returns a
structured result. The three endpoints (Task 7.2) are thin wrappers over this one helper.

#### Acceptance criteria

- [x] `apps/api/src/admin/dto/roadmap-rejection.result.ts` exports a `RoadmapRejectionResult` type/DTO:
      `{ attempt: 'sms' | 'push' | 'async-useclass'; rejected: boolean; errorName: string; errorMessage: string }`.
- [x] `apps/api/src/admin/roadmap-rejection.probe.ts` exports `attemptConfigure(attempt, buildModule)` which compiles the
      supplied module in isolation, awaits the act that triggers `forRoot`/`forRootAsync` construction, and returns a
      `RoadmapRejectionResult` — `rejected: true` + the caught `error.message` when it throws, `rejected: false` when it
      does **not** (no silent success).
- [x] The helper always **closes** the testing module it compiled (`await moduleRef?.close()` in a `finally`) so no DI
      container leaks across requests.
- [x] JSDoc on every export; `@throws` documented where relevant; TS strict (no `any`, no suppression comments).
- [x] `pnpm --filter @nest-notification-example/api exec tsc --noEmit` exits 0.

#### Files to create / modify

- `apps/api/src/admin/dto/roadmap-rejection.result.ts`
- `apps/api/src/admin/roadmap-rejection.probe.ts`

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (a NestJS 11 email + OTP
notification library: multi-tenant, pluggable providers/storage, audit log, React hooks). pnpm monorepo (apps/api
NestJS 11 + apps/web Next.js 16), Node 24, TypeScript 5.9 strict, 100% coverage + Stryker ≥ 95.

CURRENT PHASE: 7 (Roadmap Rejection Endpoints) — Task 7.1 of 3 (FIRST)

PRECONDITIONS
- P3–P6 done: apps/api is a running NestJS app with the notification module wired via forRootAsync({ useFactory }),
  the exception filter, the OTP/email/dispatch/audit controllers. `@nestjs/testing` is already a devDependency.
- No admin/ surface exists yet. This task adds the building block the three endpoints (Task 7.2) wrap.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "6. Feature Coverage Matrix" rows 3, 58a, 58b, 58c (what each endpoint proves) and § "2. Goals &
  Non-Goals" (the "demonstrate declared interfaces + their startup rejection, honestly — no SMS/Push fakery" non-goal).
- docs/OVERVIEW.md § "5. Repository Layout" (the apps/api/src/admin/ target path).
- The library gold sources — copy the EXACT error strings, do not paraphrase:
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/config/validate-options.ts (the sms + push throws) and
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/bymax-notification.module.ts (assertUseFactory — the
  useClass/useExisting throw, and how forRoot/forRootAsync trigger validation at construction).

TASK
Author the response DTO and the shared `attemptConfigure` helper that compiles a throwaway BymaxNotificationModule in an
isolated Test.createTestingModule(...) container, forces the rejection, and returns the captured error verbatim.

DELIVERABLES
1. `apps/api/src/admin/dto/roadmap-rejection.result.ts` — the structured result type:
   ```ts
   /** Outcome of attempting to configure a v0.2-rejected library surface in isolation. */
   export interface RoadmapRejectionResult {
     /** Which rejected surface was attempted. */
     readonly attempt: 'sms' | 'push' | 'async-useclass'
     /** True when the library threw at module construction (the expected outcome). */
     readonly rejected: boolean
     /** The thrown error's constructor name (e.g. 'Error'), '' when it did not reject. */
     readonly errorName: string
     /** The thrown error's message, verbatim from the library, '' when it did not reject. */
     readonly errorMessage: string
   }
   ```
2. `apps/api/src/admin/roadmap-rejection.probe.ts` — the helper. Shape it so each endpoint passes only a builder that
   returns the rejected module under test (so forRoot is rejected eagerly, forRootAsync is rejected on init):
   ```ts
   import { Test } from '@nestjs/testing'
   import type { DynamicModule } from '@nestjs/common'
   import type { RoadmapRejectionResult } from './dto/roadmap-rejection.result'

   /**
    * Compiles a throwaway module in an isolated DI container to capture the library's
    * real startup-rejection message, then discards the container. The running app's
    * module is never touched.
    *
    * @param attempt - Which v0.2-rejected surface is being probed.
    * @param buildModule - Returns the DynamicModule whose construction the library rejects.
    * @returns The captured outcome — `rejected: true` + the verbatim error on throw,
    * `rejected: false` (no error text) when construction unexpectedly succeeds.
    */
   export async function attemptConfigure(
     attempt: RoadmapRejectionResult['attempt'],
     buildModule: () => DynamicModule
   ): Promise<RoadmapRejectionResult> {
     let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>> | undefined
     try {
       // forRoot rejects synchronously inside buildModule(); forRootAsync rejects on compile/init.
       const dynamicModule = buildModule()
       moduleRef = await Test.createTestingModule({ imports: [dynamicModule] }).compile()
       await moduleRef.init()
       return { attempt, rejected: false, errorName: '', errorMessage: '' }
     } catch (error) {
       const err = error instanceof Error ? error : new Error(String(error))
       return { attempt, rejected: true, errorName: err.name, errorMessage: err.message }
     } finally {
       await moduleRef?.close()
     }
   }
   ```
   NOTE: for the sync `forRoot({ sms })` / `forRoot({ push })` attempts the throw happens **inside `buildModule()`**
   (forRoot validates eagerly) — the try/catch must wrap `buildModule()`, exactly as above. For the
   `forRootAsync({ useClass })` attempt, `forRootAsync` throws synchronously in `assertUseFactory` too — also caught by
   the same wrapper. Keep ONE code path that catches both.

Constraints (follow /bymax-workflow:standards):
- TS strict: no `any`, no suppression comments, JSDoc on every export, English-only, timeless comments (no phase/task refs).
- The helper is dependency-free beyond @nestjs/testing + @nestjs/common + @bymax-one/nest-notification.
- Functions ≤ 50 lines; SRP. Do NOT hardcode the error string here — it must come from the caught error.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec eslint src/admin --max-warnings 0` — expected: exit 0.
- `node -e "import('./apps/api/src/admin/dto/roadmap-rejection.result.ts').catch(()=>process.exit(0))"` is not required;
  the type-only DTO is validated by tsc above.

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 3 tasks` and Last updated to today.
4. Update the P7 row Progress cell to `1 / 3` in docs/DEVELOPMENT_PLAN.md (+ its Last updated).
5. Append to Completion log: `- 7.1 ✅ <YYYY-MM-DD> — admin DTO + isolated-module rejection probe helper`.
6. Commit: `feat(admin): add roadmap-rejection result DTO + isolated probe helper` (no Co-Authored-By).
````

---

### Task 7.2 — AdminController + AdminModule — the three endpoints

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 7.1

#### Description

Build the `AdminController` exposing the three rejection endpoints, each a thin wrapper over `attemptConfigure` (Task
7.1) that constructs the rejected throwaway module, and register it via `AdminModule` in the app. Each endpoint returns
the `RoadmapRejectionResult` with the library's real thrown message.

#### Acceptance criteria

- [ ] `apps/api/src/admin/admin.controller.ts` exposes `POST /admin/try-configure-sms`,
      `POST /admin/try-configure-push`, and `POST /admin/try-configure-async-useclass`; each `200 OK` returns a
      `RoadmapRejectionResult`.
- [ ] `try-configure-sms` builds `BymaxNotificationModule.forRoot({ sms: <SmsChannelOptions> })` — a bare `{ sms }`
      reaches the **sms throw** first because `validateOptions` checks `sms` before `email`/`otp` — and returns the
      captured `"[BymaxNotificationModule] SMS channel is not yet implemented (planned for v0.2). Remove 'sms' from
options."` message.
- [ ] `try-configure-push` returns the captured `"[BymaxNotificationModule] Push channel is not yet implemented (planned
for v0.2). Remove 'push' from options."` message.
- [ ] `try-configure-async-useclass` builds `BymaxNotificationModule.forRootAsync({ useClass: <a
BymaxNotificationModuleOptionsFactory impl> })` and returns the captured `"[BymaxNotificationModule] forRootAsync
supports only \`useFactory\` in v0.1; \`useClass\` / \`useExisting\` are not yet implemented (planned for v0.2)."`
      message.
- [ ] `apps/api/src/admin/admin.module.ts` declares the controller; it is imported in `apps/api/src/app.module.ts`.
- [ ] JSDoc on every export; TS strict; the rejected option shapes are typed against the library's declared interfaces
      (`SmsChannelOptions`/`PushChannelOptions`/`BymaxNotificationModuleOptionsFactory`), not `any`.
- [ ] `pnpm --filter @nest-notification-example/api exec tsc --noEmit` exits 0; the app boots and the routes are mapped.

#### Files to create / modify

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.module.ts`
- `apps/api/src/app.module.ts` (import `AdminModule`)

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (a NestJS 11 email + OTP
notification library: multi-tenant, pluggable providers/storage, audit log, React hooks). pnpm monorepo (apps/api
NestJS 11 + apps/web Next.js 16), Node 24, TypeScript 5.9 strict, 100% coverage + Stryker ≥ 95.

CURRENT PHASE: 7 (Roadmap Rejection Endpoints) — Task 7.2 of 3 (MIDDLE)

PRECONDITIONS
- Task 7.1 done: `apps/api/src/admin/roadmap-rejection.probe.ts` exports `attemptConfigure(attempt, buildModule)` and
  `apps/api/src/admin/dto/roadmap-rejection.result.ts` exports `RoadmapRejectionResult`.
- The app (P3–P6) boots; `apps/api/src/app.module.ts` already imports the feature modules; the exception filter is wired.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "6. Feature Coverage Matrix" rows 3, 58a, 58b, 58c (the endpoint ⇄ surface mapping) and § "5.
  Repository Layout" (apps/api/src/admin/ target).
- The library gold sources — copy the EXACT error strings, do not paraphrase:
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/config/validate-options.ts (the sms + push throws, and the
  ORDER validateOptions checks channels — sms/push are checked before email/otp, so a bare `{ sms }` triggers the sms
  throw) and ~/Documents/MyApps/bymax-one/nest-notification/src/server/bymax-notification.module.ts (assertUseFactory —
  the useClass/useExisting throw) plus the declared interfaces in
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/interfaces/notification-module-options.interface.ts
  (SmsChannelOptions, PushChannelOptions, BymaxNotificationModuleOptionsFactory).

TASK
Author the AdminController (3 endpoints, each wrapping `attemptConfigure` with the rejected throwaway module) + the
AdminModule, and register AdminModule in app.module.ts.

DELIVERABLES
1. `apps/api/src/admin/admin.controller.ts`:
   ```ts
   import { Controller, Post } from '@nestjs/common'
   import { BymaxNotificationModule } from '@bymax-one/nest-notification'
   import type {
     BymaxNotificationModuleOptions,
     BymaxNotificationModuleOptionsFactory
   } from '@bymax-one/nest-notification'
   import { attemptConfigure } from './roadmap-rejection.probe'
   import type { RoadmapRejectionResult } from './dto/roadmap-rejection.result'

   /** Minimal v0.2 factory used only to trigger the async useClass rejection. */
   class RejectedOptionsFactory implements BymaxNotificationModuleOptionsFactory {
     createNotificationOptions(): BymaxNotificationModuleOptions {
       return {} as BymaxNotificationModuleOptions
     }
   }

   /**
    * Demonstrates the library's honest v0.2 rejection surface: each endpoint compiles a
    * throwaway module configured with a not-yet-implemented option and returns the
    * library's real startup-rejection message.
    */
   @Controller('admin')
   export class AdminController {
     /** Proves the SMS channel is rejected at startup. */
     @Post('try-configure-sms')
     async tryConfigureSms(): Promise<RoadmapRejectionResult> {
       return attemptConfigure('sms', () =>
         BymaxNotificationModule.forRoot({ sms: { provider: undefined } } as BymaxNotificationModuleOptions))
     }

     /** Proves the Push channel is rejected at startup. */
     @Post('try-configure-push')
     async tryConfigurePush(): Promise<RoadmapRejectionResult> {
       return attemptConfigure('push', () =>
         BymaxNotificationModule.forRoot({ push: { provider: undefined } } as BymaxNotificationModuleOptions))
     }

     /** Proves the forRootAsync({ useClass }) form is rejected. */
     @Post('try-configure-async-useclass')
     async tryConfigureAsyncUseClass(): Promise<RoadmapRejectionResult> {
       return attemptConfigure('async-useclass', () =>
         BymaxNotificationModule.forRootAsync({ useClass: RejectedOptionsFactory }))
     }
   }
   ```
   IMPORTANT — match the library's behaviour, do not assume:
   - Read `validateOptions` to confirm the channel-check ORDER. `forRoot` validates eagerly so the `sms`/`push` throw
     fires synchronously inside `BymaxNotificationModule.forRoot(...)` — i.e. inside the `buildModule` callback, which
     `attemptConfigure` wraps in try/catch. Construct the smallest options object that makes the `sms` (or `push`) throw
     the FIRST failure (a bare `{ sms: … }` reaches the sms throw before any email/otp validation — verify against the
     source).
   - For `forRootAsync({ useClass })`, `assertUseFactory` throws synchronously when `useClass`/`useExisting` is present,
     so the throw also fires inside `buildModule`.
   - The `as BymaxNotificationModuleOptions` casts are deliberate and DOCUMENTED (they feed the rejected shape the
     library refuses) — they are NOT `as any`, and carry a one-line comment explaining why the cast is intentional.
2. `apps/api/src/admin/admin.module.ts` — a plain `@Module({ controllers: [AdminController] })`.
3. Import `AdminModule` in `apps/api/src/app.module.ts` alongside the other feature modules.

Constraints (follow /bymax-workflow:standards):
- TS strict: no `any`, no suppression comments, JSDoc on every export (controller + each handler + the factory class),
  English-only, timeless comments (NO phase/task references in the committed source).
- Functions ≤ 50 lines; SRP; the controller only orchestrates — the isolation logic lives in the Task 7.1 helper.
- Do NOT hardcode the error strings in the controller; they must come from the library via `attemptConfigure`.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec eslint src/admin src/app.module.ts --max-warnings 0` — exit 0.
- Boot the API (`pnpm --filter @nest-notification-example/api start &`), then:
  `curl -s -X POST localhost:3001/admin/try-configure-sms` — expected: JSON `{ "attempt":"sms","rejected":true,
  "errorName":"Error","errorMessage":"[BymaxNotificationModule] SMS channel is not yet implemented (planned for v0.2).
  Remove 'sms' from options." }`. Repeat for `/try-configure-push` and `/try-configure-async-useclass` (each returns
  `rejected:true` with the matching verbatim message). Stop the server afterward.

Completion Protocol (run after finishing):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `2 / 3 tasks` and Last updated to today.
4. Update the P7 row Progress cell to `2 / 3` in docs/DEVELOPMENT_PLAN.md (+ its Last updated).
5. Append to Completion log: `- 7.2 ✅ <YYYY-MM-DD> — AdminController + AdminModule (3 rejection endpoints)`.
6. Commit: `feat(admin): add roadmap-rejection endpoints (sms/push/async-useclass)` (no Co-Authored-By).
````

---

### Task 7.3 — Isolated e2e specs asserting the exact thrown strings

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 7.2

#### Description

Write the isolated e2e specs that drive each of the three endpoints over HTTP (supertest) and assert that the response
carries `rejected: true` and the library's **exact** startup-rejection message for `sms`, `push`, and the async
`useClass` form. Cover the helper's `did not reject` branch too. This is the **last** task of the phase — after it, run
the per-phase completion protocol.

#### Acceptance criteria

- [ ] `apps/api/test/admin-roadmap-rejection.e2e-spec.ts` boots the app (or an isolated test module mounting
      `AdminModule`) with supertest and asserts each endpoint returns `200` with `rejected: true` and the **verbatim**
      library message for `sms`, `push`, and `async-useclass`.
- [ ] A unit spec for the probe helper (`apps/api/src/admin/roadmap-rejection.probe.spec.ts`) covers **both** branches:
      the throwing path (returns `rejected: true` + the error message) **and** the non-throwing path (a `buildModule` that
      compiles cleanly → `rejected: false`, `errorMessage: ''`), proving the demo's premise check.
- [ ] The three endpoint messages asserted match the library source **byte-for-byte** (no paraphrase).
- [ ] `pnpm --filter @nest-notification-example/api test:cov` passes with **100%** statements/branches/functions/lines
      for `apps/api/src/admin/**` (the controller, the helper, and the DTO module are fully covered or scoped-excluded per
      the §2 coverage rule — non-executable glue like `*.module.ts`/`*.dto.ts` is excluded from scope).
- [ ] No suppression comments; tests are deterministic (each isolated module is closed; no leaked DI containers/handles).

#### Files to create / modify

- `apps/api/test/admin-roadmap-rejection.e2e-spec.ts`
- `apps/api/src/admin/roadmap-rejection.probe.spec.ts`

#### Agent prompt

````
You are a senior NestJS test engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (a NestJS 11 email + OTP
notification library: multi-tenant, pluggable providers/storage, audit log, React hooks). pnpm monorepo (apps/api
NestJS 11 + apps/web Next.js 16), Node 24, TypeScript 5.9 strict, 100% coverage + Stryker ≥ 95.

CURRENT PHASE: 7 (Roadmap Rejection Endpoints) — Task 7.3 of 3 (LAST)

PRECONDITIONS
- Task 7.1 done: `attemptConfigure(attempt, buildModule)` + `RoadmapRejectionResult` exist under apps/api/src/admin/.
- Task 7.2 done: `AdminController` exposes POST /admin/try-configure-{sms,push,async-useclass}; `AdminModule` is imported
  in app.module.ts; the app boots and the routes are mapped.
- The api test toolchain (Jest + supertest + @nestjs/testing) is configured from earlier phases.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "6. Feature Coverage Matrix" rows 3, 58a, 58b, 58c (what each endpoint must prove) and § "17.
  Testing Strategy" (the 100% coverage + isolated-module e2e convention).
- The library gold sources — copy the EXACT assertion strings, do not paraphrase:
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/config/validate-options.ts (sms + push messages) and
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/bymax-notification.module.ts (assertUseFactory — the
  useClass message).
- The Task 7.1/7.2 source you are testing: apps/api/src/admin/{roadmap-rejection.probe.ts, admin.controller.ts}.

TASK
Author the isolated e2e spec (HTTP-level, supertest) and the probe unit spec, asserting the verbatim library messages
and covering the non-throwing branch — bringing apps/api/src/admin/** to 100%.

DELIVERABLES
1. `apps/api/test/admin-roadmap-rejection.e2e-spec.ts`:
   ```ts
   import { Test } from '@nestjs/testing'
   import type { INestApplication } from '@nestjs/common'
   import request from 'supertest'
   import { AdminModule } from '../src/admin/admin.module'

   describe('Admin roadmap-rejection endpoints (e2e)', () => {
     let app: INestApplication
     beforeAll(async () => {
       const moduleRef = await Test.createTestingModule({ imports: [AdminModule] }).compile()
       app = moduleRef.createNestApplication()
       await app.init()
     })
     afterAll(async () => { await app.close() })

     it('POST /admin/try-configure-sms returns the verbatim SMS rejection', async () => {
       const res = await request(app.getHttpServer()).post('/admin/try-configure-sms').expect(201)
       expect(res.body).toMatchObject({
         attempt: 'sms',
         rejected: true,
         errorMessage:
           "[BymaxNotificationModule] SMS channel is not yet implemented (planned for v0.2). Remove 'sms' from options."
       })
     })
     // …push + async-useclass equivalents, each asserting the EXACT library message.
   })
   ```
   NOTE: confirm the expected HTTP status for a `@Post()` with no explicit code (Nest defaults POST → 201). Adjust the
   `.expect(...)` to match the controller (if Task 7.2 set `@HttpCode(200)`, expect 200). Read the controller, do not guess.
2. `apps/api/src/admin/roadmap-rejection.probe.spec.ts` — unit-test the helper directly:
   - the rejecting path: pass a `buildModule` that throws (e.g. returns `BymaxNotificationModule.forRoot({ sms: … })`)
     → expect `{ rejected: true, errorMessage: <verbatim> }`.
   - the non-rejecting path: pass a `buildModule` that returns a module that compiles cleanly (e.g. a trivial
     `@Module({})` DynamicModule) → expect `{ rejected: false, errorName: '', errorMessage: '' }`. This covers the
     "demo premise holds" branch and the `finally` close.

Constraints (follow /bymax-workflow:standards):
- TS strict; no `any`; no suppression comments. Each `it(...)` carries a one-line comment stating what it proves.
  English-only, timeless (no phase/task references in the committed test source).
- Assertions on the library messages are VERBATIM — copy from the library source, never paraphrase.
- Deterministic & leak-free: close every app/module you compile; no parallel test fan-out (run the suite with the
  repo's bounded worker cap, e.g. `--maxWorkers=2`).

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api test:cov -- admin` (or the repo's coverage script scoped to admin) —
  expected: all admin specs pass; 100% statements/branches/functions/lines for `src/admin/**` (non-executable glue
  scoped-excluded per §2).
- `pnpm --filter @nest-notification-example/api exec eslint test/admin-roadmap-rejection.e2e-spec.ts src/admin --max-warnings 0`
  — expected: exit 0.

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):

PER-TASK:
1. Set 7.3 Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `3 / 3 tasks` and Last updated to today.
4. Update the P7 row Progress cell to `3 / 3` in docs/DEVELOPMENT_PLAN.md (+ its Last updated).
5. Append to Completion log: `- 7.3 ✅ <YYYY-MM-DD> — isolated e2e + probe specs assert verbatim rejection strings`.
6. Commit: `test(admin): assert verbatim roadmap-rejection messages (sms/push/async-useclass)` (no Co-Authored-By).

PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, in
docs/DEVELOPMENT_PLAN.md set the **P7 Status to ✅** and Progress `3 / 3`, advance **Active phase** to P8, and recompute
**Overall progress** to `7 / 15 phases (47%)`; set this file's header Status to ✅; commit `docs(plan): P7 complete`
(no Co-Authored-By).
````

---

## Phase Completion Protocol

When **Task 7.3** is `✅` and every other task is `✅`:

1. Confirm all 3 tasks are `✅` and the P7 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P7`](../DEVELOPMENT_PLAN.md#phase-7--roadmap-rejection-endpoints)
   is met: each endpoint (`/admin/try-configure-{sms,push,async-useclass}`) returns the **exact** thrown error for
   `sms` / `push` / `forRootAsync({ useClass })`; the rejections are produced by **isolated** `Test.createTestingModule`
   modules (the running app's module is never mutated); the isolated e2e specs assert those exact strings; 100% covered.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P7 Status** to `✅`, **Progress** `3 / 3`, **Last
   updated** today; set **Active phase** to `P8`; recompute **Overall progress** to `7 / 15 phases (47%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `3 / 3 tasks`.
5. Commit `docs(plan): P7 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P7 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 7.1 ✅ 2026-06-23 — admin DTO + isolated-module rejection probe helper
