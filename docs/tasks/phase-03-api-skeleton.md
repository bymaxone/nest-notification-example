# Phase 3 — API Skeleton

> **Status**: ✅ Done · **Progress**: 6 / 6 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P3
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

P0–P2 produced a building, fully-gated monorepo: the toolchain + CI, the local stack (`docker-compose` postgres/redis/
mailpit + the Zod env schema at `apps/api/src/config/env.schema.ts`), and the `file:`-linked `@bymax-one/nest-notification`
library with its export audit. `apps/api` exists as a NestJS package skeleton (a `package.json` + the env schema + the
`library-probe.ts`) but does **not** boot — there is no `main.ts`, no `AppModule`, no HTTP surface.

Phase 3 produces a **bootable NestJS service with the cross-cutting plumbing the notification module needs** — and
nothing more. It wires: the `main.ts` bootstrap (Helmet, CORS that allows `x-tenant-id` and exposes `Retry-After`,
coordinated shutdown), the `AppModule` skeleton, the `GET /health` liveness route, the `NotificationException` → HTTP
exception filter (serializing the catalog shape `{ error: { code, message, details } }`), the `x-tenant-id`
guard + `@TenantId()` decorator and the generic Zod validation pipe (the `common/` layer the controllers will use), the
`RedisModule` exporting the `REDIS` `Symbol` token (an `ioredis` client **or `null`** when `REDIS_URL` is unset), and the
`PrismaModule` + `PrismaService` over the `@prisma/adapter-pg` ESM client. When P3 is done, the app boots with **and
without** `REDIS_URL`, `GET /health` returns `200`, and the exception filter / Redis-null branch are unit-proven.

**No notification module wiring (`forRootAsync`), no providers/renderers, no domain controllers** — those are P4/P5. This
phase only stands up the chassis they bolt onto.

The gold sources for the file contents are the sibling repos — copy and **adapt** their proven shapes rather than
inventing: `nest-logger-example/apps/api/src/{main.ts,health,common,prisma}` and `nest-auth-example/apps/api/src/redis`
(the token-module shape), and the library's `errors/` (`NotificationException` + `NOTIFICATION_ERROR_CODES`).

---

## Rules-of-phase

1. **No notification module, no domain controllers** — only the bootstrap, `/health`, the exception filter, the
   `common/` primitives (tenant guard/decorator + Zod pipe), `RedisModule`, and `PrismaModule`/`PrismaService`. The
   `forRootAsync` wiring and the `/otp`·`/email`·`/dispatch` controllers belong to P4/P5.
2. **Prisma 7 is ESM-first** — use the `@prisma/adapter-pg` driver adapter (`PrismaPg`), keep the connection URL out of
   the schema, and align the module format (`.js` import specifiers, `"type":"module"`). Do not use the legacy
   `datasources` block.
3. **The `REDIS` token resolves to `null`, never throws, when `REDIS_URL` is unset** — the OTP wiring (P4) branches on
   `redis ? RedisOtpStorage : InMemoryOtpStorage`, so the absence of Redis must be a _value_, not an exception. Test the
   `null` branch explicitly.
4. **`REDIS` is a `Symbol`** DI token exported from `redis.module.ts` (per OVERVIEW §9). Boolean naming `is`/`has`.
5. **CORS contract** — allow the `x-tenant-id` header (the trusted tenant source, OVERVIEW §13) and expose `Retry-After`
   (the OTP cooldown surfaces it, OVERVIEW §10). Read `WEB_ORIGIN` / `PORT` from `ConfigService`, never `process.env`.
6. **Trust the tenant from the header, never the body** — the guard reads `x-tenant-id`; a missing header resolves to
   `default` (it does not 401). The body is never consulted for the tenant (OVERVIEW §11 Stage 1).
7. **TS strict + zero suppression comments**, JSDoc on every export, English-only, timeless comments — the deliverable
   code carries **no** phase/task/roadmap-stage references (this planning doc may; the committed source may not).
8. **Clean Code sizing** — functions ≤ 50 lines, files ≤ 800 (200–400 typical); SRP/SOLID; explicit DI; the DI token is a
   `Symbol`. Versions: Node 24, NestJS 11, TypeScript 5.9 strict.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §9 Configuration & Environment (the `RedisModule`/`PrismaModule`/`REDIS`-token
  wiring + the canonical-wiring shape), §11 The Notification Delivery Pipeline (Stage 1 Resolve — trusted tenant), §5
  Repository Layout (the `apps/api/src/*` target tree), §13 Multi-Tenant Security.
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P3, §2 Global Conventions, §3 Autonomous Execution Model,
  Appendix A (env registry), Appendix C (Quality Gates).
- Sibling gold sources (copy & adapt — do not invent):
  - `~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/{main.ts, health/*, common/zod-validation.pipe.ts, prisma/prisma.service.ts, prisma/prisma.module.ts}`.
  - `~/Documents/MyApps/bymax-one/nest-auth-example/apps/api/src/redis/{redis.module.ts, redis.provider.ts}` (the
    token-module shape — adapt: `Symbol` token `REDIS`, returns `null` when unset).
  - `~/Documents/MyApps/bymax-one/nest-notification/src/server/errors/{notification-exception.ts, notification-error-codes.ts,index.ts}` (the exception + catalog the filter serializes).
- `/bymax-workflow:standards` skill — universal coding rules.
- Vault: [[Example-App-Standard]], [[NestJS/Bymax-Conventions]], [[Prisma/Gotchas]].

---

## Task index

| ID  | Task                                                                | Status  | Priority | Size | Depends on         |
| --- | ------------------------------------------------------------------- | ------- | -------- | ---- | ------------------ |
| 3.1 | `main.ts` bootstrap + `AppModule` skeleton + `/health`              | ✅ Done | P0       | M    | —                  |
| 3.2 | `NotificationException` → HTTP exception filter                     | ✅ Done | P0       | S    | 3.1                |
| 3.3 | `x-tenant-id` guard + `@TenantId()` decorator + Zod validation pipe | ✅ Done | P0       | M    | 3.1                |
| 3.4 | `RedisModule` — `REDIS` `Symbol` token → client or `null`           | ✅ Done | P0       | M    | 3.1                |
| 3.5 | `PrismaModule` + `PrismaService` (`@prisma/adapter-pg`)             | ✅ Done | P1       | M    | 3.1                |
| 3.6 | Wire `AppModule` + boot-with/without-Redis verification             | ✅ Done | P0       | M    | 3.2, 3.3, 3.4, 3.5 |

---

## Tasks

### Task 3.1 — `main.ts` bootstrap + `AppModule` skeleton + `/health`

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Author the application entrypoint (`main.ts`) and the root `AppModule` skeleton so the service boots and answers
`GET /health` → `200`, with Helmet, the CORS contract (`x-tenant-id` allowed, `Retry-After` exposed), and a coordinated
shutdown — all config read from `ConfigService`.

#### Acceptance criteria

- [x] `apps/api/src/main.ts` boots NestJS (`NestExpressApplication`), registers `helmet()`, enables CORS with
      `origin = WEB_ORIGIN`, `allowedHeaders` including `Content-Type`/`Accept`/`x-tenant-id`/`x-role`, and
      `exposedHeaders` including `Retry-After`; listens on `PORT` from `ConfigService<Env, true>`.
- [x] A single coordinated `SIGTERM`/`SIGINT` shutdown runs `app.close()` (firing `OnApplicationShutdown` hooks) then
      `process.exit(0)`, idempotent across both signals.
- [x] `apps/api/src/app.module.ts` imports `ConfigModule.forRoot` (validating via the P1 `env.schema`) + `HealthModule`;
      no notification module, no domain controllers yet.
- [x] `apps/api/src/health/{health.controller.ts,health.module.ts}` expose `GET /health` → `{ status: 'ok' }` (200).
- [x] The app starts (`pnpm --filter @nest-notification-example/api start` or the dev script) and `curl /health` → 200.

#### Files to create / modify

- `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.module.ts`
- `apps/api/src/health/health.controller.spec.ts`
- `apps/api/package.json` (add the `start`/`start:dev` scripts + the `@nestjs/*` deps if the P1 skeleton lacks them)

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib: multi-tenant, pluggable providers/storage, audit log). pnpm monorepo, Node 24, TypeScript 5.9 strict,
100% coverage + Stryker ≥95 bar; apps/api (NestJS 11) hosts the lib + a thin demo controller surface.

CURRENT PHASE: 3 (API Skeleton) — Task 3.1 of 6 (FIRST)

PRECONDITIONS
- P0–P2 done: the monorepo builds; apps/api exists as a NestJS package skeleton with a validated Zod env schema at
  apps/api/src/config/env.schema.ts (exporting `type Env`) and the @bymax-one/nest-notification lib linked via `file:`.
- apps/api does NOT boot yet — there is no main.ts / AppModule / HTTP surface.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "9. Configuration & Environment" (the env vars PORT/WEB_ORIGIN, the wiring intent) and
  § "5. Repository Layout" (the apps/api/src/* target tree).
- docs/DEVELOPMENT_PLAN.md § "Phase 3 — API Skeleton" (Scope-In/DoD) + § "2. Global Conventions".
- Sibling files (copy & adapt — do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/
  {main.ts, health/health.controller.ts, health/health.module.ts}. ADAPT OUT the logger-specific bits: there is NO
  OTel `./instrumentation.js` import, NO `BymaxLoggerModule.useNestLogger`, NO `/metrics` route, NO `x-actor`/`x-api-key`
  CORS headers and NO export-truncated exposed headers — this is a notification API, not the logger demo.
- The local env contract: apps/api/src/config/env.schema.ts (read it to learn the exact `Env` field names — at least
  PORT and WEB_ORIGIN).

TASK
Author main.ts (bootstrap + Helmet + CORS contract + coordinated shutdown) and the AppModule skeleton + the /health
route so the service boots and `GET /health` returns 200.

DELIVERABLES
1. `apps/api/src/health/health.controller.ts` — a root `@Controller()` with a single `@Get('health')` returning
   `{ status: 'ok' as const }`. JSDoc on the class + method.
   ```ts
   @Controller()
   export class HealthController {
     /** Liveness probe. @returns A constant `{ status: 'ok' }` payload with HTTP 200. */
     @Get('health')
     health(): { status: 'ok' } { return { status: 'ok' } }
   }
   ```
2. `apps/api/src/health/health.module.ts` — `@Module({ controllers: [HealthController] })`, no providers (so liveness
   is self-contained).
3. `apps/api/src/health/health.controller.spec.ts` — asserts `health()` returns `{ status: 'ok' }` (100% of the file).
4. `apps/api/src/app.module.ts` — the root module skeleton:
   ```ts
   @Module({
     imports: [
       ConfigModule.forRoot({
         isGlobal: true,
         // Validate process.env with the Zod schema from config/env.schema.ts (fail-fast on a bad var).
         validate: (raw) => envSchema.parse(raw),
       }),
       HealthModule,
     ],
   })
   export class AppModule {}
   ```
   (Import the schema/`validate` helper exactly as env.schema.ts exposes it — adapt to its actual export.)
5. `apps/api/src/main.ts` — bootstrap, ESM import specifiers ending in `.js`:
   ```ts
   const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false })
   const config = app.get<ConfigService<Env, true>>(ConfigService)
   app.use(helmet())
   app.enableCors({
     origin: config.get('WEB_ORIGIN', { infer: true }),
     allowedHeaders: ['Content-Type', 'Accept', 'x-tenant-id', 'x-role'],
     exposedHeaders: ['Retry-After'],          // the OTP cooldown surfaces it (OVERVIEW §10)
   })
   // single idempotent SIGTERM/SIGINT owner → app.close() (fires OnApplicationShutdown) → process.exit(0)
   await app.listen(config.get('PORT', { infer: true }))
   ```
6. `apps/api/package.json` — add `"start": "nest start"`, `"start:dev": "nest start --watch"` and the runtime deps if
   the P1 skeleton lacks them (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `helmet`,
   `reflect-metadata`); keep the test/build scripts the skeleton already declares.

Constraints (follow /bymax-workflow:standards):
- TS strict, JSDoc on every export, English-only, NO suppression comments. NO `process.env.*` reads — only ConfigService.
- Timeless comments — NO Phase/Task/roadmap references in any source file. Functions ≤ 50 lines. ESM `.js` specifiers.
- Do NOT add notification-module wiring or any domain controller — those are later phases. Do NOT re-introduce the
  logger demo's OTel/metrics/logger bridge.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/health` — expected: the health spec passes, 100% on the file.
- Boot + probe (one terminal): `pnpm --filter @nest-notification-example/api start &` then
  `curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health` — expected: `200`. Stop the server after.
  (Adapt the filter name to the api package's actual `name` field if it differs.)

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 6` and Last updated to today.
4. Update the P3 row Progress to `1 / 6` in docs/DEVELOPMENT_PLAN.md (+ its Last updated).
5. Append to Completion log: `- 3.1 ✅ <YYYY-MM-DD> — main.ts bootstrap + AppModule skeleton + /health`.
6. Commit: `feat(api): bootstrap nestjs app + health route` (no Co-Authored-By).
````

---

### Task 3.2 — `NotificationException` → HTTP exception filter

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 3.1

#### Description

Add the global exception filter that catches a library `NotificationException` and serializes it to the catalog shape
`{ error: { code, message, details } }` with the exception's own HTTP status, registered as `APP_FILTER` so every future
controller benefits without per-endpoint wiring.

#### Acceptance criteria

- [x] `apps/api/src/common/notification-exception.filter.ts` is `@Catch(NotificationException)`, reads the status via
      `exception.getStatus()` and the body via `exception.getResponse()`, and writes the unchanged catalog body
      `{ error: { code, message, details } }` with that status.
- [x] It is registered as `APP_FILTER` (in `app.module.ts` or a `common.module.ts` imported by `AppModule`).
- [x] A unit test proves a `new NotificationException('OTP_INVALID_CODE')` serializes to status `401` and a body equal to
      the shape `exception.getResponse()` returns (read the actual body shape from the lib's
      `errors/notification-exception.ts` — assert against `{ error: { code: 'notification.otp_invalid_code', message: ... } }`
      with whatever `details` field the lib emits; do **not** hardcode `details: null`); and that a `'OTP_COOLDOWN_ACTIVE'`
      maps to `429`.
- [x] No secrets/codes are read or logged by the filter (it only forwards the already-safe catalog body).

#### Files to create / modify

- `apps/api/src/common/notification-exception.filter.ts`
- `apps/api/src/common/notification-exception.filter.spec.ts`
- `apps/api/src/app.module.ts` (register `APP_FILTER`)

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95. apps/api hosts the lib + a thin demo surface.

CURRENT PHASE: 3 (API Skeleton) — Task 3.2 of 6 (MIDDLE)

PRECONDITIONS
- Task 3.1 done: apps/api boots, AppModule + /health exist, ConfigService wired.

REQUIRED READING (only these — do not load more):
- The library error contract: ~/Documents/MyApps/bymax-one/nest-notification/src/server/errors/
  {notification-exception.ts, notification-error-codes.ts, index.ts}. `NotificationException` extends NestJS
  `HttpException`; its body is `{ error: { code, message, details } }` and its status comes from the catalog (e.g.
  OTP_INVALID_CODE→401, OTP_COOLDOWN_ACTIVE→429, OTP_NOT_FOUND→404). Import it from the package root
  `@bymax-one/nest-notification` (the `errors` barrel is re-exported there).
- docs/OVERVIEW.md § "11. The Notification Delivery Pipeline" (the error shape is the consumer-facing contract).
- docs/DEVELOPMENT_PLAN.md § "Phase 3 — API Skeleton" (DoD: the filter serializes the catalog shape with the right status).
- The filter STYLE to mirror (adapt, do not copy verbatim): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/
  src/common/zod-validation.filter.ts (the `@Catch` + `ArgumentsHost.switchToHttp().getResponse<Response>()` pattern) —
  but DROP the logger injection; this filter has NO logger dependency.

TASK
Author a global `@Catch(NotificationException)` filter that forwards the library's catalog body verbatim with the
exception's own HTTP status, and register it as APP_FILTER.

DELIVERABLES
1. `apps/api/src/common/notification-exception.filter.ts`:
   ```ts
   @Catch(NotificationException)
   @Injectable()
   export class NotificationExceptionFilter implements ExceptionFilter {
     /** Serialize a NotificationException to `{ error: { code, message, details } }` with its catalog status. */
     catch(exception: NotificationException, host: ArgumentsHost): void {
       const response = host.switchToHttp().getResponse<Response>()
       // exception.getResponse() already IS the catalog body { error: { code, message, details } }.
       response.status(exception.getStatus()).json(exception.getResponse())
     }
   }
   ```
   JSDoc on the class + method. No logger, no env reads, no mutation of the body.
2. Register it as a global filter — add to AppModule providers:
   `{ provide: APP_FILTER, useClass: NotificationExceptionFilter }`.
3. `apps/api/src/common/notification-exception.filter.spec.ts` — drive `catch()` with a mocked `ArgumentsHost`
   (`switchToHttp().getResponse()` returns a stub with chainable `status().json()`), asserting:
   - `new NotificationException('OTP_INVALID_CODE')` → `status(401)` + the `json` arg equals the shape
     `exception.getResponse()` returns. Read the actual body shape from the lib's `errors/notification-exception.ts`
     before writing the assertion (it is `{ error: { code: 'notification.otp_invalid_code', message: ... } }` plus
     whatever `details` field the lib emits) — assert against the real shape; do NOT hardcode `details: null`. The
     simplest correct assertion is `expect(json).toHaveBeenCalledWith(exception.getResponse())`.
   - `new NotificationException('OTP_COOLDOWN_ACTIVE')` → `status(429)`.
   Cover 100% of the file (one `catch` path; assert status + json args).

Constraints (follow /bymax-workflow:standards):
- TS strict, JSDoc on every export, English-only, NO suppression comments. The filter NEVER logs or reads request data —
  it only forwards the already-masked catalog body. Timeless comments — no Phase/Task references. ESM `.js` specifiers.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/common/notification-exception.filter` — expected: passes,
  100% on the filter file.

Completion Protocol:
1. Set 3.2 Status ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress → `2 / 6`, Last updated → today.
3. Update the P3 row Progress to `2 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 3.2 ✅ <YYYY-MM-DD> — NotificationException → HTTP exception filter`.
5. Commit: `feat(api): map NotificationException to http via global filter` (no Co-Authored-By).
````

---

### Task 3.3 — `x-tenant-id` guard + `@TenantId()` decorator + Zod validation pipe

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 3.1

#### Description

Add the `common/` request primitives the domain controllers (P5) will reuse: a guard/decorator that derives the trusted
tenant from the `x-tenant-id` header (defaulting to `default`, never from the body), and a generic Zod validation pipe.

#### Acceptance criteria

- [x] `apps/api/src/common/tenant-id.decorator.ts` exposes a `@TenantId()` param decorator that returns the
      `x-tenant-id` header (a multi-value header collapses to its first entry; absence → `'default'`); the tenant is **never**
      read from the request body.
- [x] `apps/api/src/common/zod-validation.pipe.ts` is a generic `ZodValidationPipe<TSchema extends ZodType>` that
      `safeParse`s the value and throws `BadRequestException({ message: 'Validation failed', errors: [...] })` on failure
      (issues capped, path + message only — never the rejected value).
- [x] Unit tests cover: tenant present (single + array header), tenant absent (→ `'default'`), pipe success, pipe
      failure (BadRequest with bounded issues) — 100% per file.
- [x] These are importable directly from `common/`; no `common.module.ts` barrel is needed to keep `AppModule` tidy.

#### Files to create / modify

- `apps/api/src/common/tenant-id.decorator.ts`, `apps/api/src/common/zod-validation.pipe.ts`
- `apps/api/src/common/tenant-id.decorator.spec.ts`, `apps/api/src/common/zod-validation.pipe.spec.ts`

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib),
multi-tenant. pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95.

CURRENT PHASE: 3 (API Skeleton) — Task 3.3 of 6 (MIDDLE)

PRECONDITIONS
- Task 3.1 done: apps/api boots, AppModule + /health exist; `zod` is a dependency (the env schema uses it).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "11. The Notification Delivery Pipeline" — Stage 1 Resolve: the tenantId ALWAYS comes from a
  trusted source (the `x-tenant-id` header), NEVER the request body; on the direct routes the controller derives the
  tenant from the header itself. And § "13. Multi-Tenant Security & Recipient Privacy".
- docs/DEVELOPMENT_PLAN.md § "Phase 3 — API Skeleton" (Scope-In: the `x-tenant-id` guard/decorator + the Zod pipe).
- Sibling file (copy & adapt the GENERIC Zod-pipe shape): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/
  common/zod-validation.pipe.ts (the `safeParse` → `BadRequestException` pattern, capped issues, path+message only).

TASK
Author the `common/` request primitives: a trusted-tenant `@TenantId()` param decorator + a generic Zod validation pipe,
each fully unit-tested.

DELIVERABLES
1. `apps/api/src/common/tenant-id.decorator.ts` — a `createParamDecorator` that reads the trusted header:
   ```ts
   /** Resolve the trusted tenant from the `x-tenant-id` header; absence → 'default'. Never reads the body. */
   export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
     const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>()
     const header = req.headers['x-tenant-id']
     return Array.isArray(header) ? (header[0] ?? 'default') : (header ?? 'default')
   })
   ```
   Export a small pure helper (e.g. `resolveTenantId(header: string | string[] | undefined): string`) so the logic is
   directly unit-testable at 100% without an HTTP harness, and have the decorator delegate to it.
2. `apps/api/src/common/zod-validation.pipe.ts` — the generic pipe (mirror the sibling):
   ```ts
   @Injectable()
   export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
     constructor(private readonly schema: TSchema) {}
     /** Parse `value` with the schema; throw BadRequestException on failure. */
     transform(value: unknown): ReturnType<TSchema['parse']> {
       const result = this.schema.safeParse(value)
       if (!result.success) {
         const errors = result.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message }))
         throw new BadRequestException({ message: 'Validation failed', errors })
       }
       return result.data as ReturnType<TSchema['parse']>
     }
   }
   ```
3. `apps/api/src/common/tenant-id.decorator.spec.ts` — assert `resolveTenantId('acme')`→'acme',
   `resolveTenantId(['acme','globex'])`→'acme', `resolveTenantId(undefined)`→'default', `resolveTenantId([])`→'default'.
4. `apps/api/src/common/zod-validation.pipe.spec.ts` — a passing parse returns the typed data; a failing parse throws
   `BadRequestException` whose response carries `message: 'Validation failed'` + a bounded `errors` array
   (path+message, no rejected value). 100% per file.

Constraints (follow /bymax-workflow:standards):
- TS strict, JSDoc on every export, English-only, NO suppression comments. The tenant is NEVER read from the body — only
  the header. Cap the Zod issue list; never put the rejected value in the error. Timeless comments — no Phase/Task refs.
  ESM `.js` specifiers. Functions ≤ 50 lines.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/common/tenant-id src/common/zod-validation` — expected:
  both specs pass, 100% on each file.

Completion Protocol:
1. Set 3.3 Status ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress → `3 / 6`, Last updated → today.
3. Update the P3 row Progress to `3 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 3.3 ✅ <YYYY-MM-DD> — tenant-id guard/decorator + zod validation pipe`.
5. Commit: `feat(api): add trusted x-tenant-id decorator + zod validation pipe` (no Co-Authored-By).
````

---

### Task 3.4 — `RedisModule` — `REDIS` `Symbol` token → client or `null`

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 3.1

#### Description

Add the global `RedisModule` that provides the `REDIS` `Symbol` DI token, resolving to a connected `ioredis` client when
`REDIS_URL` is set and to **`null`** (never throwing) when it is unset — the value the P4 OTP wiring branches on.

#### Acceptance criteria

- [x] `apps/api/src/redis/redis.module.ts` exports a `Symbol` token `REDIS` (defined in `redis.token.ts` to avoid the
      module↔provider import cycle, re-exported from the module) and a `@Global()` module providing it via a `useFactory`
      injecting `ConfigService`.
- [x] The factory returns a `new Redis(url, { lazyConnect, maxRetriesPerRequest: null, retryStrategy })` when
      `REDIS_URL` is set, and **`null`** when it is unset — it never throws on a missing URL.
- [x] On `onApplicationShutdown`, the module calls `redis.quit()` **only when** the injected client is non-`null`.
- [x] Unit tests cover both branches: `REDIS_URL` present (factory returns a client; shutdown quits it) and absent
      (factory returns `null`; shutdown is a no-op) — 100% on the module/provider files.
- [x] The token + module are exported so P4's `forRootAsync({ inject: [REDIS] })` can consume them.

#### Files to create / modify

- `apps/api/src/redis/redis.module.ts`, `apps/api/src/redis/redis.provider.ts`
- `apps/api/src/redis/redis.provider.spec.ts`, `apps/api/src/redis/redis.module.spec.ts`
- `apps/api/package.json` (add `ioredis` if absent)

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95. apps/api hosts the lib; OTP storage is Redis (opt-in)
or in-memory.

CURRENT PHASE: 3 (API Skeleton) — Task 3.4 of 6 (MIDDLE)

PRECONDITIONS
- Task 3.1 done: apps/api boots, AppModule + global ConfigService wired. The env schema declares `REDIS_URL` as OPTIONAL
  (unset ⇒ in-memory OTP).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "9. Configuration & Environment" — the canonical wiring: `REDIS` is a `Symbol` token whose factory
  returns an `ioredis` client OR `null` (when `REDIS_URL` unset); `redis ? new RedisOtpStorage(...) : new
  InMemoryOtpStorage()` depends on the token resolving to NULL, not throwing.
- docs/DEVELOPMENT_PLAN.md § "Phase 3 — API Skeleton" (Rules-of-phase: the REDIS token must resolve to `null` when
  unconfigured; DoD: tests cover the `REDIS = null` branch).
- Sibling token-module SHAPE (copy & adapt): ~/Documents/MyApps/bymax-one/nest-auth-example/apps/api/src/redis/
  {redis.module.ts, redis.provider.ts} — adapt: token is a local `Symbol('REDIS')` (NOT `BYMAX_AUTH_REDIS_CLIENT`); the
  factory returns `Redis | null` (the auth example uses `getOrThrow` — here use the OPTIONAL `REDIS_URL` and return
  `null` when absent); shutdown `quit()` guards on non-null.

TASK
Author the global `RedisModule` exporting the `REDIS` Symbol token → an `ioredis` client when `REDIS_URL` is set, else
`null`, with a null-guarded graceful shutdown — both branches unit-proven.

DELIVERABLES
1. `apps/api/src/redis/redis.module.ts`:
   ```ts
   /** DI token for the shared ioredis client — resolves to a client OR `null` when REDIS_URL is unset. */
   export const REDIS = Symbol('REDIS')

   @Global()
   @Module({ providers: [redisProvider], exports: [REDIS] })
   export class RedisModule implements OnApplicationShutdown {
     constructor(@Inject(REDIS) private readonly redis: Redis | null) {}
     /** Close the connection on shutdown — only when a client was created. */
     async onApplicationShutdown(): Promise<void> { if (this.redis) await this.redis.quit() }
   }
   ```
2. `apps/api/src/redis/redis.provider.ts`:
   ```ts
   export const redisProvider: Provider = {
     provide: REDIS,
     inject: [ConfigService],
     useFactory: (config: ConfigService<Env, true>): Redis | null => {
       const url = config.get('REDIS_URL', { infer: true })   // OPTIONAL — unset ⇒ in-memory OTP
       if (!url) return null
       return new Redis(url, {
         lazyConnect: true,
         maxRetriesPerRequest: null,            // required for blocking-command consumers
         retryStrategy: (times: number) => Math.min(times * 200, 2_000),
       })
     },
   }
   ```
   (Import `REDIS` from redis.module.ts; import `Env` from ../config/env.schema.js.)
3. `apps/api/src/redis/redis.provider.spec.ts` — call `redisProvider.useFactory` with a stub ConfigService:
   - `REDIS_URL` set → returns a truthy object that is a `Redis` instance (you may stub the `ioredis` ctor via
     `jest.mock('ioredis')` to avoid a real socket) and asserts the options passed (lazyConnect, maxRetriesPerRequest);
   - `REDIS_URL` unset/empty → returns `null`. 100% of the provider file (both branches + the retryStrategy lambda).
4. `apps/api/src/redis/redis.module.spec.ts` — `onApplicationShutdown` calls `quit()` when the injected client is
   non-null, and is a no-op (no throw) when it is `null`. 100% of the module file.
5. `apps/api/package.json` — add `ioredis` to dependencies if the P1 skeleton lacks it; run
   `pnpm install --no-frozen-lockfile` and commit the updated lockfile.

Constraints (follow /bymax-workflow:standards):
- TS strict, JSDoc on every export, English-only, NO suppression comments. The factory NEVER throws on a missing
  REDIS_URL — it returns `null`. The DI token is a `Symbol`. Timeless comments — no Phase/Task refs. ESM `.js` specifiers.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/redis` — expected: both specs pass; coverage 100% on the
  provider + module files including the `null` branch.

Completion Protocol:
1. Set 3.4 Status ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress → `4 / 6`, Last updated → today.
3. Update the P3 row Progress to `4 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 3.4 ✅ <YYYY-MM-DD> — RedisModule (REDIS Symbol token → client or null)`.
5. Commit: `feat(api): add RedisModule with REDIS token resolving to client or null` (no Co-Authored-By).
````

---

### Task 3.5 — `PrismaModule` + `PrismaService` (`@prisma/adapter-pg`)

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: M
- **Depends on**: 3.1

#### Description

Add the global `PrismaModule` and the injectable `PrismaService` over the Prisma 7 `@prisma/adapter-pg` driver adapter
(connection URL kept out of the schema), connecting in `onModuleInit` and disconnecting in `onApplicationShutdown` — the
chassis the P4 audit repository writes through.

#### Acceptance criteria

- [x] `apps/api/src/prisma/prisma.service.ts` extends `PrismaClient` using `new PrismaPg({ connectionString:
DATABASE_URL })` from `ConfigService`; `onModuleInit` → `$connect()`, `onApplicationShutdown` → `$disconnect()`.
- [x] `apps/api/src/prisma/prisma.module.ts` is `@Global()`, providing + exporting `PrismaService`.
- [x] A minimal generatable Prisma schema exists (`apps/api/prisma/schema.prisma`) with the client generator + the
      `postgresql` datasource; the connection URL is supplied via `prisma.config.ts` (Prisma 7 no longer accepts `url` in
      the datasource block), so `prisma generate` produces a client `tsc` resolves. (No domain models yet — the audit
      model is added in P4; an empty schema that generates is sufficient.)
- [x] Unit tests cover `onModuleInit` (calls `$connect`) and `onApplicationShutdown` (calls `$disconnect`) by spying on
      the instance — 100% on the service file.
- [x] The module resolves in a Nest test harness (verified by the boot-branch integration test in Task 3.6).

#### Files to create / modify

- `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`
- `apps/api/src/prisma/prisma.service.spec.ts`
- `apps/api/prisma/schema.prisma` (generator + datasource, no models yet)
- `apps/api/package.json` (add `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`; a `prisma generate` postinstall/db
  script)

#### Agent prompt

````
You are a senior NestJS + Prisma backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib).
pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95. apps/api persists the delivery audit log in Postgres
via Prisma.

CURRENT PHASE: 3 (API Skeleton) — Task 3.5 of 6 (MIDDLE)

PRECONDITIONS
- Task 3.1 done: apps/api boots, AppModule + global ConfigService wired. The env schema declares `DATABASE_URL`
  (required). A docker-compose Postgres exists from P1 (DATABASE_URL → localhost:5432/notification_example).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "9. Configuration & Environment" — `PrismaModule` provides `PrismaService` (the @prisma/adapter-pg
  client); § "5. Repository Layout" (apps/api/prisma/schema.prisma is `NotificationLog` (audit) + Tenant — but those
  MODELS are added in P4; this phase only needs a schema that GENERATES).
- docs/DEVELOPMENT_PLAN.md § "Phase 3 — API Skeleton" (Rules-of-phase: Prisma 7 is ESM-first — use the driver adapter,
  align the module format).
- Sibling files (copy & adapt): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/prisma/
  {prisma.service.ts, prisma.module.ts} — they already use `PrismaPg({ connectionString })` + onModuleInit/$connect +
  onApplicationShutdown/$disconnect + a `@Global()` module. Adapt the package name; keep the adapter pattern verbatim.

TASK
Author the global `PrismaModule` + `PrismaService` over the @prisma/adapter-pg driver adapter, plus a minimal
generatable schema, with lifecycle unit tests.

DELIVERABLES
1. `apps/api/prisma/schema.prisma` — Prisma 7 ESM client generator + postgresql datasource, NO domain models yet:
   ```prisma
   generator client {
     provider = "prisma-client"
     output   = "../node_modules/.prisma/client"   // or the repo's standard generated location
     // moduleFormat = "esm"  // if the consuming app is ESM and the generator supports it
   }
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
   Re-verify the current Prisma 7 generator syntax via context7 (`prisma`) before writing — the generator block moved
   between majors. The schema must `prisma generate` cleanly even with no models.
2. `apps/api/src/prisma/prisma.service.ts`:
   ```ts
   @Injectable()
   export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
     constructor(config: ConfigService) {
       const adapter = new PrismaPg({ connectionString: config.getOrThrow<string>('DATABASE_URL') })
       super({ adapter })
     }
     /** Connect when the module initialises. */
     async onModuleInit(): Promise<void> { await this.$connect() }
     /** Release the pool on shutdown. */
     async onApplicationShutdown(): Promise<void> { await this.$disconnect() }
   }
   ```
3. `apps/api/src/prisma/prisma.module.ts` — `@Global() @Module({ providers: [PrismaService], exports: [PrismaService] })`.
4. `apps/api/src/prisma/prisma.service.spec.ts` — spy on `PrismaClient.prototype.$connect` / `$disconnect` (or inject a
   subclass) and assert `onModuleInit`/`onApplicationShutdown` call them once; construct with a stub ConfigService
   returning a dummy DATABASE_URL. 100% on the service file.
5. `apps/api/package.json` — add `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg` deps + a `"db:generate":
   "prisma generate"` script (and wire generate into the build/test prep so `@prisma/client` types exist for `tsc`).
   Run `pnpm install --no-frozen-lockfile`, then `pnpm --filter ...@nest-notification-example/api exec prisma generate`, and commit the lockfile.

Constraints (follow /bymax-workflow:standards):
- TS strict, JSDoc on every export, English-only, NO suppression comments. The connection URL comes from ConfigService,
  NOT the schema file and NOT `process.env`. NO domain models in this phase (P4 adds `NotificationLog`). Timeless
  comments — no Phase/Task refs. ESM `.js` specifiers. Functions ≤ 50 lines.

Verification:
- `pnpm --filter @nest-notification-example/api exec prisma generate` — expected: succeeds, emits the client.
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0 (client types resolve).
- `pnpm --filter @nest-notification-example/api exec jest src/prisma` — expected: passes, 100% on the service file.

Completion Protocol:
1. Set 3.5 Status ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress → `5 / 6`, Last updated → today.
3. Update the P3 row Progress to `5 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 3.5 ✅ <YYYY-MM-DD> — PrismaModule + PrismaService (@prisma/adapter-pg)`.
5. Commit: `feat(api): add PrismaModule + PrismaService over @prisma/adapter-pg` (no Co-Authored-By).
````

---

### Task 3.6 — Wire `AppModule` + boot-with/without-Redis verification

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 3.2, 3.3, 3.4, 3.5

#### Description

Assemble the chassis: import `RedisModule` + `PrismaModule` into `AppModule` (the exception filter is already
`APP_FILTER`), confirm the app boots **with and without** `REDIS_URL`, and add the e2e/integration test that proves
`GET /health` → 200 and the `REDIS = null` boot path. Close the phase.

#### Acceptance criteria

- [x] `apps/api/src/app.module.ts` imports `ConfigModule` (global, validating), `HealthModule`, `RedisModule`,
      `PrismaModule`, and registers `NotificationExceptionFilter` as `APP_FILTER`. No `forRootAsync`, no domain controllers.
- [x] `apps/api/test/app.e2e-spec.ts` (supertest) boots the app and asserts `GET /health` → 200 `{ status: 'ok' }`.
- [x] An integration test proves the app boots **without** `REDIS_URL` (the `REDIS` token is `null`) and **with** a
      `REDIS_URL` set (the token is an `ioredis` client — `ioredis` mocked, no real socket).
- [x] The full local gate passes: `tsc --noEmit`, `jest` (100% coverage on the in-scope files per §2 exclusions), the
      workspace `pnpm typecheck && pnpm lint && pnpm format:check && pnpm audit:exports`.
- [x] The P3 Definition of Done in `DEVELOPMENT_PLAN.md` is observably met.

#### Files to create / modify

- `apps/api/src/app.module.ts` (final wiring)
- `apps/api/test/app.e2e-spec.ts` (or `apps/api/src/app.module.spec.ts` for the boot-branch integration test)
- `apps/api/jest.config.*` / coverage config touch-ups if needed for the in-scope set

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib),
multi-tenant. pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95. apps/api hosts the lib + a thin surface.

CURRENT PHASE: 3 (API Skeleton) — Task 3.6 of 6 (LAST)

PRECONDITIONS
- Tasks 3.1–3.5 done: main.ts + AppModule skeleton + /health (3.1); NotificationExceptionFilter as APP_FILTER (3.2);
  the `@TenantId()` decorator + ZodValidationPipe (3.3); RedisModule exporting the `REDIS` Symbol token → client|null
  (3.4); PrismaModule + PrismaService over @prisma/adapter-pg (3.5).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "9. Configuration & Environment" — the AppModule shape: ConfigModule + RedisModule + PrismaModule
  are imported so the P4 `forRootAsync({ imports: [ConfigModule, RedisModule, PrismaModule], inject: [..., REDIS, ...] })`
  resolves; the `redis ? ... : InMemoryOtpStorage` branch depends on the token being `null` (not throwing).
- docs/DEVELOPMENT_PLAN.md § "Phase 3 — API Skeleton" (DoD: `GET /health` 200; boots WITH and WITHOUT `REDIS_URL`;
  RedisModule/PrismaModule resolve; tests cover the `REDIS = null` branch) + § "2. Global Conventions" (coverage scope:
  `*.module.ts`, `main.ts`, `*.dto.ts`, `*.d.ts` excluded) + the Per-phase Completion Protocol in docs/tasks/README.md.

TASK
Wire RedisModule + PrismaModule into AppModule, add the e2e/boot tests proving `/health` 200 and the with/without-Redis
boot paths, run the full gate, and run the Per-phase Completion Protocol to close P3.

DELIVERABLES
1. `apps/api/src/app.module.ts` — the final assembly:
   ```ts
   @Module({
     imports: [
       ConfigModule.forRoot({ isGlobal: true, validate: (raw) => envSchema.parse(raw) }),
       HealthModule,
       RedisModule,
       PrismaModule,
     ],
     providers: [{ provide: APP_FILTER, useClass: NotificationExceptionFilter }],
   })
   export class AppModule {}
   ```
   (No `BymaxNotificationModule.forRootAsync` and no domain controllers — they are later phases.)
2. `apps/api/test/app.e2e-spec.ts` — supertest: bootstrap `AppModule` in a testing module, `GET /health` → 200
   `{ status: 'ok' }`. Mock `ioredis` and avoid a real Postgres connection (override `PrismaService` with a stub
   `onModuleInit`/`onApplicationShutdown` so the e2e does not require a live DB), OR document the test-stack compose
   if you choose a live integration. Keep it deterministic and memory-safe (`--maxWorkers=2`).
3. A boot-branch test (`apps/api/src/app.module.spec.ts` or within the e2e) proving:
   - with `REDIS_URL` UNSET → the `REDIS` token resolves to `null` and the module compiles/boots;
   - with `REDIS_URL` SET (ioredis mocked) → the `REDIS` token resolves to a client.
   Use `Test.createTestingModule({ imports: [AppModule] })` with an overridden env per case.
4. Coverage config touch-ups if needed so the in-scope set hits 100% (exclude the §2 non-executable glue:
   `main.ts`, `*.module.ts`, `*.d.ts`).

Constraints (follow /bymax-workflow:standards):
- TS strict, JSDoc on every export, English-only, NO suppression comments. NO notification-module wiring / domain
  controllers. Memory-safe tests: bounded workers, `ioredis` mocked, no parallel test fan-out. Timeless comments — no
  Phase/Task references in source. ESM `.js` specifiers.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest --maxWorkers=2 --coverage` — expected: all pass; 100% on the
  in-scope files (per the §2 exclusions); the `REDIS = null` branch is covered.
- `pnpm typecheck && pnpm lint && pnpm format:check && pnpm audit:exports` — expected: all exit 0.
- Boot probe: start the app WITHOUT `REDIS_URL` → `curl /health` 200; start WITH a dummy `REDIS_URL` (a mocked/local
  redis) → `curl /health` 200. Both boot cleanly.

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 3.6 Status ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Header Progress → `6 / 6`, Last updated → today.
3. Update the P3 row Progress to `6 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 3.6 ✅ <YYYY-MM-DD> — AppModule wired + boot-with/without-Redis verified`.
5. Commit: `feat(api): assemble app module + verify boot with and without redis` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, set the P3
**Status to ✅** and **Progress** `6 / 6` in docs/DEVELOPMENT_PLAN.md, advance **Active phase** to P4, recompute
**Overall progress** to `4 / 15 phases (27%)`, set this file's header **Status** to ✅, and commit `docs(plan): P3 complete`.
````

---

## Phase Completion Protocol

When **Task 3.6** is `✅` and every other task is `✅`:

1. Confirm all 6 tasks are `✅` and the P3 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P3`](../DEVELOPMENT_PLAN.md#phase-3--api-skeleton)
   is met: `GET /health` → 200; the app boots **with and without** `REDIS_URL`; the exception filter serializes a
   `NotificationException` to `{ error: { code, message, details } }` with the right HTTP status (unit-tested);
   `RedisModule`/`PrismaModule` resolve and the `REDIS = null` branch is covered.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P3 Status** to `✅`, **Progress** `6 / 6`, **Last
   updated** today; set **Active phase** to `P4`; recompute **Overall progress** to `4 / 15 phases (27%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `6 / 6 tasks`.
5. Commit `docs(plan): P3 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P3 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 3.1 ✅ 2026-06-23 — main.ts bootstrap + AppModule skeleton + /health
- 3.2 ✅ 2026-06-23 — NotificationException → HTTP exception filter
- 3.3 ✅ 2026-06-23 — tenant-id guard/decorator + zod validation pipe
- 3.4 ✅ 2026-06-23 — RedisModule (REDIS Symbol token → client or null)
- 3.5 ✅ 2026-06-23 — PrismaModule + PrismaService (@prisma/adapter-pg)
- 3.6 ✅ 2026-06-23 — AppModule wired + boot-with/without-Redis verified
