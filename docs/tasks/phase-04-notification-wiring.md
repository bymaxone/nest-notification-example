# Phase 4 — Notification Wiring & Audit Store

> **Status**: 🔄 In progress · **Progress**: 0 / 7 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P4
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

By the end of **P3** `apps/api` is a booting NestJS 11 service with `/health`, the global `NotificationException → HTTP`
exception filter, the Zod env schema (`config/`), `RedisModule` (exporting the `REDIS` token → an `ioredis` client **or
`null`** when `REDIS_URL` is unset), and `PrismaModule`/`PrismaService` (the `@prisma/adapter-pg` client). **No
notification feature is wired yet** — `app.module.ts` does not import the library, and there is no audit table.

Phase 4 is the **integration core**: it wires `BymaxNotificationModule.forRootAsync({ useFactory })` against real
adapters and persists the delivery audit log. It produces `notification/notification.config.ts` (the annotated
`useFactory` returning `BymaxNotificationModuleOptions` from the validated env), the custom
**`NodemailerEmailProvider`** (→ Mailpit, zero-cred default) with **Resend** opt-in and a **`NoOpEmailProvider`**
fallback, the template registry (`templates.ts` over `CANONICAL_EMAIL_TEMPLATES`) plus the alternate
Handlebars/MJML/React-Email renderer demos, the `NotificationLog` **Prisma schema + migration + `seed.ts`** (tenants
`acme`/`globex`), the write-side **`PrismaNotificationLogRepository`**, and the **`NotificationAuditInterceptor`**
registered as `APP_INTERCEPTOR`. When P4 is done the module boots, `getEnabledChannels()` reports `['email','otp']`, a
programmatic email send renders → lands in Mailpit → writes a **masked, never-coded** audit row to Postgres, and the
atomic OTP storage + the renderer HTML-escape behavior are unit-proven.

**Scope-out (do not build here):** the HTTP controllers (`/otp/*`, `/email/*`, `/dispatch`, `/channels`, `/debug/key`)
land in **P5**; the audit **read**-API (`/audit/{logs,stream,aggregate}`) lands in **P6**. This phase wires the module
and the **write** side of the audit log only — verified programmatically (a small bootstrap-time probe / unit test), not
over HTTP.

The gold sources are the library's own reference docs and the sibling `nest-logger-example` Prisma stack — **copy and
adapt** them rather than inventing configs.

---

## Rules-of-phase

1. **Pass DI-dependent adapters as INSTANCES.** `PrismaNotificationLogRepository` and `RedisOtpStorage` take a runtime
   dependency, so the `useFactory` must hand the module a ready **instance** (`new …(prisma)` / `new …({ redisClient })`).
   The async **class** form is only valid for a zero-arg-constructor adapter (e.g. `NoOpEmailProvider`,
   `InMemoryOtpStorage`).
2. **`useFactory` params must be annotated.** The factory is typed `(...args: never[]) => …`; every injected parameter
   (`ConfigService`, `Redis | null`, `PrismaService`) must carry an explicit type, in the same order as `inject`.
3. **Audit `swallowErrors: true` by default** — an audit-sink failure must never crash the delivery path.
4. **Never log OTP codes; mask the recipient.** A generated code must never reach `NotificationLogEntry`, a logger line,
   or `errorMessage` (message-only, never a stack trace). `audit.maskRecipient` minimizes the recipient (`jane@acme.com`
   → `j***@acme.com`) before the row is persisted, gated by `AUDIT_MASK_RECIPIENT`.
5. **The library never imports Prisma.** All persistence flows through the `INotificationLogRepository` interface
   implemented here; the schema/migration/repository are **consumer code** in `apps/api`.
6. **Redis-or-null branch.** `otp.storage` is `redis ? new RedisOtpStorage({ redisClient: redis }) : new InMemoryOtpStorage()`
   — the branch depends on the `REDIS` token resolving to **`null`** (not throwing) when `REDIS_URL` is unset.
7. **`redisNamespace: 'notification'`** — isolated from `nest-auth`'s `'auth'` namespace so a shared Redis never
   collides (OVERVIEW §14).
8. **Timeless, English-only deliverable code.** Source/config you write carries **no** `Phase N` / `Task` / roadmap-stage
   references (this planning doc may name them freely; the code it asks you to write may not). JSDoc on every export; TS
   strict; zero `any`; zero suppression comments (`@ts-ignore`, `eslint-disable`).

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §9 (the canonical wiring snippet + env table), §11 (the 4-stage delivery pipeline),
  §12 (Channels & Providers showcase), §13 (Multi-Tenant Security & masking), §15 (Audit Log & Delivery Tracking — the
  two-source model + the `NotificationLog` store).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P4, §2 Global Conventions, §3 Autonomous Execution Model.
- Library gold sources (`~/Documents/MyApps/bymax-one/nest-notification/`): `README.md` (Configuration table, Bring-Your-Own-Provider, Templates, the interceptor wiring), `docs/technical_specification.md` §5 (the `IEmail*` / `IOtpStorage` contracts) + §17 (audit flow), `docs/schemas/{notification-log.prisma, prisma-repository.example.md}` (the audit model + the repository), `docs/templates/{handlebars,mjml,react-email}-renderer.example.md` (the alternate renderers).
- Sibling Prisma stack (`~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/`): `prisma/{schema.prisma,seed.ts,tsconfig.json}` + `prisma/migrations/*` (the `@prisma/adapter-pg` migration/seed pattern), `src/prisma/{prisma.module.ts,prisma.service.ts}` (the global `PrismaService` shape).
- `/bymax-workflow:standards` skill — universal coding rules.
- Vault: [[Example-App-Standard]], [[NestJS/Bymax-Conventions]], [[Prisma/Patterns]].

---

## Task index

| ID  | Task                                                                  | Status  | Priority | Size | Depends on    |
| --- | --------------------------------------------------------------------- | ------- | -------- | ---- | ------------- |
| 4.1 | `NotificationLog` Prisma schema + migration + seed                    | 📋 ToDo | P0       | M    | —             |
| 4.2 | `PrismaNotificationLogRepository` (write side)                        | 📋 ToDo | P0       | S    | 4.1           |
| 4.3 | Email providers — Nodemailer→Mailpit + Resend + NoOp resolver         | 📋 ToDo | P0       | M    | —             |
| 4.4 | Template registry + alternate renderers (Handlebars/MJML/React Email) | 📋 ToDo | P1       | M    | —             |
| 4.5 | `notification.config.ts` — the `forRootAsync` useFactory              | 📋 ToDo | P0       | M    | 4.2, 4.3, 4.4 |
| 4.6 | `NotificationAuditInterceptor` as `APP_INTERCEPTOR` + module assembly | 📋 ToDo | P0       | M    | 4.5           |
| 4.7 | Boot probe — end-to-end send → Mailpit → masked audit row             | 📋 ToDo | P0       | M    | 4.6           |

---

## Tasks

### Task 4.1 — `NotificationLog` Prisma schema + migration + seed

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Add the `NotificationLog` audit model (plus the demo `Tenant` rows) to `apps/api`'s Prisma schema, generate the
migration, and write an idempotent `seed.ts` that creates the `acme` / `globex` demo tenants.

#### Acceptance criteria

- [ ] `apps/api/prisma/schema.prisma` declares `model NotificationLog` mirroring the library's `NotificationLogEntry`
      (`id`, `timestamp`, `tenantId`, `channel`, `verb`, `recipient`, `purpose?`, `providerName`, `messageId?`,
      `errorMessage? @db.Text`, `userId?`, `metadata? Json`) mapped to `notification_logs`, with the three indexes
      (`[tenantId, timestamp(Desc)]`, `[tenantId, channel, verb]`, `[userId, timestamp(Desc)]`), and a `model Tenant`
      (`id`, `name`, `createdAt`).
- [ ] `apps/api/prisma/migrations/<ts>_init/migration.sql` creates both tables + indexes; `migration_lock.toml` present.
- [ ] `apps/api/prisma/seed.ts` is idempotent (upsert), creates tenants `acme` + `globex`, redacts the DB URL on error,
      and uses the `@prisma/adapter-pg` connection pattern.
- [ ] `prisma generate` succeeds; `prisma migrate deploy` (or `dev`) against the local Postgres creates `notification_logs`.

#### Files to create / modify

- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<ts>_init/migration.sql`,
  `apps/api/prisma/migrations/migration_lock.toml`, `apps/api/prisma/seed.ts`
- `apps/api/package.json` (wire the `prisma` `seed` script if not already present)

#### Agent prompt

````
You are a senior NestJS/Prisma data-layer engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email+OTP
notification lib: multi-tenant, pluggable providers/storage, delivery audit log). pnpm monorepo, Node 24, TypeScript 5.9
strict; apps/api (NestJS 11) hosts the library + a demo controller surface; the audit log persists to Postgres via Prisma.

CURRENT PHASE: 4 (Notification Wiring & Audit Store) — Task 4.1 of 7 (FIRST)

PRECONDITIONS
- P3 done: apps/api boots (NestJS 11), has PrismaModule + PrismaService (@prisma/adapter-pg client), the Zod env schema
  (DATABASE_URL validated), and a docker-compose Postgres on :5432 (db `notification_example`).

REQUIRED READING (only these — do not load more):
- ~/Documents/MyApps/bymax-one/nest-notification/docs/schemas/notification-log.prisma — the EXACT audit model + indexes
  + the field→NotificationLogEntry mapping (copy this model verbatim, adapting only the file's own header comment to be
  timeless and app-specific).
- ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/prisma/{schema.prisma, seed.ts, tsconfig.json} +
  prisma/migrations/* — the @prisma/adapter-pg datasource block, the migration layout (migration_lock.toml + a dated
  init migration), and the idempotent seed pattern (URL redaction on error, prisma.$disconnect in finally).
- docs/OVERVIEW.md § "5. Repository Layout" (apps/api/prisma tree) + § "15. Audit Log & Delivery Tracking" (why the
  table is indexed for keyset pagination + tenant/channel/verb filtering).

TASK
Add the NotificationLog audit model + a demo Tenant model to apps/api's Prisma schema, generate the init migration, and
write an idempotent seed that creates the acme + globex demo tenants.

DELIVERABLES
1. `apps/api/prisma/schema.prisma` — generator + a Prisma 7 `@prisma/adapter-pg` datasource (no `url` in the schema; the
   adapter passes the connection string), then:
   ```prisma
   model NotificationLog {
     id           String   @id @default(uuid())
     timestamp    DateTime @default(now())
     tenantId     String
     channel      String
     verb         String
     recipient    String
     purpose      String?
     providerName String
     messageId    String?
     errorMessage String?  @db.Text
     userId       String?
     metadata     Json?
     @@index([tenantId, timestamp(sort: Desc)])
     @@index([tenantId, channel, verb])
     @@index([userId, timestamp(sort: Desc)])
     @@map("notification_logs")
   }
   model Tenant {
     id        String   @id            // 'acme' | 'globex'
     name      String
     createdAt DateTime @default(now())
     @@map("tenants")
   }
   ```
2. `apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_init/migration.sql` — CREATE TABLE for both + the three indexes;
   `apps/api/prisma/migrations/migration_lock.toml` (`provider = "postgresql"`).
3. `apps/api/prisma/seed.ts` — idempotent (`tenant.upsert` for acme + globex), `@prisma/adapter-pg` connection, redacts
   the DB URL from any thrown error before logging, sets `process.exitCode = 1` on failure, `$disconnect` in `.finally`.
4. `apps/api/package.json` — a `"prisma": { "seed": "tsx prisma/seed.ts" }` block (or equivalent) if not already wired.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every exported symbol, English-only, no suppression comments.
- The schema/migration/seed are CONSUMER code — the library never imports Prisma. Timeless comments only (no Phase/Task
  references in the committed files). Do NOT add a `code` column or anything that would invite logging OTP codes.

Verification:
- `pnpm --filter @nest-notification-example/api exec prisma generate` — expected: exit 0, client generated.
- `pnpm --filter @nest-notification-example/api exec prisma migrate deploy` (Postgres up via `pnpm infra:up`) — expected: applies the init
  migration; `psql $DATABASE_URL -c '\d notification_logs'` lists the columns + 3 indexes.
- `pnpm --filter @nest-notification-example/api exec tsx prisma/seed.ts` — expected: exit 0; re-running it does not error (idempotent).

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 7` and Last updated to today.
4. Update the P4 row Progress to `1 / 7` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 4.1 ✅ <YYYY-MM-DD> — NotificationLog schema + migration + seed`.
6. Commit: `feat(api): add NotificationLog audit schema, migration and seed` (no Co-Authored-By).
````

---

### Task 4.2 — `PrismaNotificationLogRepository` (write side)

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 4.1

#### Description

Implement the write-side `INotificationLogRepository` over `PrismaService` so the library can persist a masked audit row
through the interface, with a unit spec proving the `NotificationLogEntry → row` mapping.

#### Acceptance criteria

- [ ] `apps/api/src/notification/providers/prisma-notification-log.repository.ts` implements
      `INotificationLogRepository` (`readonly name = 'prisma'`, `async create(entry): Promise<void>`), injects
      `PrismaService`, and maps every `NotificationLogEntry` field to a `notificationLog.create` row (nullables → `null`,
      `metadata` → `undefined` when absent, `timestamp` → `new Date(entry.timestamp)`).
- [ ] No OTP code, no stack trace, and no unmasked-PII column is written (the entry arrives already masked).
- [ ] A unit spec asserts the field mapping (with a mocked `PrismaService`) at 100% coverage and that
      `JSON.stringify(row)` never contains a sample code.
- [ ] `tsc --noEmit` exits 0; the repository is exported for the config to import.

#### Files to create / modify

- `apps/api/src/notification/providers/prisma-notification-log.repository.ts`
- `apps/api/src/notification/providers/prisma-notification-log.repository.spec.ts`

#### Agent prompt

````
You are a senior NestJS data-layer engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email+OTP lib).
apps/api persists the delivery audit log to Postgres by implementing the library's INotificationLogRepository interface
over Prisma — the library never imports Prisma.

CURRENT PHASE: 4 (Notification Wiring & Audit Store) — Task 4.2 of 7 (MIDDLE)

PRECONDITIONS
- Task 4.1 done: `apps/api/prisma/schema.prisma` has `model NotificationLog`; the Prisma client is generated;
  `notification_logs` exists. PrismaService (from PrismaModule) is injectable.

REQUIRED READING (only these — do not load more):
- ~/Documents/MyApps/bymax-one/nest-notification/docs/schemas/prisma-repository.example.md — the EXACT repository shape
  (the `create` body, the `?? null` / `?? undefined` mapping, the security notes). Adapt it: import `PrismaService`
  from `../../prisma/prisma.service.js`, keep `readonly name = 'prisma'`.
- docs/OVERVIEW.md § "11. The Notification Delivery Pipeline (Deep Dive)" Stage 4 (fire-and-forget, masked, never the
  code) + § "13. Multi-Tenant Security" (recipient masking + the never-log-codes invariant).

TASK
Implement the write-side INotificationLogRepository over PrismaService and unit-prove the entry→row mapping.

DELIVERABLES
1. `apps/api/src/notification/providers/prisma-notification-log.repository.ts`:
   ```typescript
   import { Injectable } from '@nestjs/common'
   import type { INotificationLogRepository, NotificationLogEntry } from '@bymax-one/nest-notification'
   import { PrismaService } from '../../prisma/prisma.service.js'

   /** Persists notification audit entries with Prisma. Called fire-and-forget (gated by `audit.swallowErrors`). */
   @Injectable()
   export class PrismaNotificationLogRepository implements INotificationLogRepository {
     readonly name = 'prisma'
     constructor(private readonly prisma: PrismaService) {}
     async create(entry: NotificationLogEntry): Promise<void> {
       await this.prisma.notificationLog.create({
         data: {
           timestamp: new Date(entry.timestamp),
           tenantId: entry.tenantId, channel: entry.channel, verb: entry.verb,
           recipient: entry.recipient,                 // already masked when a masker is configured
           purpose: entry.purpose ?? null,
           providerName: entry.providerName,
           messageId: entry.messageId ?? null,
           errorMessage: entry.errorMessage ?? null,   // message-only — never a stack trace
           userId: entry.userId ?? null,
           metadata: entry.metadata ?? undefined,
         },
       })
     }
   }
   ```
2. `…/prisma-notification-log.repository.spec.ts` — a Jest unit spec with a mocked PrismaService that asserts (a) every
   field maps correctly, (b) absent optionals become null / undefined, (c) `JSON.stringify` of the persisted `data`
   never contains a sample 6-digit code. 100% coverage of the repository file.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on the class + `create`, English-only, no suppression comments.
- Use the exact import-specifier extension your project uses (`.js` for NodeNext/Bundler ESM). Timeless comments only.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest prisma-notification-log.repository.spec --coverage` — expected: passing, 100% on the
  repository file.

Completion Protocol: set 4.2 ✅ (block + index), tick criteria, header Progress `2 / 7` + Last updated, update the P4
row Progress to `2 / 7` in docs/DEVELOPMENT_PLAN.md, append `- 4.2 ✅ <date> — PrismaNotificationLogRepository (write side)`,
commit `feat(api): implement Prisma notification-log repository` (no Co-Authored-By).
````

---

### Task 4.3 — Email providers — Nodemailer→Mailpit + Resend + NoOp resolver

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Author the custom `NodemailerEmailProvider` (the headline bring-your-own-provider, → Mailpit on `:1025`) and a
`resolveEmailProvider(config)` resolver that returns Resend (when `RESEND_API_KEY` is set), else Nodemailer (when
`SMTP_URL` is set), else the bundled `NoOpEmailProvider`.

#### Acceptance criteria

- [ ] `apps/api/src/notification/providers/nodemailer-email.provider.ts` implements `IEmailProvider`
      (`readonly name = 'nodemailer'`, `isConfigured()`, `async send(options): Promise<EmailSendResult>`) over a nodemailer
      SMTP transport built from `SMTP_URL`; throws on transport failure (so `EmailService` maps it to `EMAIL_SEND_FAILED`);
      returns `{ messageId }`.
- [ ] `apps/api/src/notification/providers/email-provider.resolver.ts` exports `resolveEmailProvider(config)` →
      `ResendEmailProvider` if `RESEND_API_KEY`, else `NodemailerEmailProvider` if `SMTP_URL`, else `new NoOpEmailProvider()`.
- [ ] Unit specs (mocked transport / mocked Resend) prove: Nodemailer `send` returns the transport `messageId` and
      rethrows on failure; the resolver picks the right provider for each env permutation. 100% coverage of both files.
- [ ] `nodemailer` is added to `apps/api` deps; `tsc --noEmit` exits 0.

#### Files to create / modify

- `apps/api/src/notification/providers/nodemailer-email.provider.ts` (+ `.spec.ts`)
- `apps/api/src/notification/providers/email-provider.resolver.ts` (+ `.spec.ts`)
- `apps/api/package.json` (add `nodemailer` + `@types/nodemailer`)

#### Agent prompt

````
You are a senior NestJS integrations engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email+OTP lib).
Every external boundary is an interface; the example wires a real adapter for each. The headline lesson is a custom
Nodemailer email provider that makes the demo's emails actually appear in a browsable Mailpit inbox (zero credentials).

CURRENT PHASE: 4 (Notification Wiring & Audit Store) — Task 4.3 of 7 (MIDDLE)

PRECONDITIONS
- P3 done: apps/api boots; the Zod env schema validates SMTP_URL (default smtp://localhost:1025), RESEND_API_KEY
  (optional), MAIL_FROM. docker-compose runs Mailpit on :1025 (SMTP) / :8025 (UI).

REQUIRED READING (only these — do not load more):
- ~/Documents/MyApps/bymax-one/nest-notification/README.md "Bring Your Own Provider" + "Channels/Providers" sections —
  the IEmailProvider contract (`name`, `isConfigured()`, `async send(options): Promise<EmailSendResult>`; throw on
  failure → EmailService maps to EMAIL_SEND_FAILED) and that ResendEmailProvider / NoOpEmailProvider are bundled exports.
- ~/Documents/MyApps/bymax-one/nest-notification/docs/technical_specification.md § 5 (the EmailSendOptions /
  EmailSendResult types — read ONLY the IEmailProvider subsection).
- docs/OVERVIEW.md § "12. Channels & Providers Showcase" (the ~30-line custom Nodemailer lesson; Resend opt-in;
  NoOp fallback) + § "9. Configuration & Environment" (RESEND_API_KEY/SMTP_URL/MAIL_FROM semantics).
- Re-verify the current nodemailer createTransport API via context7 (`mcp__context7__resolve-library-id` → query-docs)
  — do not write the transport call from memory.

TASK
Author the custom NodemailerEmailProvider (→ Mailpit) and a resolveEmailProvider(config) that chooses Resend → Nodemailer
→ NoOp from the env.

DELIVERABLES
1. `apps/api/src/notification/providers/nodemailer-email.provider.ts`:
   ```typescript
   import type { IEmailProvider, EmailSendOptions, EmailSendResult } from '@bymax-one/nest-notification'
   import { createTransport, type Transporter } from 'nodemailer'

   /** Custom IEmailProvider that delivers via SMTP (Mailpit in dev) — the bring-your-own-provider reference. */
   export class NodemailerEmailProvider implements IEmailProvider {
     readonly name = 'nodemailer'
     private readonly transport: Transporter
     constructor(smtpUrl: string) { this.transport = createTransport(smtpUrl) }
     isConfigured(): boolean { return Boolean(this.transport) }
     async send(options: EmailSendOptions): Promise<EmailSendResult> {
       const info = await this.transport.sendMail({
         from: options.from, to: options.to, subject: options.subject,
         html: options.html, text: options.text, attachments: options.attachments,
       })
       return { messageId: info.messageId }   // throws propagate → EmailService maps to EMAIL_SEND_FAILED
     }
   }
   ```
   (Match the real EmailSendOptions field names from the spec; adjust `attachments` mapping if the shapes differ.)
2. `apps/api/src/notification/providers/email-provider.resolver.ts`:
   ```typescript
   import { ResendEmailProvider, NoOpEmailProvider, type IEmailProvider } from '@bymax-one/nest-notification'
   import type { ConfigService } from '@nestjs/config'
   import { NodemailerEmailProvider } from './nodemailer-email.provider.js'

   /** Picks the email provider from the validated env: Resend (opt-in) → Nodemailer→Mailpit → NoOp fallback. */
   export function resolveEmailProvider(config: ConfigService): IEmailProvider {
     const resendKey = config.get<string>('RESEND_API_KEY')
     if (resendKey) return new ResendEmailProvider({ apiKey: resendKey })
     const smtpUrl = config.get<string>('SMTP_URL')
     if (smtpUrl) return new NodemailerEmailProvider(smtpUrl)
     return new NoOpEmailProvider()
   }
   ```
3. Unit specs for both (mocked `nodemailer.createTransport` returning a fake `sendMail`; resolver tested across the
   three env permutations). 100% coverage of both files.
4. Add `nodemailer` + `@types/nodemailer` to apps/api deps; run `pnpm install --no-frozen-lockfile`, commit the lockfile.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every export, English-only, no suppression comments. Timeless
  comments only. Never log message bodies or codes. `.js` import specifiers for ESM.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest email-provider --coverage` — expected: passing, 100% on both files.

Completion Protocol: set 4.3 ✅ (block + index), tick criteria, header Progress `3 / 7` + Last updated, update the P4
row Progress to `3 / 7` in docs/DEVELOPMENT_PLAN.md, append `- 4.3 ✅ <date> — email providers + resolver`, commit
`feat(api): add Nodemailer→Mailpit provider + email provider resolver` (no Co-Authored-By).
````

---

### Task 4.4 — Template registry + alternate renderers (Handlebars/MJML/React Email)

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: M
- **Depends on**: —

#### Description

Build the template registry (`templates.ts`) keyed on `CANONICAL_EMAIL_TEMPLATES`, plus the alternate
Handlebars / MJML / React-Email `IEmailTemplateRenderer` demos, proving the default renderer HTML-escapes the html body
only (subject/text raw).

#### Acceptance criteria

- [ ] `apps/api/src/notification/templates.ts` exports `TEMPLATES` — at least `otp_code`, `otp_password_reset`,
      `welcome` (each `subject` + `html` + `text`), registered per `name::locale` with an `en` fallback, referencing the
      `CANONICAL_EMAIL_TEMPLATES` names so providers/templates agree on the wire.
- [ ] `apps/api/src/notification/renderers/{handlebars,mjml,react-email}.renderer.ts` each implement
      `IEmailTemplateRenderer` (adapted from the library's `docs/templates/*.example.md`), exported for the providers panel
      to showcase in a later phase.
- [ ] A unit spec proves the **default** renderer (`new DefaultTemplateRenderer({ templates: TEMPLATES })`)
      HTML-escapes an injected `<script>` in the **html** body but leaves subject + text raw, and falls back to `en`.
- [ ] `handlebars`, `mjml`, `@react-email/*` added as apps/api deps; `tsc --noEmit` exits 0.

#### Files to create / modify

- `apps/api/src/notification/templates.ts` (+ `templates.spec.ts`)
- `apps/api/src/notification/renderers/handlebars.renderer.ts`,
  `apps/api/src/notification/renderers/mjml.renderer.ts`,
  `apps/api/src/notification/renderers/react-email.renderer.ts` (+ a shared `renderers.spec.ts`)
- `apps/api/package.json` (add `handlebars`, `mjml`, `@react-email/*`)

#### Agent prompt

```
You are a senior NestJS templating engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email+OTP lib).
Email rendering goes through the IEmailTemplateRenderer interface; the example registers a canonical template set and
showcases three alternate engines (Handlebars / MJML / React Email) alongside the bundled DefaultTemplateRenderer.

CURRENT PHASE: 4 (Notification Wiring & Audit Store) — Task 4.4 of 7 (MIDDLE)

PRECONDITIONS
- P3 done: apps/api boots; the library is linked (`file:../../../nest-notification`) and its `.` server exports resolve.

REQUIRED READING (only these — do not load more):
- ~/Documents/MyApps/bymax-one/nest-notification/README.md "Templates" section — DefaultTemplateRenderer does
  `{{var}}` interpolation with automatic HTML escaping in the HTML body only (subject/text raw), registers per
  `name::locale`, falls back to `en`; `CANONICAL_EMAIL_TEMPLATES` exports the stable names (otp_code,
  otp_password_reset, welcome, password_reset_success, …).
- ~/Documents/MyApps/bymax-one/nest-notification/docs/technical_specification.md § 5.5 `IEmailTemplateRenderer` (the
  render contract: read ONLY that subsection) + § 9 (template resolution + the en fallback + security-in-templates).
- ~/Documents/MyApps/bymax-one/nest-notification/docs/templates/{handlebars-renderer.example.md,
  mjml-renderer.example.md, react-email-renderer.example.md} — copy & adapt each into a concrete renderer class.
- docs/OVERVIEW.md § "12. Channels & Providers Showcase" (the Default + Handlebars/MJML/React-Email demo set) + § "11"
  Stage-2 Render (HTML-escapes the html body only — the stored-XSS lesson).
- Re-verify handlebars / mjml / @react-email render APIs via context7 — do not write them from memory.

TASK
Author the template registry (CANONICAL_EMAIL_TEMPLATES-keyed) + the three alternate renderer demos, and unit-prove the
default renderer's html-only HTML-escape + en fallback.

DELIVERABLES
1. `apps/api/src/notification/templates.ts` — export `TEMPLATES`, a registry keyed by `name::locale` (at least
   `otp_code`, `otp_password_reset`, `welcome`, each `{ subject, html, text }` with `{{var}}` placeholders; provide an
   `en` entry per template). Reference the `CANONICAL_EMAIL_TEMPLATES` names so the wire names stay stable.
2. `apps/api/src/notification/renderers/handlebars.renderer.ts`, `mjml.renderer.ts`, `react-email.renderer.ts` — each a
   class implementing `IEmailTemplateRenderer` (adapted from the matching docs/templates/*.example.md). Export each.
3. `templates.spec.ts` — assert a `<script>alert(1)</script>` interpolated value is escaped in the rendered **html**
   body but raw in the rendered **subject** and **text**, and that a `pt`-locale request falls back to the `en` template.
   Use `new DefaultTemplateRenderer({ templates: TEMPLATES })` from the library. 100% coverage of templates.ts +
   the renderer files.
4. Add `handlebars`, `mjml`, the needed `@react-email/*` packages to apps/api deps; install + commit the lockfile.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every export, English-only, no suppression comments. Timeless
  comments only. Never put a literal OTP code in a template default; `{{code}}` is a placeholder filled at render time.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest templates renderers --coverage` — expected: passing; escape + fallback assertions green;
  100% on the new files.

Completion Protocol: set 4.4 ✅ (block + index), tick criteria, header Progress `4 / 7` + Last updated, update the P4
row Progress to `4 / 7` in docs/DEVELOPMENT_PLAN.md, append `- 4.4 ✅ <date> — template registry + alternate renderers`,
commit `feat(api): add template registry + handlebars/mjml/react-email renderers` (no Co-Authored-By).
```

---

### Task 4.5 — `notification.config.ts` — the `forRootAsync` useFactory

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 4.2, 4.3, 4.4

#### Description

Author the single source of truth for how the library is configured: `notification.config.ts` — the annotated
`useFactory` that builds `BymaxNotificationModuleOptions` from the validated env, wiring the providers, storage,
renderer, and audit repository (all DI-dependent adapters passed as **instances**).

#### Acceptance criteria

- [ ] `apps/api/src/notification/notification.config.ts` exports a factory
      `(config: ConfigService, redis: Redis | null, prisma: PrismaService) => BymaxNotificationModuleOptions` with the
      parameters **annotated** in `inject` order (`[ConfigService, REDIS, PrismaService]`).
- [ ] `global` sets `redisNamespace: 'notification'`, `defaultLocale` from env, and a `tenantIdResolver` whose param is
      annotated `(req: NotificationRequest)` (imported from `@bymax-one/nest-notification`; an untyped `(req)` fails
      `noImplicitAny`) that reads the **trusted** `x-tenant-id` header (array-safe), never the body.
- [ ] `email` uses `resolveEmailProvider(config)`, `defaultFrom`/`defaultFromName` from env,
      `templateRenderer: new DefaultTemplateRenderer({ templates: TEMPLATES })`, `maxAttachmentBytes: 10 * 1024 * 1024`.
- [ ] `otp` uses `redis ? new RedisOtpStorage({ redisClient: redis }) : new InMemoryOtpStorage()`, `defaultLength: 6`,
      TTL + cooldown from env, and the `perPurpose` overrides (`password_reset`, `email_verification`).
- [ ] `audit` uses `new PrismaNotificationLogRepository(prisma)` (an **instance**), `swallowErrors: true`, and
      `maskRecipient` derived from `AUDIT_MASK_RECIPIENT` (the `j***@acme.com` masker, or identity when disabled).
- [ ] A unit spec proves: REDIS null → `InMemoryOtpStorage`; REDIS present → `RedisOtpStorage`; `AUDIT_MASK_RECIPIENT`
      toggles the masker; the resolver returns the header tenant and `'default'` when absent. 100% coverage of the file.

#### Files to create / modify

- `apps/api/src/notification/notification.config.ts` (+ `notification.config.spec.ts`)

#### Agent prompt

````
You are a senior NestJS configuration engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email+OTP lib:
multi-tenant, pluggable providers/storage/renderer/audit). The single source of truth for how the library is configured
is apps/api/src/notification/notification.config.ts — the useFactory wired into BymaxNotificationModule.forRootAsync.

CURRENT PHASE: 4 (Notification Wiring & Audit Store) — Task 4.5 of 7 (MIDDLE)

PRECONDITIONS
- Tasks 4.2/4.3/4.4 done: PrismaNotificationLogRepository, resolveEmailProvider + NodemailerEmailProvider, TEMPLATES +
  renderers all exist and export cleanly. P3 provided the REDIS token (→ ioredis client | null), PrismaService, and the
  Zod-validated ConfigService.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "9. Configuration & Environment" — THE canonical wiring snippet (copy its shape exactly: the
  annotated useFactory, redisNamespace 'notification', the array-safe tenantIdResolver, resolveEmailProvider, the
  redis?…:InMemory branch, perPurpose, the audit instance + swallowErrors + maskRecipient) + the env table (which var
  drives which option).
- ~/Documents/MyApps/bymax-one/nest-notification/README.md "Configuration" table — option names, defaults, required vs
  optional, and that DI-dependent adapters are passed as INSTANCES while zero-arg adapters may be passed as classes.
- docs/DEVELOPMENT_PLAN.md § "Phase 4" Rules-of-phase (instances, swallowErrors default true, never log codes,
  redisNamespace isolation).

TASK
Author the annotated forRootAsync useFactory that builds BymaxNotificationModuleOptions from the validated env.

DELIVERABLES
1. `apps/api/src/notification/notification.config.ts`. The REDIS token Symbol is imported from
   `../redis/redis.module.js`. Shape (annotate every param; instances for DI-dependent adapters):
   ```typescript
   import type { ConfigService } from '@nestjs/config'
   import type { Redis } from 'ioredis'
   import {
     DefaultTemplateRenderer, RedisOtpStorage, InMemoryOtpStorage,
     type BymaxNotificationModuleOptions, type NotificationRequest,
   } from '@bymax-one/nest-notification'
   import { PrismaService } from '../prisma/prisma.service.js'
   import { resolveEmailProvider } from './providers/email-provider.resolver.js'
   import { PrismaNotificationLogRepository } from './providers/prisma-notification-log.repository.js'
   import { TEMPLATES } from './templates.js'

   /** Masks `jane@acme.com` → `j***@acme.com` for audit persistence. */
   const mask = (r: string): string => r.replace(/^(.).*(@.*)$/, '$1***$2')

   /** Builds the library options from the validated env. Params are annotated (useFactory is typed `never[]`). */
   export function notificationConfig(
     config: ConfigService, redis: Redis | null, prisma: PrismaService,
   ): BymaxNotificationModuleOptions {
     const shouldMask = config.get<string>('AUDIT_MASK_RECIPIENT') !== 'false'
     return {
       global: {
         redisNamespace: 'notification',
         defaultLocale: config.get('DEFAULT_LOCALE', 'en'),
         tenantIdResolver: (req: NotificationRequest) => {
           const h = req.headers['x-tenant-id']
           return Array.isArray(h) ? (h[0] ?? 'default') : (h ?? 'default')
         },
       },
       email: {
         provider: resolveEmailProvider(config),
         defaultFrom: config.getOrThrow('MAIL_FROM'),
         defaultFromName: config.get('MAIL_FROM_NAME'),
         templateRenderer: new DefaultTemplateRenderer({ templates: TEMPLATES }),
         maxAttachmentBytes: 10 * 1024 * 1024,
       },
       otp: {
         storage: redis ? new RedisOtpStorage({ redisClient: redis }) : new InMemoryOtpStorage(),
         defaultLength: 6,
         defaultTtlSeconds: config.get('OTP_DEFAULT_TTL_SECONDS', 600),
         resendCooldownSeconds: config.get('OTP_RESEND_COOLDOWN_SECONDS', 60),
         perPurpose: {
           password_reset: { length: 8, codeType: 'alphanumeric', ttlSeconds: 900 },
           email_verification: { ttlSeconds: 3600 },
         },
       },
       audit: {
         repository: new PrismaNotificationLogRepository(prisma),   // INSTANCE — DI-dependent ctor
         swallowErrors: true,
         maskRecipient: shouldMask ? mask : (r: string) => r,
       },
     }
   }
   ```
   (Reconcile field names against the README Configuration table + the exported types — do not invent option keys.
   The `tenantIdResolver` param MUST be annotated `(req: NotificationRequest)` — `NotificationRequest` is exported from
   `@bymax-one/nest-notification`; an untyped `(req)` fails `noImplicitAny` under TS strict.)
2. `notification.config.spec.ts` — assert: redis=null → storage is InMemoryOtpStorage; redis present → RedisOtpStorage;
   AUDIT_MASK_RECIPIENT 'false' → identity masker (else the j***@ masker); the tenantIdResolver returns the header value,
   the first element of an array header, and 'default' when absent. 100% coverage of the config file.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every export, English-only, no suppression comments. Annotate
  every factory param (the useFactory signature is `never[]`). Pass DI-dependent adapters as INSTANCES. Timeless
  comments only — no Phase/Task references in the committed file.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest notification.config.spec --coverage` — expected: passing; the storage-branch + masker +
  resolver assertions green; 100% on the config file.

Completion Protocol: set 4.5 ✅ (block + index), tick criteria, header Progress `5 / 7` + Last updated, update the P4
row Progress to `5 / 7` in docs/DEVELOPMENT_PLAN.md, append `- 4.5 ✅ <date> — notification.config forRootAsync useFactory`,
commit `feat(api): wire BymaxNotificationModule forRootAsync config factory` (no Co-Authored-By).
````

---

### Task 4.6 — `NotificationAuditInterceptor` as `APP_INTERCEPTOR` + module assembly

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 4.5

#### Description

Assemble `app.module.ts`: import `BymaxNotificationModule.forRootAsync` (using the config factory) and register the
library's `NotificationAuditInterceptor` globally as `APP_INTERCEPTOR`, so intercepted dispatches emit
`sent`/`failed` audit rows with `providerName: '__interceptor__'`.

#### Acceptance criteria

- [ ] `apps/api/src/app.module.ts` calls `BymaxNotificationModule.forRootAsync({ imports: [ConfigModule, RedisModule,
PrismaModule], inject: [ConfigService, REDIS, PrismaService], useFactory: notificationConfig })`.
- [ ] `{ provide: APP_INTERCEPTOR, useClass: NotificationAuditInterceptor }` is registered in `app.module.ts` providers.
- [ ] `RedisModule` + `PrismaModule` are imported so the `REDIS` token and `PrismaService` resolve in the factory.
- [ ] The app **boots** (`Nest application successfully started`) against the local stack with `REDIS_URL` set and unset
      (the `null` branch). `app.module.ts` is excluded from coverage (glue) per the conventions.
- [ ] A module-init integration spec (`Test.createTestingModule`) compiles the module and asserts the
      `NotificationService` (or the module) resolves without throwing.

#### Files to create / modify

- `apps/api/src/app.module.ts`
- `apps/api/test/app.module.spec.ts` (or `app.module.int-spec.ts`) — module-compiles integration spec

#### Agent prompt

````
You are a senior NestJS application-assembly engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email+OTP lib).
apps/api wires the library via forRootAsync and registers the library's audit interceptor globally so HTTP-level
sent/failed rows are captured automatically (providerName '__interceptor__'), separate from the services' lifecycle verbs.

CURRENT PHASE: 4 (Notification Wiring & Audit Store) — Task 4.6 of 7 (MIDDLE)

PRECONDITIONS
- Task 4.5 done: `notification.config.ts` exports the `notificationConfig(config, redis, prisma)` factory. P3 provided
  RedisModule (exports the REDIS Symbol token → ioredis | null), PrismaModule/PrismaService, ConfigModule (Zod env).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "9. Configuration & Environment" — the app.module.ts shape (the forRootAsync imports/inject/
  useFactory + the `{ provide: APP_INTERCEPTOR, useClass: NotificationAuditInterceptor }` line; RedisModule/PrismaModule
  must be imported so the tokens resolve) + § "15. Audit Log & Delivery Tracking" (the two-source model: services emit
  lifecycle verbs; the interceptor emits sent/failed per intercepted /dispatch with providerName '__interceptor__').
- ~/Documents/MyApps/bymax-one/nest-notification/README.md — the `NotificationAuditInterceptor` import + that it is
  applied globally via APP_INTERCEPTOR (or per-handler).
- docs/DEVELOPMENT_PLAN.md § "Phase 4" (DoD: module boots via forRootAsync; getEnabledChannels reports ['email','otp']).

TASK
Assemble app.module.ts (forRootAsync via the config factory) and register NotificationAuditInterceptor as APP_INTERCEPTOR;
prove the module compiles.

DELIVERABLES
1. `apps/api/src/app.module.ts`:
   ```typescript
   import { Module } from '@nestjs/common'
   import { APP_INTERCEPTOR } from '@nestjs/core'
   import { ConfigModule, ConfigService } from '@nestjs/config'
   import { BymaxNotificationModule, NotificationAuditInterceptor } from '@bymax-one/nest-notification'
   import { PrismaModule } from './prisma/prisma.module.js'
   import { PrismaService } from './prisma/prisma.service.js'
   import { RedisModule, REDIS } from './redis/redis.module.js'
   import { notificationConfig } from './notification/notification.config.js'
   // + the existing ConfigModule.forRoot (Zod validate) + HealthModule from P3.

   @Module({
     imports: [
       ConfigModule, RedisModule, PrismaModule,
       BymaxNotificationModule.forRootAsync({
         imports: [ConfigModule, RedisModule, PrismaModule],
         inject: [ConfigService, REDIS, PrismaService],
         useFactory: notificationConfig,
       }),
       // …HealthModule, etc. (keep P3 imports)
     ],
     providers: [{ provide: APP_INTERCEPTOR, useClass: NotificationAuditInterceptor }],
   })
   export class AppModule {}
   ```
   (Preserve everything P3 already put in app.module.ts — only ADD the notification wiring + interceptor.)
2. `apps/api/test/app.module.spec.ts` — `Test.createTestingModule({ imports: [AppModule] }).compile()` and assert it
   resolves (e.g. `module.get(NotificationService)` or the module itself) without throwing. Mock the DB/Redis if the
   test env lacks them, or run against the test compose stack — keep it a fast module-compile check.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc where a symbol is exported, English-only, no suppression comments.
  `app.module.ts` is non-executable glue → excluded from coverage scope. Timeless comments only. Do not move the audit
  interceptor's verb mapping into the controller — the library owns it.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm infra:up && pnpm --filter @nest-notification-example/api dev` (or `start`) — expected: logs `Nest application successfully started`; repeat
  with `REDIS_URL` unset → still boots (InMemoryOtpStorage branch).
- `pnpm --filter @nest-notification-example/api exec jest app.module.spec` — expected: the module compiles green.

Completion Protocol: set 4.6 ✅ (block + index), tick criteria, header Progress `6 / 7` + Last updated, update the P4
row Progress to `6 / 7` in docs/DEVELOPMENT_PLAN.md, append `- 4.6 ✅ <date> — module assembly + audit interceptor`,
commit `feat(api): wire forRootAsync + register notification audit interceptor` (no Co-Authored-By).
````

---

### Task 4.7 — Boot probe — end-to-end send → Mailpit → masked audit row

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 4.6

#### Description

**Extend** (append to — never replace) the existing `apps/api/src/library-probe.ts` created in P2 so it now also touches
the newly-wired exports, and add an integration spec that programmatically sends a template email through the wired
pipeline, asserts it renders → lands in Mailpit → writes a **masked, never-coded** audit row to Postgres, and that
`getEnabledChannels()` reports `['email','otp']` — satisfying the P4 Definition of Done without any HTTP controller.
Re-run `pnpm audit:exports` as the gate (it must stay green, preserving every reference P2 already added).

#### Acceptance criteria

- [ ] `apps/api/src/library-probe.ts` (the file P2 created — **extend** it, do not replace it: keep every existing
      reference) now also references the otherwise-hard-to-exercise wired exports (the resolved options type, the `REDIS`
      token, `getEnabledChannels`) so the export-usage audit sees them; it is **not** an HTTP route.
- [ ] An integration spec (against the test compose stack) sends a `welcome`/`otp_code` template email via
      `EmailService.sendTemplate`, then asserts: (a) `getEnabledChannels()` deep-equals `['email','otp']`; (b) the message
      is retrievable from Mailpit's API (`GET :8025/api/v1/messages`); (c) exactly one `notification_logs` row was written
      with the **masked** recipient (`j***@…`) and **no** code anywhere in the row (`JSON.stringify(row)` excludes the code).
- [ ] The atomic OTP storage behavior (max-attempts cannot be exceeded; cooldown blocks a second generate) and the
      renderer html-only escape are unit-proven (may reuse 4.4 specs; add the storage assertions here).
- [ ] `pnpm --filter @nest-notification-example/api test:cov` passes at 100% for the new executable files; `pnpm audit:exports` is **re-run as the
      gate** and exits 0 (the P2 references are preserved alongside the newly-added ones).

#### Files to create / modify

- `apps/api/src/library-probe.ts` — **extend** the P2 file (append the new references; do not replace it)
  (+ `library-probe.spec.ts` or `notification.int-spec.ts`)
- `apps/api/test/notification-pipeline.int-spec.ts` — the send → Mailpit → audit-row integration spec

#### Agent prompt

```
You are a senior NestJS integration-test engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email+OTP lib).
The P4 Definition of Done is proven WITHOUT any HTTP controller (those arrive in P5): a programmatic template send must
render, land in Mailpit, and write a masked, never-coded audit row; getEnabledChannels() must report ['email','otp'].

CURRENT PHASE: 4 (Notification Wiring & Audit Store) — Task 4.7 of 7 (LAST)

PRECONDITIONS
- Task 4.6 done: app.module.ts wires forRootAsync (notificationConfig) + the APP_INTERCEPTOR; the module boots against
  the local stack. PrismaNotificationLogRepository writes to notification_logs; the Nodemailer provider targets Mailpit.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "11. The Notification Delivery Pipeline (Deep Dive)" — the 4 stages (resolve → render → deliver →
  audit), the atomic OTP guarantees (consumeAttempt / tryAcquireCooldown), Stage-4 masked-never-coded audit + the
  cooldown-release-on-failure detail; § "15. Audit Log & Delivery Tracking" (the two-source model); § "13. Multi-Tenant
  Security" (the `JSON.stringify(auditEntry).includes(code) === false` invariant + masking).
- ~/Documents/MyApps/bymax-one/nest-notification/README.md — the EmailService.sendTemplate signature + the
  NotificationService.getEnabledChannels call; the OtpService generate/verify/resend behavior (for the atomic asserts).
- docs/OVERVIEW.md § "8. Local Stack & Memory-Safe Run" (the test compose stack: Postgres :55432 / Redis :56379 /
  Mailpit) — run integration specs against `docker-compose.test.yml`, NOT the dev stack.

TASK
Add a gated boot probe + an integration spec that programmatically sends a template email through the wired pipeline and
proves render → Mailpit → masked-never-coded audit row, plus getEnabledChannels() === ['email','otp'] and the atomic-OTP
+ html-escape behaviors.

DELIVERABLES
1. `apps/api/src/library-probe.ts` — this file ALREADY EXISTS (P2 created it). EXTEND it (append the new references;
   never replace it or drop what P2 added): make it also touch the otherwise-hard-to-exercise wired exports (the resolved
   options type, the REDIS token import, a call to `NotificationService.getEnabledChannels`) so `audit:exports` sees them
   referenced. Keep the existing JSDoc/exports intact and add JSDoc for the new lines (it is a wiring probe, not an HTTP
   surface).
2. `apps/api/test/notification-pipeline.int-spec.ts` — boot the module against `docker-compose.test.yml`, then:
   - `expect(notificationService.getEnabledChannels()).toEqual(['email','otp'])`.
   - `await emailService.sendTemplate({ tenantId: 'acme', to: 'jane@acme.com', template: 'welcome', locale: 'en',
     data: { appName: 'Bymax' } })`; then `GET http://localhost:8025/api/v1/messages` (Mailpit) shows the message.
   - Query `notification_logs`: exactly one new row, `recipient === 'j***@acme.com'` (masked), and
     `JSON.stringify(row)` does NOT contain a code. (For an OTP path, generate with a known code via the in-memory
     storage and assert it is absent from the row.)
   - Atomic OTP: drive `verify` past `defaultMaxAttempts` → `max_attempts`; a second `generate` inside the cooldown →
     `cooldown_blocked`. Assert the audit rows for those verbs, with no code present.
   - Reset the Mailpit inbox + truncate `notification_logs` between cases so the suite is deterministic & re-runnable.
3. Re-run `pnpm audit:exports` as the gate — it must stay green (the wired exports are referenced via the extended probe
   + the spec, and every reference P2 already added is preserved).

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on exports, English-only, no suppression comments. Timeless
  comments only. Run integration specs against the TEST compose stack (Postgres :55432 / Redis :56379), single-suite,
  bounded workers (`--maxWorkers=2`, `NODE_OPTIONS=--max-old-space-size=4096`) — never fan out parallel test agents.
  Never assert against a real code printed to a log; the code lives only in the store/process memory.

Verification:
- `pnpm infra:up` (test stack) then `pnpm --filter @nest-notification-example/api exec jest notification-pipeline.int-spec --runInBand` — expected:
  green; getEnabledChannels ['email','otp']; the Mailpit message present; one masked, code-free audit row; the
  max-attempts + cooldown verbs asserted.
- `pnpm --filter @nest-notification-example/api test:cov` — expected: 100% on the new executable files.
- `pnpm audit:exports` — re-run as the gate; expected: exit 0 (the extended probe keeps P2's references AND adds the new
  wired-export references).

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK: set 4.7 ✅ (block + index), tick criteria, header Progress `7 / 7` + Last updated, update the P4 row Progress
to `7 / 7` in docs/DEVELOPMENT_PLAN.md, append `- 4.7 ✅ <date> — boot probe: send → Mailpit → masked audit row`, commit
`test(api): prove notification pipeline end-to-end (send → mailpit → masked audit)` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, in
docs/DEVELOPMENT_PLAN.md set the **P4 Status to ✅** and Progress `7 / 7` + Last updated, advance **Active phase** to P5,
recompute **Overall progress** to `4 / 15 phases (27%)`; set this file's header Status to ✅; commit `docs(plan): P4 complete`.
```

---

## Phase Completion Protocol

When **Task 4.7** is `✅` and every other task is `✅`:

1. Confirm all 7 tasks are `✅` and the P4 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P4`](../DEVELOPMENT_PLAN.md#phase-4--notification-wiring--audit-store)
   is met: the module boots via `forRootAsync({ useFactory })`; `getEnabledChannels()` reports `['email','otp']`; a
   programmatic template send renders → lands in Mailpit → writes a **masked, never-coded** audit row to Postgres; the
   atomic OTP storage (Redis or in-memory) and the renderer HTML-escape behavior are unit-proven.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks, including `audit:exports`).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P4 Status** to `✅`, **Progress** `7 / 7`, **Last
   updated** today; set **Active phase** to `P5`; recompute **Overall progress** to `4 / 15 phases (27%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `7 / 7 tasks`.
5. Commit `docs(plan): P4 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P4 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

_(empty — no tasks completed yet)_
