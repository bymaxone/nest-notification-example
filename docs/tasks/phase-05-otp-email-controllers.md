# Phase 5 — OTP & Email Controllers

> **Status**: 🔄 In Progress · **Progress**: 5 / 6 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P5
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

Phase 4 wired `BymaxNotificationModule.forRootAsync({ useFactory })` with real providers/storage/renderer/audit: the
custom `NodemailerEmailProvider` (→ Mailpit), the `PrismaNotificationLogRepository` (write side), the
`NotificationAuditInterceptor` registered as `APP_INTERCEPTOR`, and the `NotificationLog` schema + seed. The module
boots, `getEnabledChannels()` reports `['email','otp']`, a programmatic send renders → Mailpit → writes a masked audit
row. **There are no HTTP controllers yet** — every feature is reachable only in-process.

Phase 5 authors the **complete thin controller surface** over the three library services, so every email + OTP feature
is exercisable over HTTP and (in P8+) drivable from the console. The library ships **no controllers and no DTOs by
design** — that is this app's job. We add, all under `apps/api/src/`:

- `otp/` — `POST /otp/{generate,verify,resend,consume}` + `GET /otp/status`, with the **controller-side**
  `OtpVerifyResult → HTTP` mapping (200 / 401 / 404 / 429) and `Retry-After` on cooldown.
- `email/` — `POST /email/{send,send-template}`, including the oversize-attachment guard path (→ 413).
- `dispatch/` — `POST /dispatch` (the `NotificationService.dispatch` façade) + `GET /channels`.
- `debug/` — `GET /debug/key` (the `sha256(tenantId:recipient)` key, dev-only).

The headline correctness fact this phase proves: **`verify` never throws** for a wrong/missing/exhausted code — the
library returns a discriminated `OtpVerifyResult` and the **controller** maps it to HTTP. `not_found` → **404** (the
library deliberately makes expiry indistinguishable from "never existed", so 404 is the honest choice over 410).

Each route carries a Zod DTO (parse-in-controller, like the sibling `trigger` controller), derives the trusted
`tenantId` from the `x-tenant-id` header (never the body — the resolver is not auto-applied to these direct routes,
§13), and ships unit + e2e specs at 100%. The `/dispatch` route is the one audited by the interceptor; the direct
routes audit inside the services.

When P5 is done the full OTP lifecycle (generate → verify → resend-cooldown → max-attempts → consume → status) works
over HTTP with correct status codes and `Retry-After`; raw + template email sends return `{ messageId }`; an oversize
attachment → 413; the XSS-escape and locale-fallback behaviors are observable; and `dispatch` covers
`EMAIL_MISSING_BODY` + `CHANNEL_DISABLED`.

The gold sources are the library service signatures (`@bymax-one/nest-notification`'s `otp`/`email`/`notification`
services) and the sibling `trigger` controller + Zod-DTO pattern in `nest-logger-example` — copy the **shape**, author
the notification-domain behavior.

---

## Rules-of-phase

1. **`verify` never throws — the controller maps.** `OtpService.verify` returns a discriminated `OtpVerifyResult`
   (`{ valid: true } | { valid:false; reason:'not_found' } | { …'max_attempts' } | { …'invalid_code'; remainingAttempts }`).
   The controller maps: `valid` → **200**, `invalid_code` → **401**, `not_found` → **404**, `max_attempts` → **429**.
   Never push this mapping into the library.
2. **`not_found` → 404, documented.** The library makes an expired entry indistinguishable from a never-existing one.
   Map both to **404** (not 410); state the expiry-as-not-found choice in a JSDoc/comment on the mapping helper.
3. **Trusted tenant, never the body.** Each direct route reads the `tenantId` from the **trusted `x-tenant-id`** header
   (the P3 guard/decorator), never from the request body. Only `/dispatch` is interceptor-audited (resolver-derived).
4. **`Retry-After` only on the cooldown 429.** Only the generate/resend cooldown (`OTP_COOLDOWN_ACTIVE`, whose
   `details.retryAfter` already carries the seconds) surfaces a `Retry-After` header; CORS already exposes `Retry-After`
   (P3). The verify `max_attempts` → 429 carries **no** cooldown and therefore **no** `Retry-After`. Set the status
   without bypassing interceptors (`@Res({ passthrough: true })`, mirror the sibling `trigger` controller).
5. **Zod DTOs, parse-in-controller.** Every route has a Zod schema in a `*.dto.ts`; validate with the P3 Zod pipe or
   `schema.parse(body)` (sibling pattern). `*.dto.ts` is excluded from coverage scope (§2) — keep them schema-only.
6. **Thin controllers.** Controllers translate HTTP ↔ service calls only; no business logic. Functions ≤ 50 lines,
   files ≤ 800; SRP. The `OtpVerifyResult → HTTP` mapping lives in one small, reused helper.
7. **Never log codes / unmasked PII.** No OTP code and no unmasked recipient in any log line or response that isn't the
   intended payload. `GET /debug/key` returns only the opaque 64-hex key, never the code.
8. **Timeless, English-only deliverable code.** No `Phase N` / task / roadmap-stage references in the committed source
   (this planning file may name them; the code it produces may not). JSDoc on every export; no suppression comments.
9. **100% as written.** Each task ships unit + e2e specs covering its routes' happy + every error branch; `pnpm test:cov`
   stays at 100% for `apps/api` (excluding `*.module.ts` / `main.ts` / `*.dto.ts`).

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §10 (the endpoint table + the verify-mapping note), §11 (the four-stage pipeline:
  resolve/render/deliver/audit; trusted-tenant rule), §16 (Demonstrated Journeys 1–7, 11 — the behaviors to make
  observable).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P5 (Goal / Scope / DoD / Rules / Matrix rows 7–9, 13–16, 20–42,
  52–54, 57), §2 Global Conventions, §3 Autonomous Execution Model.
- Library service signatures (copy the shapes — do **not** reimplement): `@bymax-one/nest-notification` →
  `OtpService` (`generate`/`verify`/`resend`/`consume`/`getStatus`, `OtpGenerateInput`, `OtpVerifyResult`,
  `OtpGenerateResult`, `OtpStatusResult`), `EmailService` (`send`/`sendTemplate`, `EmailSendInput`,
  `EmailSendTemplateInput`), `NotificationService` (`dispatch`/`getEnabledChannels`, `DispatchInput`,
  `DispatchResult`), `hashTenantRecipient`, `toRetryAfterHeader`. Gold path:
  `~/Documents/MyApps/bymax-one/nest-notification/src/server/services/{otp,email,notification}.service.ts`,
  `src/server/interfaces/otp-storage.interface.ts`, `src/server/utils/{hash,cooldown-helpers}.ts`.
- Controller + Zod-DTO + status-set pattern (copy the shape): `nest-logger-example/apps/api/src/trigger/`
  (`trigger.controller.ts`, `trigger.module.ts`, `dto/trigger.dto.ts`, the `.spec.ts` files).
- `/bymax-workflow:standards` skill — universal coding rules.
- Vault: [[Example-App-Standard]], [[NestJS/Bymax-Conventions]], [[Bymax-Lib-Standards/README-Badges]].

---

## Task index

| ID  | Task                                                                        | Status  | Priority | Size | Depends on         |
| --- | --------------------------------------------------------------------------- | ------- | -------- | ---- | ------------------ |
| 5.1 | OTP DTOs + verify→HTTP mapping helper                                       | ✅ Done | P0       | M    | —                  |
| 5.2 | OTP controller — generate/verify/resend/consume/status                      | ✅ Done | P0       | L    | 5.1                |
| 5.3 | Email controller — send + send-template (+ attachment guard)                | ✅ Done | P0       | M    | —                  |
| 5.4 | Dispatch façade — `POST /dispatch` + `GET /channels` + `GET /config/status` | ✅ Done | P1       | M    | 5.3                |
| 5.5 | `GET /debug/key` (hashTenantRecipient)                                      | ✅ Done | P2       | S    | —                  |
| 5.6 | e2e suite — full OTP+email+dispatch HTTP surface                            | 📋 ToDo | P0       | L    | 5.2, 5.3, 5.4, 5.5 |

---

## Tasks

### Task 5.1 — OTP DTOs + verify→HTTP mapping helper

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Author the Zod request DTOs for the five OTP routes and the single reusable helper that maps the library's discriminated
`OtpVerifyResult` to an HTTP outcome (status + `Retry-After`), so the controller (5.2) stays thin and the mapping is
unit-tested in isolation.

#### Acceptance criteria

- [x] `apps/api/src/otp/dto/otp.dto.ts` exports Zod schemas + inferred types for generate, verify, resend, consume,
      status — each with `recipient` (email) + `purpose` (string) and route-specific fields (`code` for verify;
      `deliverVia`/`emailTemplate`/`emailData`/`locale` for generate/resend). `tenantId` is **not** in any body schema
      (it comes from the header).
- [x] `apps/api/src/otp/otp-verify-mapping.ts` exports `mapOtpVerifyResult(result): { status: number; body: unknown }`
      — `valid` → 200, `invalid_code` → 401 (body carries `remainingAttempts`), `not_found` → 404, `max_attempts` → 429
      (**no `Retry-After`** — `verify` carries no cooldown); a JSDoc states the expiry-as-not-found 404 choice.
- [x] No `tenantId` accepted from the body in any DTO; schemas reject unknown keys is **not** required, but every field
      has an explicit type/constraint.
- [x] `pnpm typecheck` exits 0; the mapping helper has a co-located `.spec.ts` proving all four branches at 100%.

#### Files to create / modify

- `apps/api/src/otp/dto/otp.dto.ts`
- `apps/api/src/otp/otp-verify-mapping.ts`, `apps/api/src/otp/otp-verify-mapping.spec.ts`

#### Agent prompt

````
You are a senior NestJS / TypeScript backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (a NestJS 11 email + OTP
notification library: multi-tenant, pluggable providers/storage, audit log). pnpm monorepo, Node 24, TypeScript 5.9
strict, 100% coverage + Stryker ≥95. apps/api hosts the library and a thin demo controller surface over its services.

CURRENT PHASE: 5 (OTP & Email Controllers) — Task 5.1 of 6 (FIRST)

PRECONDITIONS
- P4 done: BymaxNotificationModule.forRootAsync is wired; OtpService/EmailService/NotificationService resolve from DI;
  the audit interceptor + Prisma repo + Mailpit provider exist. P3 added the Zod validation pipe and an x-tenant-id
  guard/decorator. No controllers exist yet under apps/api/src/otp.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10. The Demo Domain & Notification Console" (the endpoint table + the verify-mapping paragraph).
- docs/DEVELOPMENT_PLAN.md § "Phase 5 — OTP & Email Controllers" (DoD + Rules-of-phase).
- Library types (read signatures, copy the shapes — do NOT reimplement the service):
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/services/otp.service.ts
  (OtpGenerateInput, OtpVerifyInput, OtpGenerateResult, OtpStatusResult) and
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/interfaces/otp-storage.interface.ts (OtpVerifyResult) and
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/utils/cooldown-helpers.ts (toRetryAfterHeader).
- Zod-DTO shape: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/trigger/dto/trigger.dto.ts.

TASK
Author the five OTP Zod DTOs and the reusable OtpVerifyResult→HTTP mapping helper (+ its unit spec). No controller yet.

DELIVERABLES
1. `apps/api/src/otp/dto/otp.dto.ts` — Zod schemas + inferred types. Sketch:
   ```ts
   import { z } from 'zod'
   const recipient = z.string().email()
   const purpose = z.string().min(1)
   export const otpGenerateSchema = z.object({
     recipient, purpose,
     deliverVia: z.enum(['email', 'manual']).optional(),
     emailTemplate: z.string().min(1).optional(),
     emailData: z.record(z.string(), z.unknown()).optional(),
     locale: z.string().min(2).optional(),
   })
   export type OtpGenerateDto = z.infer<typeof otpGenerateSchema>
   export const otpVerifySchema = z.object({ recipient, purpose, code: z.string().min(1) })
   export const otpResendSchema = otpGenerateSchema        // resend == generate input
   export const otpConsumeSchema = z.object({ recipient, purpose })
   export const otpStatusSchema = z.object({ recipient, purpose }) // also usable as a query schema
   // …inferred types for each…
   ```
   `tenantId` is NEVER in a body schema — the controller will read it from x-tenant-id.
2. `apps/api/src/otp/otp-verify-mapping.ts` — the pure mapping helper. Sketch:
   ```ts
   import type { OtpVerifyResult } from '@bymax-one/nest-notification'

   /**
    * Maps the library's discriminated OtpVerifyResult to an HTTP outcome.
    * `not_found` → 404: the library makes an expired entry indistinguishable from one
    * that never existed, so 404 is the honest mapping (not 410). `verify` never throws.
    * `max_attempts` → 429 with NO Retry-After: the verify result carries no cooldown value —
    * only generate/resend surface a cooldown (the thrown OTP_COOLDOWN_ACTIVE) with Retry-After.
    */
   export function mapOtpVerifyResult(result: OtpVerifyResult): {
     status: number; body: unknown
   } {
     if (result.valid) return { status: 200, body: { valid: true } }
     switch (result.reason) {
       case 'invalid_code':
         return { status: 401, body: { valid: false, reason: 'invalid_code',
           remainingAttempts: result.remainingAttempts } }
       case 'not_found':
         return { status: 404, body: { valid: false, reason: 'not_found' } }
       case 'max_attempts':
         return { status: 429, body: { valid: false, reason: 'max_attempts' } }
     }
   }
   ```
3. `apps/api/src/otp/otp-verify-mapping.spec.ts` — Jest unit spec proving all four branches (status + body shape;
   assert the `max_attempts` → 429 outcome has NO `Retry-After` / no cooldown field). Each `it()` carries a block
   comment naming the scenario + the rule it protects.

Constraints:
- Import the library types from the package root `@bymax-one/nest-notification` (the `.`/server subpath), never a deep
  path. TS strict; exactOptionalPropertyTypes-safe spreads for optional fields. JSDoc on every export. English-only,
  timeless — no Phase/task references in the code. No suppression comments. Functions ≤ 50 lines.

Verification:
- `pnpm --filter @nest-notification-example/api typecheck` (or `pnpm typecheck`) — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/otp/otp-verify-mapping.spec.ts --maxWorkers=2` —
  expected: green, 100% on otp-verify-mapping.ts (all 4 branches).

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 6` and Last updated to today.
4. Update the P5 row Progress to `1 / 6` in docs/DEVELOPMENT_PLAN.md (+ its Last updated).
5. Append to Completion log: `- 5.1 ✅ <YYYY-MM-DD> — OTP DTOs + verify→HTTP mapping helper`.
6. Commit: `feat(api): add otp dtos and verify-to-http mapping helper` (no Co-Authored-By).
````

---

### Task 5.2 — OTP controller — generate/verify/resend/consume/status

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: 5.1

#### Description

Author the OTP controller + module that exposes the full lifecycle over HTTP, deriving the trusted `tenantId` from the
header, applying the verify→HTTP mapping helper, and surfacing `Retry-After` on cooldown/max-attempts.

#### Acceptance criteria

- [x] `apps/api/src/otp/otp.controller.ts` exposes `POST /otp/{generate,verify,resend,consume}` + `GET /otp/status`,
      each parsing its DTO (5.1) and reading `tenantId` from the trusted `x-tenant-id` header (P3 decorator/guard).
- [x] `POST /otp/verify` calls `OtpService.verify`, applies `mapOtpVerifyResult`, and sets the status via
      `@Res({ passthrough: true })` (interceptors still run). The verify `max_attempts` → 429 sets **no** `Retry-After`
      (verify carries no cooldown — only generate/resend cooldown does).
- [x] `POST /otp/generate` + `/otp/resend` return `{ expiresAt, cooldownSeconds }`; an active cooldown surfaces 429 +
      `Retry-After` (the library throws `OTP_COOLDOWN_ACTIVE` → the exception filter maps it + sets the header).
- [x] `POST /otp/consume` → 204 idempotent; `GET /otp/status` returns the `OtpStatusResult` (never the code).
- [x] `apps/api/src/otp/otp.module.ts` registers the controller; it is imported by `app.module.ts`.
- [x] Unit spec (`otp.controller.spec.ts`) mocks `OtpService` and proves every route + the verify status-mapping
      branches at 100%.

#### Files to create / modify

- `apps/api/src/otp/otp.controller.ts`, `apps/api/src/otp/otp.module.ts`
- `apps/api/src/otp/otp.controller.spec.ts`
- `apps/api/src/app.module.ts` (import `OtpModule`)

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library, multi-tenant). pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95. apps/api hosts
the library + a thin Zod-validated controller surface over its services.

CURRENT PHASE: 5 (OTP & Email Controllers) — Task 5.2 of 6 (MIDDLE)

PRECONDITIONS
- Task 5.1 done: `apps/api/src/otp/dto/otp.dto.ts` (five Zod schemas) and `apps/api/src/otp/otp-verify-mapping.ts`
  (`mapOtpVerifyResult`) exist and are unit-tested.
- P3 added a trusted-tenant decorator/guard (reads x-tenant-id) and a Zod validation pipe. P4 made `OtpService`
  injectable from DI. `app.module.ts` exists.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10" (the /otp/* rows + verify-mapping note) and § "11" (Stage 1 trusted-tenant rule: the direct
  /otp/* routes derive tenantId from the trusted header, NOT the body; the resolver is not auto-applied here).
- docs/DEVELOPMENT_PLAN.md § "Phase 5" (DoD bullet 1: full lifecycle over HTTP with correct codes + Retry-After).
- Library service (signatures only): ~/Documents/MyApps/bymax-one/nest-notification/src/server/services/otp.service.ts
  (generate/verify/resend/consume/getStatus + their input/result types).
- Controller + @Res passthrough + parse-in-controller pattern:
  ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/trigger/{trigger.controller.ts,trigger.module.ts}.

TASK
Author the OTP controller + module exposing POST /otp/{generate,verify,resend,consume} + GET /otp/status, wired to
OtpService, using the 5.1 DTOs and mapping helper; register the module in app.module.ts.

DELIVERABLES
1. `apps/api/src/otp/otp.controller.ts` — `@Controller('otp')`. Sketch:
   ```ts
   @Controller('otp')
   export class OtpController {
     constructor(private readonly otp: OtpService) {}

     @Post('generate')
     generate(@TenantId() tenantId: string, @Body() body: unknown) {
       return this.otp.generate({ tenantId, ...otpGenerateSchema.parse(body) })
     }

     @Post('verify')
     async verify(
       @TenantId() tenantId: string,
       @Body() body: unknown,
       @Res({ passthrough: true }) res: Response,
     ) {
       const input = otpVerifySchema.parse(body)
       const result = await this.otp.verify({ tenantId, ...input })
       const mapped = mapOtpVerifyResult(result)
       res.status(mapped.status) // max_attempts → 429 with NO Retry-After: verify carries no cooldown
       return mapped.body
     }
     // resend (alias of generate), consume (→ 204/200, idempotent), GET status (query schema)…
   }
   ```
   - Use the P3 trusted-tenant decorator (e.g. `@TenantId()`) for tenantId — NEVER read it from the body.
   - Only generate/resend let `OTP_COOLDOWN_ACTIVE` propagate to the P3 exception filter (429); its `details.retryAfter`
     drives the Retry-After header (the filter or the CORS expose config from P3 handles exposure — confirm and wire if
     needed). The verify `max_attempts` → 429 has no cooldown, so it sets no Retry-After.
2. `apps/api/src/otp/otp.module.ts` — `@Module({ controllers: [OtpController] })` (OtpService comes from the library
   module already imported globally; import it here only if not global).
3. Import `OtpModule` in `apps/api/src/app.module.ts`.
4. `apps/api/src/otp/otp.controller.spec.ts` — Jest unit spec mocking OtpService; cover every route AND the four verify
   status branches (200/401/404/429), asserting the verify `max_attempts` → 429 sets no Retry-After, plus the
   generate/resend cooldown → 429 + Retry-After path. Each `it()` carries a scenario comment.

Constraints:
- Thin controller: HTTP↔service translation only, no business logic (the lifecycle lives in the library). Functions
  ≤ 50 lines. Import library symbols from `@bymax-one/nest-notification` root. exactOptionalPropertyTypes-safe.
- TS strict, JSDoc on every export, English-only, timeless (no Phase/task references in code), no suppression comments.

Verification:
- `pnpm --filter @nest-notification-example/api typecheck` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/otp --maxWorkers=2` — expected: green, 100% on
  otp.controller.ts (*.module.ts excluded from coverage scope).

Completion Protocol: set 5.2 ✅ (block + index), tick criteria, header Progress `2 / 6` + Last updated, update the P5
row Progress to `2 / 6` in DEVELOPMENT_PLAN.md, append `- 5.2 ✅ <date> — OTP controller (lifecycle over HTTP)`, commit
`feat(api): add otp controller for the full otp lifecycle` (no Co-Authored-By).
````

---

### Task 5.3 — Email controller — send + send-template (+ attachment guard)

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Author the email controller + module + DTOs exposing raw and template email sends over HTTP, including the
oversize-attachment path that surfaces as HTTP 413.

#### Acceptance criteria

- [x] `apps/api/src/email/dto/email.dto.ts` exports Zod schemas for send (raw: `to`/`subject`/`html` + optional
      `text`/`from`/`fromName`/`replyTo`/`cc`/`bcc`/`tags`/`attachments`) and send-template (`to`/`template`/`data` +
      optional `locale`/…). `tenantId` is **not** in either body schema.
- [x] `apps/api/src/email/email.controller.ts` exposes `POST /email/send` (→ `EmailService.send` → `{ messageId }`) and
      `POST /email/send-template` (→ `EmailService.sendTemplate` → `{ messageId }`), deriving `tenantId` from `x-tenant-id`.
- [x] An oversize attachment makes the library throw `EMAIL_ATTACHMENTS_TOO_LARGE`, which the exception filter maps
      to **413**; a unit/e2e proves the 413 path.
- [x] `apps/api/src/email/email.module.ts` registers the controller; imported by `app.module.ts`.
- [x] Unit spec mocks `EmailService` and proves both routes + the 413 path at 100%.

#### Files to create / modify

- `apps/api/src/email/dto/email.dto.ts`
- `apps/api/src/email/email.controller.ts`, `apps/api/src/email/email.module.ts`
- `apps/api/src/email/email.controller.spec.ts`
- `apps/api/src/app.module.ts` (import `EmailModule`)

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library, multi-tenant). pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95. apps/api hosts
the library + a thin Zod-validated controller surface over its services.

CURRENT PHASE: 5 (OTP & Email Controllers) — Task 5.3 of 6 (MIDDLE)

PRECONDITIONS
- P4 made `EmailService` injectable (it renders via the configured renderer, escapes the html body only, sends through
  the Nodemailer→Mailpit provider, and guards attachment size — throwing `EMAIL_ATTACHMENTS_TOO_LARGE`). P3 added the
  trusted-tenant decorator + the Zod pipe + the NotificationException→HTTP filter (which maps the attachment error to
  413). `app.module.ts` exists. (Independent of the OTP tasks.)

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10" (the /email/* rows) and § "11" Stage 2/3 (render → HTML-escape html-body-only;
  deliver → provider.send throws → EMAIL_SEND_FAILED; the attachment guard).
- docs/DEVELOPMENT_PLAN.md § "Phase 5" (DoD bullet 2: raw + template return { messageId }; oversize attachment → 413;
  XSS-escape + locale fallback proven).
- Library service (signatures only): ~/Documents/MyApps/bymax-one/nest-notification/src/server/services/email.service.ts
  (send / sendTemplate, EmailSendInput, EmailSendTemplateInput, the guardAttachmentSize behavior + maxAttachmentBytes).
- Controller + parse-in-controller pattern:
  ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/trigger/{trigger.controller.ts,dto/trigger.dto.ts}.

TASK
Author the email controller + module + DTOs exposing POST /email/send and POST /email/send-template, including the
oversize-attachment → 413 path; register the module in app.module.ts.

DELIVERABLES
1. `apps/api/src/email/dto/email.dto.ts` — Zod schemas + inferred types. Sketch:
   ```ts
   const recipients = z.union([z.string().email(), z.array(z.string().email()).min(1)])
   const attachment = z.object({ filename: z.string(), content: z.string() /* base64 */ })
   export const emailSendSchema = z.object({
     to: recipients, subject: z.string().min(1), html: z.string().min(1),
     text: z.string().optional(), from: z.string().email().optional(),
     fromName: z.string().optional(), replyTo: z.string().email().optional(),
     cc: recipients.optional(), bcc: recipients.optional(),
     tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
     attachments: z.array(attachment).optional(),
   })
   export const emailSendTemplateSchema = z.object({
     to: recipients, template: z.string().min(1), data: z.record(z.string(), z.unknown()),
     locale: z.string().min(2).optional(), from: z.string().email().optional(), /* … */
   })
   ```
   `tenantId` is NEVER in a body schema.
2. `apps/api/src/email/email.controller.ts` — `@Controller('email')` with `send` + `sendTemplate`, deriving tenantId
   from the trusted x-tenant-id decorator, parsing the DTO, returning `{ messageId }`. Let the library's
   `EMAIL_ATTACHMENTS_TOO_LARGE` propagate to the P3 filter (413).
3. `apps/api/src/email/email.module.ts` registering the controller; import it in `app.module.ts`.
4. `apps/api/src/email/email.controller.spec.ts` — mock EmailService; prove send + send-template returning { messageId }
   and the 413 (attachment-too-large) propagation. Each `it()` carries a scenario comment.

Constraints:
- Thin controller (HTTP↔service only); rendering/escaping/guarding live in the library — never duplicate them here.
  Import library symbols from `@bymax-one/nest-notification` root. Functions ≤ 50 lines, exactOptionalPropertyTypes-safe.
- TS strict, JSDoc on every export, English-only, timeless (no Phase/task references in code), no suppression comments.

Verification:
- `pnpm --filter @nest-notification-example/api typecheck` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/email --maxWorkers=2` — expected: green, 100% on
  email.controller.ts (*.module.ts / *.dto.ts excluded from coverage scope).

Completion Protocol: set 5.3 ✅ (block + index), tick criteria, header Progress `3 / 6` + Last updated, update the P5
row Progress to `3 / 6` in DEVELOPMENT_PLAN.md, append `- 5.3 ✅ <date> — email controller (send + send-template + 413)`,
commit `feat(api): add email controller for raw and template sends` (no Co-Authored-By).
````

---

### Task 5.4 — Dispatch façade — `POST /dispatch` + `GET /channels` + `GET /config/status`

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: M
- **Depends on**: 5.3

#### Description

Author the dispatch controller + module exposing the unified `NotificationService.dispatch` façade (the
interceptor-audited route), `GET /channels`, and `GET /config/status` (the resolved-module-config introspection read
from the injected `ResolvedNotificationOptions`), covering the `EMAIL_MISSING_BODY` and `CHANNEL_DISABLED` error paths.

#### Acceptance criteria

- [x] `apps/api/src/dispatch/dto/dispatch.dto.ts` exports a discriminated Zod schema mirroring the library's
      `DispatchInput` — `{ channel:'email', payload: EmailDispatchPayload }` | `{ channel:'otp', payload: OtpDispatchPayload }`
      — without `tenantId` (header-derived).
- [x] `apps/api/src/dispatch/dispatch.controller.ts` exposes `POST /dispatch` (→ `NotificationService.dispatch` →
      the discriminated `DispatchResult`), `GET /channels` (→ `getEnabledChannels()` → `['email','otp']`), and
      `GET /config/status`, deriving `tenantId` from `x-tenant-id` where needed.
- [x] `GET /config/status` returns the resolved module config read from the injected `ResolvedNotificationOptions` (via
      the `BYMAX_NOTIFICATION_OPTIONS` token) + the provider/storage/renderer token names: the enabled channels +
      provider/storage/renderer names + `consumeOnVerify` + `swallowErrors` + whether `maskRecipient` is active. It
      demonstrates Feature-Coverage-Matrix rows 31 and 59 from a real surface (no secrets in the response).
- [x] An email payload with neither template nor subject+html → the library throws `EMAIL_MISSING_BODY` → the filter
      maps it; a request to a disabled channel → `CHANNEL_DISABLED`; both error paths are proven.
- [x] `/dispatch` is the **interceptor-audited** route (the audit interceptor is already `APP_INTERCEPTOR` from P4 —
      the resolver-derived tenant is the audited tenant; do not re-implement auditing in the controller).
- [x] `apps/api/src/dispatch/dispatch.module.ts` registers the controller; imported by `app.module.ts`. Unit spec at
      100% (covering `/dispatch`, `/channels`, AND `/config/status`).

#### Files to create / modify

- `apps/api/src/dispatch/dto/dispatch.dto.ts`
- `apps/api/src/dispatch/dispatch.controller.ts`, `apps/api/src/dispatch/dispatch.module.ts`
- `apps/api/src/dispatch/dispatch.controller.spec.ts`
- `apps/api/src/app.module.ts` (import `DispatchModule`)

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library, multi-tenant). pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95. apps/api hosts
the library + a thin Zod-validated controller surface over its services.

CURRENT PHASE: 5 (OTP & Email Controllers) — Task 5.4 of 6 (MIDDLE)

PRECONDITIONS
- Task 5.3 done (email controller pattern established — reuse its DTO/controller/spec shape). P4 registered the
  NotificationAuditInterceptor as APP_INTERCEPTOR and made NotificationService injectable. P3 added the trusted-tenant
  decorator + the NotificationException→HTTP filter. `app.module.ts` exists.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10" (the /dispatch + /channels rows) and § "11" Stage 1 + § "13" (the audited /dispatch route uses
  the resolver-derived tenant as the source of truth — a body tenantId is overridden; the "Spoof tenant" demo targets
  /dispatch). § "16" journey 11 (unified dispatch: EMAIL_MISSING_BODY + CHANNEL_DISABLED, dual audit rows).
- docs/DEVELOPMENT_PLAN.md § "Phase 5" (DoD bullet 2: dispatch covers EMAIL_MISSING_BODY + CHANNEL_DISABLED) and the
  Feature-Coverage-Matrix rows 31 and 59 (the resolved-config introspection surface).
- Library service (signatures only):
  ~/Documents/MyApps/bymax-one/nest-notification/src/server/services/notification.service.ts
  (dispatch, getEnabledChannels, DispatchInput, DispatchResult, EmailDispatchPayload, OtpDispatchPayload).
- Resolved-config types + DI token (signatures only): the package root exports `ResolvedNotificationOptions` and the
  `BYMAX_NOTIFICATION_OPTIONS` injection token (`@bymax-one/nest-notification`) — inject the resolved options to read the
  enabled channels, provider/storage/renderer names, consumeOnVerify, swallowErrors, and the maskRecipient mode.
- Reuse the shape from Task 5.3's email controller (already in the repo).

TASK
Author the dispatch controller + module + a discriminated Zod DTO exposing POST /dispatch, GET /channels, and
GET /config/status; register in app.module.ts.

DELIVERABLES
1. `apps/api/src/dispatch/dto/dispatch.dto.ts` — a discriminated-union Zod schema. Sketch:
   ```ts
   const emailPayload = z.object({
     to: z.union([z.string().email(), z.array(z.string().email())]),
     template: z.string().optional(), data: z.record(z.string(), z.unknown()).optional(),
     subject: z.string().optional(), html: z.string().optional(), text: z.string().optional(),
     locale: z.string().optional(), /* …from/fromName/replyTo/tags… */
   })
   const otpPayload = z.object({
     recipient: z.string().email(), purpose: z.string().min(1),
     action: z.enum(['generate', 'verify', 'consume']).optional(),
     code: z.string().optional(), deliverVia: z.enum(['email', 'manual']).optional(), /* … */
   })
   export const dispatchSchema = z.discriminatedUnion('channel', [
     z.object({ channel: z.literal('email'), payload: emailPayload }),
     z.object({ channel: z.literal('otp'), payload: otpPayload }),
   ])
   ```
   `tenantId` is NEVER in the body — the controller adds the header-derived tenantId before calling dispatch.
2. `apps/api/src/dispatch/dispatch.controller.ts` — `@Controller()` with `@Post('dispatch')` (parse → add header
   tenantId → `notification.dispatch(input)` → return DispatchResult), `@Get('channels')`
   (→ `notification.getEnabledChannels()`), and `@Get('config/status')`. Let EMAIL_MISSING_BODY / CHANNEL_DISABLED
   propagate to the P3 filter. Sketch for the config-status route:
   ```ts
   import { BYMAX_NOTIFICATION_OPTIONS, type ResolvedNotificationOptions } from '@bymax-one/nest-notification'

   constructor(
     private readonly notification: NotificationService,
     @Inject(BYMAX_NOTIFICATION_OPTIONS) private readonly options: ResolvedNotificationOptions,
   ) {}

   @Get('config/status')
   configStatus() {
     // Read-only introspection of the resolved module config — no secrets in the response.
     return {
       channels: this.notification.getEnabledChannels(),
       provider: this.options.email.provider.constructor.name,   // shape per ResolvedNotificationOptions
       storage: this.options.otp.storage.constructor.name,
       renderer: this.options.email.renderer.constructor.name,
       consumeOnVerify: this.options.otp.consumeOnVerify,
       swallowErrors: this.options.swallowErrors,
       maskRecipient: this.options.audit.maskRecipient,
     }
   }
   ```
   (Adapt the exact field paths to the real `ResolvedNotificationOptions` shape — read it, never invent fields.)
3. `apps/api/src/dispatch/dispatch.module.ts` registering the controller; import it in `app.module.ts`.
4. `apps/api/src/dispatch/dispatch.controller.spec.ts` — mock NotificationService and provide a fake
   `BYMAX_NOTIFICATION_OPTIONS`; prove email-dispatch, otp-dispatch, channels, /config/status (the resolved-config
   shape), AND the EMAIL_MISSING_BODY + CHANNEL_DISABLED propagation. Each `it()` carries a scenario comment.

Constraints:
- Do NOT re-implement auditing in the controller — /dispatch is audited by the existing APP_INTERCEPTOR using the
  resolver tenant; the controller passes the header tenantId into the service input only. Thin controller, ≤ 50-line
  functions, import library symbols from `@bymax-one/nest-notification` root, exactOptionalPropertyTypes-safe.
- TS strict, JSDoc on every export, English-only, timeless (no Phase/task references), no suppression comments.

Verification:
- `pnpm --filter @nest-notification-example/api typecheck` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/dispatch --maxWorkers=2` — expected: green, 100% on
  dispatch.controller.ts (covering /dispatch, /channels, AND /config/status).

Completion Protocol: set 5.4 ✅ (block + index), tick criteria, header Progress `4 / 6` + Last updated, update the P5
row Progress to `4 / 6` in DEVELOPMENT_PLAN.md, append `- 5.4 ✅ <date> — dispatch façade + channels + config/status`,
commit `feat(api): add dispatch facade, channels and config-status endpoints` (no Co-Authored-By).
````

---

### Task 5.5 — `GET /debug/key` (hashTenantRecipient)

- **Status**: ✅ Done
- **Priority**: P2
- **Size**: S
- **Depends on**: —

#### Description

Author the dev-only debug controller exposing the opaque `sha256(tenantId:recipient)` storage key so the console's
Inspect-OTP panel can prove keys are hashed (never the plaintext recipient or the code).

#### Acceptance criteria

- [x] `apps/api/src/debug/debug.controller.ts` exposes `GET /debug/key?recipient=…` → `{ key }` where
      `key = hashTenantRecipient(tenantId, recipient)` (the trusted `tenantId` from `x-tenant-id`), a 64-hex string.
- [x] The response carries only the opaque key — never the code, never the plaintext recipient.
- [x] `apps/api/src/debug/dto/debug.dto.ts` (query Zod schema: `recipient` email) + `debug.module.ts`; imported by
      `app.module.ts`.
- [x] Unit spec proves the key is the 64-hex `hashTenantRecipient` output and that two tenants sharing a recipient get
      distinct keys; 100% covered.

#### Files to create / modify

- `apps/api/src/debug/debug.controller.ts`, `apps/api/src/debug/debug.module.ts`
- `apps/api/src/debug/dto/debug.dto.ts`, `apps/api/src/debug/debug.controller.spec.ts`
- `apps/api/src/app.module.ts` (import `DebugModule`)

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library, multi-tenant). pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95. apps/api hosts
the library + a thin controller surface over its services.

CURRENT PHASE: 5 (OTP & Email Controllers) — Task 5.5 of 6 (MIDDLE)

PRECONDITIONS
- P2 exported `hashTenantRecipient` from the library; P3 added the trusted-tenant decorator + Zod pipe; `app.module.ts`
  exists. (Independent of the other 5.x tasks.)

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10" (the GET /debug/key row) and § "13" (SHA-256 storage keys: keys are sha256(tenantId:recipient),
  the Inspect-OTP panel calls /debug/key to show the opaque 64-hex key; two tenants sharing a recipient never collide).
- docs/DEVELOPMENT_PLAN.md § "Phase 5" (Scope-In: GET /debug/key).
- Library helper (signature only): ~/Documents/MyApps/bymax-one/nest-notification/src/server/utils/hash.ts
  (`hashTenantRecipient(tenantId, recipient): string` — 64-hex sha256) — import it from `@bymax-one/nest-notification`.
- Controller + query-schema pattern:
  ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/trigger/trigger.controller.ts.

TASK
Author the dev-only debug controller + module + query DTO exposing GET /debug/key; register in app.module.ts.

DELIVERABLES
1. `apps/api/src/debug/dto/debug.dto.ts` — `export const debugKeySchema = z.object({ recipient: z.string().email() })`
   (+ inferred type).
2. `apps/api/src/debug/debug.controller.ts` — `@Controller('debug')`. Sketch:
   ```ts
   @Get('key')
   key(@TenantId() tenantId: string, @Query() query: unknown): { key: string } {
     const { recipient } = debugKeySchema.parse(query)
     return { key: hashTenantRecipient(tenantId, recipient) }
   }
   ```
   Return ONLY `{ key }` — never the code, never the plaintext recipient.
3. `apps/api/src/debug/debug.module.ts` registering the controller; import it in `app.module.ts`.
4. `apps/api/src/debug/debug.controller.spec.ts` — prove the key matches `hashTenantRecipient(tenantId, recipient)`
   (64-hex) and that distinct tenants → distinct keys for the same recipient. Each `it()` carries a scenario comment.

Constraints:
- Dev-only surface, but still TS strict, JSDoc on every export, ≤ 50-line functions, import from
  `@bymax-one/nest-notification` root. English-only, timeless (no Phase/task references), no suppression comments.

Verification:
- `pnpm --filter @nest-notification-example/api typecheck` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/debug --maxWorkers=2` — expected: green, 100% on
  debug.controller.ts.

Completion Protocol: set 5.5 ✅ (block + index), tick criteria, header Progress `5 / 6` + Last updated, update the P5
row Progress to `5 / 6` in DEVELOPMENT_PLAN.md, append `- 5.5 ✅ <date> — GET /debug/key (sha256 storage key)`, commit
`feat(api): add debug key endpoint for hashed storage keys` (no Co-Authored-By).
````

---

### Task 5.6 — e2e suite — full OTP+email+dispatch HTTP surface

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 5.2, 5.3, 5.4, 5.5

#### Description

Author the supertest e2e suite that drives the entire Phase 5 HTTP surface end-to-end against the in-memory OTP storage
and a mocked email transport — proving the lifecycle, the status codes, the `Retry-After` header, and the error paths —
then run the full local gate and close the phase.

#### Acceptance criteria

- [ ] `apps/api/test/otp.e2e-spec.ts` proves the OTP lifecycle over HTTP: generate → `{ expiresAt, cooldownSeconds }`;
      verify wrong code → 401 with decreasing `remainingAttempts`; the `(defaultMaxAttempts + 1)`th wrong attempt → 429
      (`max_attempts`, with NO `Retry-After` — verify carries no cooldown) where the attempt count is read from the
      configured `otp.defaultMaxAttempts` (default 5), not a magic literal; a second **generate** in the cooldown window →
      429 + `Retry-After` (the only Retry-After path); consume → idempotent; status → state without the code; verify a
      correct code → 200; expired/unknown → 404.
- [ ] `apps/api/test/email.e2e-spec.ts` proves `/email/send` + `/email/send-template` return `{ messageId }`, an oversize
      attachment → 413, an XSS-payload template escapes the html body only, and a `pt-BR` request with only `en` registered
      falls back to `en` (`TEMPLATE_NOT_FOUND` when neither exists).
- [ ] `apps/api/test/dispatch.e2e-spec.ts` proves `/dispatch` (email + otp), `/channels` → `['email','otp']`,
      `/config/status` → the resolved-config shape (enabled channels + provider/storage/renderer names + flags, no secrets),
      and the `EMAIL_MISSING_BODY` + `CHANNEL_DISABLED` error paths; `apps/api/test/debug.e2e-spec.ts` proves `/debug/key`
      returns the 64-hex key.
- [ ] The e2e app uses `InMemoryOtpStorage` + a mocked transport (no Mailpit/Resend needed); `x-tenant-id` is exercised.
- [ ] `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm audit:exports && pnpm audit:error-codes`
      all pass; `apps/api` coverage is 100% on all four metrics.

#### Files to create / modify

- `apps/api/test/otp.e2e-spec.ts`, `apps/api/test/email.e2e-spec.ts`,
  `apps/api/test/dispatch.e2e-spec.ts`, `apps/api/test/debug.e2e-spec.ts`
- `apps/api/test/test-app.factory.ts` (shared e2e bootstrap: in-memory storage + mocked transport) — if not already present

#### Agent prompt

```
You are a senior NestJS test engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library, multi-tenant). pnpm monorepo, Node 24, TS 5.9 strict, 100% coverage + Stryker ≥95. apps/api hosts
the library + a thin Zod-validated controller surface; e2e runs supertest against in-memory storage + a mocked transport.

CURRENT PHASE: 5 (OTP & Email Controllers) — Task 5.6 of 6 (LAST)

PRECONDITIONS
- Tasks 5.2–5.5 done: the OTP, email, dispatch, and debug controllers + modules are wired into app.module.ts and unit
  tested. P3/P4 provide the Zod pipe, the trusted-tenant decorator, the NotificationException→HTTP filter, the audit
  interceptor, and the forRootAsync module (with InMemoryOtpStorage available when REDIS_URL is unset).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "16. Demonstrated Journeys" (journeys 1–7 + 11 — the observable behaviors to assert) and § "10"
  (the verify status mapping: 200/401/404/429).
- docs/DEVELOPMENT_PLAN.md § "Phase 5" (the full DoD — every bullet must be observable over HTTP) and § "17 Testing
  Strategy" snippet via OVERVIEW (API e2e = Jest + supertest, InMemoryOtpStorage + mocked transport).
- The four controllers authored in 5.2–5.5 (already in apps/api/src/{otp,email,dispatch,debug}/) — read their route
  signatures only; do not re-open the phase file.
- e2e supertest shape: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/test/*.e2e-spec.ts (the
  Test.createTestingModule + supertest pattern), if present; otherwise the standard Nest supertest bootstrap.

TASK
Author the supertest e2e suite covering the entire Phase 5 HTTP surface, then run + green the full local gate and run the
Per-phase Completion Protocol.

DELIVERABLES
1. `apps/api/test/test-app.factory.ts` — a shared bootstrap that builds the Nest app with InMemoryOtpStorage + a mocked
   IEmailProvider (capturing the rendered html so XSS-escape can be asserted), exposing `x-tenant-id`. Reuse an existing
   factory if 5.2 created one.
2. `apps/api/test/otp.e2e-spec.ts` — the lifecycle: generate; wrong code → 401 + decreasing remainingAttempts; lockout
   on the `(defaultMaxAttempts + 1)`th wrong attempt → 429 max_attempts (read the attempt count from the configured
   `otp.defaultMaxAttempts`, default 5 — do not hard-code "4th"), asserting that 429 carries NO Retry-After (verify has
   no cooldown); the ONLY Retry-After path is a second **generate** inside the cooldown window → 429 + Retry-After header
   present; consume idempotent; status (no code); correct code → 200; unknown/expired → 404.
3. `apps/api/test/email.e2e-spec.ts` — send + send-template → { messageId }; oversize attachment → 413; XSS template
   escapes the html body only (subject/text raw — assert on the captured provider payload); pt-BR → en fallback;
   neither locale → TEMPLATE_NOT_FOUND.
4. `apps/api/test/dispatch.e2e-spec.ts` — /dispatch email + otp; GET /channels → ['email','otp']; GET /config/status →
   the resolved-config shape (enabled channels + provider/storage/renderer names + consumeOnVerify/swallowErrors/
   maskRecipient, no secrets); EMAIL_MISSING_BODY (no template + no subject/html) and CHANNEL_DISABLED paths.
   `apps/api/test/debug.e2e-spec.ts` — /debug/key → 64-hex.
5. Each `it()` carries a block comment naming the scenario + the rule it protects (e.g. "verify `(defaultMaxAttempts+1)`th
   wrong code → 429 max_attempts, no Retry-After — protects the atomic attempt counter from brute force").

Constraints:
- Memory-safe: run with `--maxWorkers=2` and `NODE_OPTIONS=--max-old-space-size=4096`; the maxWorkers:'50%' cap is baked
  into the Jest config already (§2). Do NOT fan out parallel test agents — run the suite once, sequentially.
- Assert HTTP status codes AND headers (Retry-After) AND body shapes. TS strict, English-only, timeless (no Phase/task
  references), no suppression comments.

Verification:
- `pnpm --filter @nest-notification-example/api exec jest --config test/jest-e2e.json --maxWorkers=2` — expected: all
  green.
- `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm audit:exports && pnpm audit:error-codes` —
  expected: all exit 0; apps/api coverage 100% on statements/branches/functions/lines.

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK: set 5.6 ✅ (block + index), tick criteria, header Progress `6 / 6` + Last updated, update the P5 row Progress
to `6 / 6` in DEVELOPMENT_PLAN.md, append `- 5.6 ✅ <date> — e2e suite for the full OTP+email+dispatch surface`, commit
`test(api): e2e suite for the otp, email, dispatch and debug surface` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, set the P5
**Status to ✅** and Progress `6 / 6` in docs/DEVELOPMENT_PLAN.md, advance **Active phase** to P6, recompute **Overall
progress** to `5 / 15 phases (33%)`, set this file's header Status to ✅, and commit `docs(plan): P5 complete`.
```

---

## Phase Completion Protocol

When **Task 5.6** is `✅` and every other task is `✅`:

1. Confirm all 6 tasks are `✅` and the P5 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P5`](../DEVELOPMENT_PLAN.md#phase-5--otp--email-controllers)
   is met: the full OTP lifecycle works over HTTP (generate → verify → resend-cooldown → max-attempts → consume →
   status) with correct status codes + `Retry-After`; raw + template sends return `{ messageId }`; oversize attachment →
   413; XSS-escape + locale-fallback proven; `dispatch` covers `EMAIL_MISSING_BODY` + `CHANNEL_DISABLED`; every endpoint
   has unit + e2e specs at 100%.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P5 Status** to `✅`, **Progress** `6 / 6`, **Last
   updated** today; set **Active phase** to `P6`; recompute **Overall progress** to `5 / 15 phases (33%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `6 / 6 tasks`.
5. Commit `docs(plan): P5 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P5 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 5.1 ✅ 2026-06-23 — OTP DTOs + verify→HTTP mapping helper
- 5.2 ✅ 2026-06-23 — OTP controller (lifecycle over HTTP)
- 5.3 ✅ 2026-06-23 — email controller (send + send-template + 413)
- 5.4 ✅ 2026-06-23 — dispatch façade + channels + config/status
- 5.5 ✅ 2026-06-23 — GET /debug/key (sha256 storage key)
