# Phase 6 — Audit Read-API (keyset + SSE)

> **Status**: 🔄 In Progress · **Progress**: 4 / 5 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P6
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

P5 produced the write side of the audit log: the OTP/email/dispatch controllers (`/otp/*`, `/email/*`, `/dispatch`,
`/channels`, `/debug/key`) drive the `@bymax-one/nest-notification` services, and P4 wired the audit store —
`PrismaNotificationLogRepository` (`INotificationLogRepository` over the `NotificationLog` Postgres table) plus the
opt-in `NotificationAuditInterceptor` (`APP_INTERCEPTOR`). Rows therefore already arrive from **two sources**: the
**services** emit lifecycle verbs (`generated`/`verified`/`failed`/`cooldown_blocked`/`max_attempts_exceeded`) carrying
the real `providerName`; the **interceptor** emits one `sent`/`failed` row per `/dispatch` call with
`providerName: '__interceptor__'`. There is no way to **read** that log yet.

Phase 6 builds the **read side** — the queryable, live delivery audit log that powers the Audit Explorer (rendered in
P9). When P6 is done, `apps/api` exposes:

- `GET /audit/logs` — **keyset** pagination over `(timestamp DESC, id DESC)` returning `{ data, nextCursor, hasMore }`;
  a stale/foreign cursor returns **HTTP 410**.
- `GET /audit/stream` — a NestJS `@Sse` `Observable<MessageEvent>` live tail; each event's `id` is the row's keyset
  cursor so a reconnect resumes from `Last-Event-ID`; it merges a keyset replay of missed rows + the live feed + a
  keep-alive ping.
- `GET /audit/aggregate` — time-bucketed counts by `verb`/`channel`/`provider` for the Overview charts.
- The **source facet** (`providerName === '__interceptor__'`) on every read endpoint, so a reader can separate "what the
  service did" from "what the HTTP boundary saw".

The gold source is the **direct analog** in `nest-logger-example`'s `logs/` module — copy and **adapt** its proven
keyset-cursor codec, `@Sse` live-tail, in-process event bus, and time-bucketed aggregate; re-map every logger-specific
field (`level`/`logKey`/`traceId`) to the notification audit domain (`verb`/`channel`/`recipient`/`purpose`/`provider`)
and add the **source facet**. The library never imports Prisma; all read SQL lives in `apps/api`.

---

## Rules-of-phase

1. **Never per-event access-log the SSE route** — the audit log records notification events, and the SSE feed reads from
   that same log. Logging each `/audit/stream` request (or each emitted row) back into the audit store creates a
   feedback loop. Exclude the stream route from any access-logging interceptor and never write an audit row from the
   read path.
2. **The cursor is opaque and shared** — one keyset codec (`encodeCursor`/`decodeCursor` over `{ timestamp, id }`,
   base64url) lives in the service and is reused by `/audit/logs`, `/audit/stream` replay, and the SSE `id`. A malformed
   or foreign cursor → `StaleCursorError` → **HTTP 410** on `/audit/logs`; on the SSE replay path it degrades to
   live-only (never HTTP 500).
3. **Source facet is first-class** — every read endpoint accepts a `source` filter mapping to the
   `providerName === '__interceptor__'` predicate (`interceptor` ⇒ only interceptor rows, `service` ⇒ exclude them,
   omitted ⇒ both). Document the dual-source semantics in the controller JSDoc.
4. **Tenant scoping cannot be bypassed** — `tenantId` is resolved server-side and ANDed into the Prisma `where`; a query
   param can never widen it (mirror the logger example's `restriction` thread).
5. **Parameterized SQL only** — the aggregate uses Prisma `$queryRaw` tagged templates / typed `where` builders; never
   string-interpolate user input. No raw recipient/PII or OTP codes are ever returned or logged.
6. **Timeless, English-only deliverable code** — JSDoc on every export; no `any`, no suppression comments
   (`@ts-ignore`, `eslint-disable`); **no `Phase N` / `Task` / roadmap-stage references** in any committed source,
   config, or comment (this planning file may name them; the code it produces may not).
7. **100% covered** — every new file is unit-tested to 100% statements/branches/functions/lines (Jest, `maxWorkers:
'50%'`); non-executable glue (`*.module.ts`, `*.dto.ts`) is excluded from scope but the schemas are exercised.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — § "15. Audit Log & Delivery Tracking" (the read-API contract: the three endpoints,
  the two sources, the source facet) and § "16. Demonstrated Journeys" (journeys 1 and 11 — the live tail + dual rows).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § "Phase 6 — Audit Read-API (keyset + SSE)", § "2. Global
  Conventions", § "3. Autonomous Execution Model".
- Sibling gold source (the direct analog — copy & adapt): `~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/logs/`
  — `dto/log-query.dto.ts`, `dto/aggregate-query.dto.ts`, `logs.service.ts` (cursor codec + `where` builder),
  `logs.controller.ts` (keyset list + aggregate + 410), `log-event.bus.ts` (in-process bus + `replaySince` + `matches`),
  `logs.sse.controller.ts` (`@Sse` merge of replay + live + keep-alive), `logs.aggregate.service.ts` (time buckets).
- `/bymax-workflow:standards` skill — universal coding rules (TS strict, JSDoc, English-only, no suppression comments).

---

## Task index

| ID  | Task                                                | Status  | Priority | Size | Depends on |
| --- | --------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 6.1 | Audit query DTOs + indexes + source facet           | ✅ Done | P0       | M    | —          |
| 6.2 | Audit read service — cursor codec + `where` builder | ✅ Done | P0       | M    | 6.1        |
| 6.3 | `GET /audit/logs` keyset controller (410 on stale)  | ✅ Done | P0       | M    | 6.2        |
| 6.4 | Audit event bus + `GET /audit/stream` (`@Sse`)      | ✅ Done | P0       | L    | 6.2        |
| 6.5 | `GET /audit/aggregate` (time-bucketed) + wire-up    | 📋 ToDo | P1       | M    | 6.3, 6.4   |

---

## Tasks

### Task 6.1 — Audit query DTOs + indexes + source facet

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Author the shared Zod filter DTO (and the aggregate-extension DTO) that every `/audit/*` read endpoint consumes, define
the `source` facet union, and ensure the `NotificationLog` table carries the indexes keyset pagination + filtering need.

#### Acceptance criteria

- [x] `apps/api/src/audit/dto/audit-query.dto.ts` exports `auditQuerySchema` (Zod) + inferred `AuditQueryDto` with:
      `tenantId`, `channel`, `verb`, `recipient`, `purpose`, `provider`, `source` (`'service' | 'interceptor'` — omitted ⇒
      both), free-text `q`, ISO-8601 `from`/`to`, opaque `cursor`, and `limit` (coerced int, clamped 1–100, default 50).
- [x] `channel`/`verb`/`purpose` Zod enums are built from **local const arrays** and pinned with a **type-level parity
      guard** (`satisfies`) against the imported **types** `NotificationChannel` and `OtpPurpose` (from
      `@bymax-one/nest-notification/shared`) and the verb union `type NotificationLogVerb` (from the package root
      `@bymax-one/nest-notification`) — never against a runtime array, which `./shared` does not export. The `./shared`
      subpath exports only: `type OtpPurpose`, `type NotificationChannel`, `type NotificationErrorResponse`,
      `NOTIFICATION_ERROR_CODES`, `type NotificationErrorCode`, `DEFAULT_TTLS`.
- [x] `apps/api/src/audit/dto/audit-aggregate-query.dto.ts` exports `auditAggregateQuerySchema` extending the base with
      `groupBy` (bounded allow-list: `verb`/`channel`/`provider`), `bucket` (`auto`/`1m`/`5m`/`1h`), plus a `resolveBucket`
      helper, and `AuditAggregateQueryDto`.
- [x] `apps/api/prisma/schema.prisma` `NotificationLog` has a composite index on `([timestamp, id])` (keyset) and indexes
      supporting `(tenantId, channel, verb)` filtering; a migration is generated.
- [x] `pnpm --filter @nest-notification-example/api exec tsc --noEmit` exits 0; the parity-guard line compiles.

#### Files to create / modify

- `apps/api/src/audit/dto/audit-query.dto.ts`, `apps/api/src/audit/dto/audit-aggregate-query.dto.ts`
- `apps/api/prisma/schema.prisma` (+ a generated migration under `apps/api/prisma/migrations/`)

#### Agent prompt

````
You are a senior NestJS / TypeScript backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib: multi-tenant, pluggable providers/storage, audit log). pnpm monorepo, Node 24, TypeScript 5.9 strict;
apps/api is a NestJS service with Prisma/Postgres for the NotificationLog audit table. The library never imports Prisma.

CURRENT PHASE: 6 (Audit Read-API (keyset + SSE)) — Task 6.1 of 5 (FIRST)

PRECONDITIONS
- P4 wired the audit store: prisma/schema.prisma has a `NotificationLog` model and `PrismaNotificationLogRepository`
  writes rows; the `NotificationAuditInterceptor` writes interceptor rows with `providerName: '__interceptor__'`.
- P5 produced the write-side controllers; rows already exist for service verbs + interceptor sent/failed.
- An `apps/api/src/common/zod-validation.pipe.ts` (ZodValidationPipe) exists from P3.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "15. Audit Log & Delivery Tracking" (the read-API contract + the two sources + the source facet).
- docs/DEVELOPMENT_PLAN.md § "Phase 6 — Audit Read-API (keyset + SSE)" + § "2. Global Conventions".
- The sibling DTOs to copy & adapt (do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/logs/
  dto/{log-query.dto.ts, aggregate-query.dto.ts} — copy the schema shape, the type-level enum-parity guard, the
  `limit` coercion, and `resolveBucket`; re-map fields to the notification domain. NOTE: `./shared` exports the
  channel/purpose unions as TYPES only (no runtime array), so build the Zod enums from local const arrays and pin them
  with a `satisfies`/type-level guard against the imported types — do NOT import any runtime enum array from `./shared`.

TASK
Author the shared audit filter DTO + the aggregate-extension DTO, the `source` facet union, and the NotificationLog
indexes (+ migration) that keyset pagination and filtering rely on.

DELIVERABLES
1. `apps/api/src/audit/dto/audit-query.dto.ts`:
   ```typescript
   import { z } from 'zod'
   import type { NotificationChannel, OtpPurpose } from '@bymax-one/nest-notification/shared'
   import type { NotificationLogVerb } from '@bymax-one/nest-notification'
   // Build Zod enums from LOCAL const arrays, then pin them to the imported TYPES via a type-level `satisfies` parity
   // guard (copy the logger example's pattern). `./shared` exports NO runtime CHANNELS/VERBS/PURPOSES array.
   const CHANNELS = ['email', 'sms', 'push'] as const // local const — extend to mirror NotificationChannel
   const VERBS = ['generated', 'verified', 'failed', 'sent', 'cooldown_blocked', 'max_attempts_exceeded'] as const
   const PURPOSES = ['login', 'password_reset', 'transaction', 'verification'] as const
   const channelSchema = z.enum(CHANNELS)
   const verbSchema = z.enum(VERBS)
   const purposeSchema = z.enum(PURPOSES)
   // Type-level parity: a drift between the local arrays and the imported library types breaks the build.
   type _ChannelParity = (typeof CHANNELS)[number] satisfies NotificationChannel
   type _VerbParity = (typeof VERBS)[number] satisfies NotificationLogVerb
   type _PurposeParity = (typeof PURPOSES)[number] satisfies OtpPurpose
   export const auditQuerySchema = z.object({
     tenantId: z.string().max(128).optional(),
     channel: channelSchema.optional(),
     verb: verbSchema.optional(),
     purpose: purposeSchema.optional(),
     recipient: z.string().max(320).optional(),
     provider: z.string().max(64).optional(),
     /** Source facet: 'interceptor' ⇒ only __interceptor__ rows; 'service' ⇒ exclude them; omitted ⇒ both. */
     source: z.enum(['service', 'interceptor']).optional(),
     q: z.string().max(1024).optional(),
     from: z.string().datetime().optional(),
     to: z.string().datetime().optional(),
     cursor: z.string().optional(),
     limit: z.coerce.number().int().min(1).max(100).default(50),
   })
   export type AuditQueryDto = z.infer<typeof auditQuerySchema>
   ```
2. `apps/api/src/audit/dto/audit-aggregate-query.dto.ts` — `auditAggregateQuerySchema = auditQuerySchema.extend({
   groupBy: z.enum(['verb','channel','provider']).optional(), bucket: z.enum(['auto','1m','5m','1h']).default('auto') })`
   plus a `resolveBucket(from, to)` helper (adapt the logger example's) and `AuditAggregateQueryDto`.
3. `apps/api/prisma/schema.prisma` — add `@@index([timestamp, id])` (keyset) and `@@index([tenantId, channel, verb])`
   to `NotificationLog`; run `pnpm --filter @nest-notification-example/api exec prisma migrate dev --name audit-read-indexes`
   (a placeholder DATABASE_URL is fine — see OVERVIEW §17) to generate the migration.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every export, English-only, no `any`, no suppression comments.
- `channel`/`verb`/`purpose` Zod enums are built from local const arrays and pinned with a type-level `satisfies` guard
  against the imported TYPES `NotificationChannel`/`OtpPurpose` (`./shared`) + `NotificationLogVerb` (package root), so a
  drift in the library breaks the build. Do NOT import any runtime CHANNELS/VERBS/PURPOSES from `./shared` — none exist.
- Timeless code: NO Phase/Task/roadmap references in any file you write.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0 (the parity guard compiles).
- `node -e "import('./apps/api/src/audit/dto/audit-query.dto.ts')"` is not required; instead confirm the schema parses a
  sample: write a throwaway and run a unit test, OR assert via the test you add in this task that
  `auditQuerySchema.parse({ limit: '5' }).limit === 5` and an unknown `verb` throws.
- `ls apps/api/prisma/migrations` — expected: a new `*_audit-read-indexes` directory exists.

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 5` and Last updated to today.
4. Update the P6 row Progress to `1 / 5` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 6.1 ✅ <YYYY-MM-DD> — audit query DTOs + indexes + source facet`.
6. Commit: `feat(audit): add audit query DTOs, indexes, and source facet` (no Co-Authored-By).
````

---

### Task 6.2 — Audit read service — cursor codec + `where` builder

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 6.1

#### Description

Author `AuditReadService`: the single keyset cursor codec (opaque base64url of `{ timestamp, id }`) and the
`AuditQueryDto` → Prisma `where` compiler — including the **source facet** predicate — that every `/audit/*` endpoint
reuses so they behave identically.

#### Acceptance criteria

- [x] `apps/api/src/audit/audit-read.service.ts` exports `AuditReadService` (`@Injectable`) with `encodeCursor`,
      `decodeCursor`, and `buildWhere(q, restriction?)` returning a Prisma `NotificationLogWhereInput`.
- [x] `decodeCursor` throws an exported `StaleCursorError` (controllers map it to HTTP 410) on any malformed/foreign
      cursor or invalid date; `encodeCursor({ timestamp, id })` round-trips through `decodeCursor`.
- [x] `buildWhere` applies the time window (default `now-1h`..`now`), the `tenantId` (RBAC restriction wins over the
      query param), `channel`/`verb`/`purpose`/`recipient`/`provider` equality, free-text `q` on the message column
      (case-insensitive `contains`), and the **source facet**: `source === 'interceptor'` ⇒
      `providerName: '__interceptor__'`; `source === 'service'` ⇒ `providerName: { not: '__interceptor__' }`; omitted ⇒ no
      source predicate.
- [x] 100% unit-covered: cursor round-trip, every `StaleCursorError` branch, each filter field, and all three source
      modes.
- [x] `pnpm --filter @nest-notification-example/api exec tsc --noEmit` exits 0.

#### Files to create / modify

- `apps/api/src/audit/audit-read.service.ts`
- `apps/api/src/audit/audit-read.service.spec.ts`

#### Agent prompt

````
You are a senior NestJS / TypeScript backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib,
multi-tenant, audit log over Prisma/Postgres). pnpm monorepo, Node 24, TypeScript 5.9 strict. apps/api owns all read SQL;
the library never imports Prisma.

CURRENT PHASE: 6 (Audit Read-API (keyset + SSE)) — Task 6.2 of 5 (MIDDLE)

PRECONDITIONS
- Task 6.1 done: `apps/api/src/audit/dto/audit-query.dto.ts` exports `auditQuerySchema` + `AuditQueryDto` (with the
  `source` facet) and the NotificationLog keyset/filter indexes + migration exist.
- A `PrismaService` (apps/api/src/prisma/prisma.service.ts) exists from P3; `NotificationLog` has `timestamp: DateTime`
  (NOT `createdAt`) and `id: string` (cuid/uuid), `providerName`, `channel`, `verb`, `recipient`, `purpose`, `tenantId`,
  a message column. Per `docs/schemas/notification-log.prisma` the model indexes `[tenantId, timestamp]`,
  `[tenantId, channel, verb]`, `[userId, timestamp]`.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "15. Audit Log & Delivery Tracking" (the keyset contract + the source facet semantics).
- The sibling to copy & adapt (do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/logs/
  logs.service.ts — copy `encodeCursor`/`decodeCursor`, `StaleCursorError`, `QueryRestriction`, and `buildPrismaWhere`
  verbatim in shape; re-map (`time`→`timestamp`, `level`/`logKey`→`channel`/`verb`/`purpose`) and ADD the source-facet
  predicate on `providerName === '__interceptor__'`.

TASK
Author `AuditReadService` — the shared keyset cursor codec and the `AuditQueryDto` → Prisma `where` compiler with the
source facet — plus its 100%-covering unit test.

DELIVERABLES
1. `apps/api/src/audit/audit-read.service.ts`:
   ```typescript
   export class StaleCursorError extends Error { /* name = 'StaleCursorError' */ }
   export interface AuditRestriction { tenantId?: string }
   @Injectable()
   export class AuditReadService {
     encodeCursor(c: { timestamp: Date; id: string }): string { /* base64url of {t,i} */ }
     decodeCursor(s: string): { timestamp: Date; id: string } { /* throw StaleCursorError on bad input */ }
     buildWhere(q: AuditQueryDto, restriction?: AuditRestriction): Prisma.NotificationLogWhereInput {
       // time window (default now-1h..now); tenantId (restriction wins); channel/verb/purpose/recipient/provider;
       // free-text q (contains, insensitive); SOURCE FACET:
       //   'interceptor' → { providerName: '__interceptor__' }
       //   'service'     → { providerName: { not: '__interceptor__' } }
       //   undefined     → no source predicate
     }
   }
   ```
2. `apps/api/src/audit/audit-read.service.spec.ts` — 100% coverage: encode→decode round-trip; decodeCursor throws
   StaleCursorError on empty/garbage/bad-date/non-string-id; every buildWhere field; restriction overrides query tenantId;
   all three source modes (each `it()` carries a block comment naming the scenario + the rule it protects).

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every export, English-only, no `any`, no suppression comments.
- The cursor is OPAQUE (base64url JSON) — never expose timestamp/id in plaintext to clients.
- Parameterized/​typed Prisma `where` only — never string-interpolate user input.
- Timeless code: NO Phase/Task/roadmap references.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/audit/audit-read.service.spec.ts --coverage --maxWorkers=2`
  — expected: pass, 100% statements/branches/functions/lines on audit-read.service.ts.

Completion Protocol:
1. Set 6.2 Status to ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Bump the file-header Progress to `2 / 5` + Last updated to today.
3. Update the P6 row Progress to `2 / 5` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 6.2 ✅ <YYYY-MM-DD> — audit read service (cursor codec + where builder)`.
5. Commit: `feat(audit): add audit read service with keyset cursor codec` (no Co-Authored-By).
````

---

### Task 6.3 — `GET /audit/logs` keyset controller (410 on stale)

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 6.2

#### Description

Author `AuditController` with the `GET /audit/logs` handler: keyset pagination over `(timestamp DESC, id DESC)` using the
shared codec, returning `{ data, nextCursor, hasMore }`, mapping `StaleCursorError` to HTTP 410.

#### Acceptance criteria

- [x] `apps/api/src/audit/audit.controller.ts` exports `AuditController` (`@Controller('audit')`) with
      `@Get('logs')` validating `AuditQueryDto` via `ZodValidationPipe`, resolving the tenant restriction server-side from
      the trusted source, building the `where` via `AuditReadService.buildWhere`, applying the tuple keyset clause
      `(timestamp < cur.timestamp) OR (timestamp = cur.timestamp AND id < cur.id)`, ordering `timestamp desc, id desc`,
      taking `limit`, and returning `{ data, nextCursor, hasMore }`.
- [x] An exported `AuditLogsPageResponse` interface documents the response shape.
- [x] A stale/foreign/malformed `cursor` → `GoneException` (HTTP 410) with a "restart pagination" message; a valid query
      with no cursor returns the first page.
- [x] `nextCursor` is the last row's encoded cursor when a full page is returned, else `null`; `hasMore === (rows.length
=== limit)`.
- [x] 100% unit-covered (mock `PrismaService`): first page, mid pagination, last page (`hasMore=false`,
      `nextCursor=null`), and the 410 path.

#### Files to create / modify

- `apps/api/src/audit/audit.controller.ts`
- `apps/api/src/audit/audit.controller.spec.ts`

#### Agent prompt

````
You are a senior NestJS / TypeScript backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib,
multi-tenant, Prisma/Postgres audit log). pnpm monorepo, Node 24, TypeScript 5.9 strict. apps/api owns the read SQL.

CURRENT PHASE: 6 (Audit Read-API (keyset + SSE)) — Task 6.3 of 5 (MIDDLE)

PRECONDITIONS
- Task 6.2 done: `AuditReadService` exports `encodeCursor`/`decodeCursor`/`buildWhere` + `StaleCursorError` +
  `AuditRestriction`; the `AuditQueryDto` schema (Task 6.1) carries the `source` facet.
- `ZodValidationPipe` (apps/api/src/common/zod-validation.pipe.ts) and a trusted tenant-resolution helper exist from
  P3/P4 (mirror however P5's controllers resolve `tenantId` — server-side, never from the body).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "15. Audit Log & Delivery Tracking" (the `/audit/logs` envelope + keyset + 410-on-stale contract).
- The sibling to copy & adapt (do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/logs/
  logs.controller.ts — copy the `list()` handler verbatim in shape (the tuple keyset clause, `orderBy [desc,desc]`,
  `nextCursor`/`hasMore`, the try/catch mapping `StaleCursorError` → `GoneException`); re-map `time`→`timestamp`,
  `applicationLog`→`notificationLog`, and resolve the tenant restriction the same way P5's controllers do.

TASK
Author `AuditController` with `GET /audit/logs` (keyset pagination, 410 on stale cursor) + its 100%-covering unit test.

DELIVERABLES
1. `apps/api/src/audit/audit.controller.ts`:
   ```typescript
   export interface AuditLogsPageResponse { data: NotificationLog[]; nextCursor: string | null; hasMore: boolean }

   @Controller('audit')
   export class AuditController {
     constructor(private readonly prisma: PrismaService, private readonly audit: AuditReadService) {}

     @Get('logs')
     async list(
       @Headers() headers: Record<string, string>,
       @Query(new ZodValidationPipe(auditQuerySchema)) q: AuditQueryDto,
     ): Promise<AuditLogsPageResponse> {
       const restriction = /* resolve tenant server-side */
       const where = this.audit.buildWhere(q, restriction)
       if (q.cursor !== undefined) {
         let cur; try { cur = this.audit.decodeCursor(q.cursor) }
         catch (e) { if (e instanceof StaleCursorError) throw new GoneException('cursor is stale; restart pagination from the top'); throw e }
         const clause = { OR: [ { timestamp: { lt: cur.timestamp } }, { timestamp: cur.timestamp, id: { lt: cur.id } } ] }
         where.AND = [ ...(Array.isArray(where.AND) ? where.AND : []), clause ]
       }
       const rows = await this.prisma.notificationLog.findMany({ where, orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take: q.limit })
       const last = rows.at(-1); const hasMore = rows.length === q.limit
       const nextCursor = hasMore && last ? this.audit.encodeCursor({ timestamp: last.timestamp, id: last.id }) : null
       return { data: rows, nextCursor, hasMore }
     }
   }
   ```
2. `apps/api/src/audit/audit.controller.spec.ts` — 100% coverage with a mocked PrismaService + AuditReadService:
   first page (no cursor), mid page (cursor present → keyset clause applied), last page (`hasMore=false`,
   `nextCursor=null`), and the 410 path (decodeCursor throws StaleCursorError). Each `it()` carries a scenario comment.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every export (incl. `@throws {GoneException}` on `list`),
  English-only, no `any`, no suppression comments.
- Resolve `tenantId` from the trusted server-side source — never the request body/query (anti-spoof).
- Timeless code: NO Phase/Task/roadmap references.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/audit/audit.controller.spec.ts --coverage --maxWorkers=2`
  — expected: pass, 100% on audit.controller.ts.
- (Optional with the stack up via `pnpm infra:up`): `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/audit/logs?cursor=garbage"`
  — expected: `410`.

Completion Protocol:
1. Set 6.3 Status to ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Bump the file-header Progress to `3 / 5` + Last updated to today.
3. Update the P6 row Progress to `3 / 5` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 6.3 ✅ <YYYY-MM-DD> — GET /audit/logs keyset controller (410 on stale)`.
5. Commit: `feat(audit): add GET /audit/logs keyset endpoint` (no Co-Authored-By).
````

---

### Task 6.4 — Audit event bus + `GET /audit/stream` (`@Sse`)

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: 6.2

#### Description

Author the in-process `AuditEventBus` (broadcasts new audit rows + keyset replay of missed rows) and the
`AuditSseController` (`@Sse('stream')`) that merges a `Last-Event-ID` replay + the live feed + a keep-alive ping, each
event's `id` being the row's keyset cursor.

#### Acceptance criteria

- [x] `apps/api/src/audit/audit-event.bus.ts` exports `AuditEventBus` (`@Injectable`) wrapping a Node `EventEmitter`,
      with `emit(entry)`, a `matches(entry, filter)` predicate (mirrors `buildWhere`, including the source facet),
      `replaySince(lastId, filter, restriction)` (keyset-fetches rows newer than the cursor, `EMPTY` on missing/malformed
      `lastId` — never throws), and `toEvent(entry)` mapping to `{ data, id: cursor }`.
- [x] The audit **write path** (the repository from P4) calls `AuditEventBus.publishPersisted` after a row is
      persisted, so a fresh live-tail connection sees new rows without a reconnect. The emit is best-effort and never
      throws back into the delivery path.
- [x] `apps/api/src/audit/audit-sse.controller.ts` exports `AuditSseController` with `@Sse('stream')` (on
      `@Controller('audit')`) returning `merge(replay$, live$, keepAlive$)`; `@Header('X-Accel-Buffering','no')` +
      `@Header('Cache-Control','no-cache')`; `live$` applies the server-side tenant restriction then `matches`; keep-alive
      every 15 s emits a `ping`.
- [x] The stream route is **never** access-logged or audited per-event (feedback-loop guard) — no audit row is written
      from the read path, and the global audit interceptor only records dispatch-shaped calls (never the read routes).
- [x] 100% unit-covered: `matches` per field + source facet; `replaySince` (undefined/empty/malformed → EMPTY; valid →
      replayed rows); `toEvent`; the controller merge (live entry passes/blocks on restriction; keep-alive emits).

#### Files to create / modify

- `apps/api/src/audit/audit-event.bus.ts`, `apps/api/src/audit/audit-sse.controller.ts`
- `apps/api/src/audit/audit-event.bus.spec.ts`, `apps/api/src/audit/audit-sse.controller.spec.ts`
- the P4 audit write path (repository/interceptor) — add the best-effort `emit` call

#### Agent prompt

````
You are a senior NestJS / RxJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib,
multi-tenant, Prisma/Postgres audit log). pnpm monorepo, Node 24, TypeScript 5.9 strict. The audit log is read live via
Server-Sent Events.

CURRENT PHASE: 6 (Audit Read-API (keyset + SSE)) — Task 6.4 of 5 (MIDDLE)

PRECONDITIONS
- Task 6.2 done: `AuditReadService` exports `encodeCursor`/`decodeCursor`/`buildWhere` + `AuditRestriction`.
- Task 6.1 done: `AuditQueryDto` (with the `source` facet) + `auditQuerySchema`.
- P4's audit write path exists: `PrismaNotificationLogRepository` persists rows and the `NotificationAuditInterceptor`
  writes `providerName: '__interceptor__'` rows — these are where you add the best-effort `emit`.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "15. Audit Log & Delivery Tracking" (the `/audit/stream` contract: `@Sse`, id = keyset cursor,
  Last-Event-ID resume) and § "16. Demonstrated Journeys" (journey 1: the row appears in the live tail).
- docs/DEVELOPMENT_PLAN.md § "Phase 6" Rules-of-phase: NEVER per-event access-log the SSE route (feedback-loop guard).
- The siblings to copy & adapt (do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/logs/
  log-event.bus.ts (the EventEmitter bus, `matches`, `replaySince`, `fetchSince` keyset, `toEvent`) and
  logs.sse.controller.ts (the `@Sse('stream')` merge of replay$ + live$ + keepAlive$, the anti-buffering headers, the
  Last-Event-ID handling). Re-map fields to the audit domain (`timestamp`, `channel`/`verb`/`recipient`/`provider`),
  use `prisma.notificationLog`, and apply the source facet inside `matches`. The audit row's time column is `timestamp`
  (NOT `createdAt`); the keyset cursor is `{ timestamp, id }`.

TASK
Author the in-process `AuditEventBus` + the `AuditSseController` (`@Sse('stream')`), wire the write path to `emit`, and
unit-test both to 100%.

DELIVERABLES
1. `apps/api/src/audit/audit-event.bus.ts`:
   ```typescript
   export interface AuditBusEntry { id: string; timestamp: Date; channel: string; verb: string; recipient: string | null
     purpose: string | null; providerName: string; tenantId: string | null; message: string; cursor: string }
   export interface AuditSseEvent { data: string; id?: string; type?: string }
   export function matches(entry: AuditBusEntry, filter: AuditQueryDto): boolean { /* per-field + SOURCE facet on providerName === '__interceptor__' */ }
   @Injectable()
   export class AuditEventBus {
     readonly emitter = new EventEmitter()
     constructor(private readonly audit: AuditReadService, private readonly prisma: PrismaService) { this.emitter.setMaxListeners(100) }
     emit(entry: AuditBusEntry): void { this.emitter.emit('audit', entry) }
     replaySince(lastId: string | undefined, filter: AuditQueryDto, restriction?: AuditRestriction): Observable<AuditSseEvent> { /* EMPTY on undefined/'' or decode failure; else from$(fetchSince) */ }
     private async *fetchSince(from, filter, restriction): AsyncGenerator<AuditSseEvent> { /* keyset (timestamp,id) > from, orderBy asc, take 500, matches, yield { data, id: cursor } */ }
     toEvent(entry: AuditBusEntry): AuditSseEvent { return { data: JSON.stringify(entry), id: entry.cursor } }
   }
   ```
2. `apps/api/src/audit/audit-sse.controller.ts` — `@Controller('audit')` + `@Sse('stream')` returning
   `merge(replay$, live$, keepAlive$)`; `@Header('X-Accel-Buffering','no')`, `@Header('Cache-Control','no-cache')`;
   resolve the restriction server-side; `live$ = fromEvent(bus.emitter,'audit').pipe(filter(tenant + matches), map(toEvent))`;
   `keepAlive$ = interval(15_000).pipe(map(() => ({ data: '', type: 'ping' })))`.
3. Wire the best-effort `emit`: in the P4 repository (after persist) and/or the interceptor, build an `AuditBusEntry`
   (with `cursor = audit.encodeCursor({ timestamp, id })`) and call `bus.emit(entry)` inside a try/catch that swallows —
   it must NEVER throw back into the delivery path.
4. Two specs to 100%: `audit-event.bus.spec.ts` (matches per field + source facet; replaySince undefined/empty/garbage →
   EMPTY, valid → replayed; fetchSince keyset + matches filtering; toEvent) and `audit-sse.controller.spec.ts` (merge:
   a live entry passing/blocked by restriction; replay merged; keep-alive emits a ping). Each `it()` carries a comment.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every export, English-only, no `any`, no suppression comments.
- FEEDBACK-LOOP GUARD: never write an audit row or access-log from the read/stream path; the `emit` on the write path is
  best-effort and swallows errors.
- The bus is an in-process singleton; add a JSDoc note that production would back it with Redis Streams/Kafka for
  multi-instance fan-out. Timeless code: NO Phase/Task/roadmap references.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/audit/audit-event.bus.spec.ts src/audit/audit-sse.controller.spec.ts --coverage --maxWorkers=2`
  — expected: pass, 100% on both new files.
- (Optional with the stack up): `curl -N -H "Accept: text/event-stream" http://localhost:3001/audit/stream` then trigger
  a `/dispatch` in another shell — expected: a new `id:`-carrying event arrives in the stream.

Completion Protocol:
1. Set 6.4 Status to ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Bump the file-header Progress to `4 / 5` + Last updated to today.
3. Update the P6 row Progress to `4 / 5` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 6.4 ✅ <YYYY-MM-DD> — audit event bus + GET /audit/stream (@Sse live tail)`.
5. Commit: `feat(audit): add SSE live tail with keyset replay` (no Co-Authored-By).
````

---

### Task 6.5 — `GET /audit/aggregate` (time-bucketed) + wire-up

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: M
- **Depends on**: 6.3, 6.4

#### Description

Author `AuditAggregateService` + the `GET /audit/aggregate` handler returning time-bucketed counts by
`verb`/`channel`/`provider` (zero-filled, parameterized SQL), then register the whole `audit/` module (controllers,
service, bus, aggregate) so the three endpoints are reachable end-to-end.

#### Acceptance criteria

- [ ] `apps/api/src/audit/audit-aggregate.service.ts` exports `AuditAggregateService` (`@Injectable`) with a `query(q)`
      that runs a parameterized `$queryRaw` (Prisma `Prisma.sql` tagged template) bucketing `NotificationLog.timestamp` via
      `date_trunc`, grouped by the requested dimension (`verb`/`channel`/`provider`), zero-filled via `generate_series`,
      honouring the time window + tenant restriction + the source facet.
- [ ] `GET /audit/aggregate` (a handler on `AuditController` or a dedicated method) validates
      `AuditAggregateQueryDto` via `ZodValidationPipe`, resolves the tenant restriction server-side, and returns the chart
      series.
- [ ] `apps/api/src/audit/audit.module.ts` declares `AuditController` + `AuditSseController`, provides `AuditReadService`,
      `AuditEventBus`, `AuditAggregateService`, exports `AuditEventBus` (so the P4 write path can inject it to `emit`), and is
      imported by `app.module.ts`.
- [ ] 100% unit-covered for the aggregate service (mock `$queryRaw`: each `groupBy` dimension, the source facet, the
      zero-fill shape) and the aggregate handler.
- [ ] The full local gate passes: `pnpm typecheck && pnpm lint && pnpm test:cov && pnpm audit:exports`.

#### Files to create / modify

- `apps/api/src/audit/audit-aggregate.service.ts`, `apps/api/src/audit/audit-aggregate.service.spec.ts`
- `apps/api/src/audit/audit.controller.ts` (+ spec) — add the `@Get('aggregate')` handler
- `apps/api/src/audit/audit.module.ts`
- `apps/api/src/app.module.ts` (import `AuditModule`)

#### Agent prompt

````
You are a senior NestJS / SQL backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP lib,
multi-tenant, Prisma/Postgres audit log). pnpm monorepo, Node 24, TypeScript 5.9 strict; 100% coverage + audit gates.

CURRENT PHASE: 6 (Audit Read-API (keyset + SSE)) — Task 6.5 of 5 (LAST)

PRECONDITIONS
- Tasks 6.1–6.4 done: `audit/dto/*`, `AuditReadService`, `AuditController` (GET /audit/logs), `AuditEventBus`,
  `AuditSseController` (GET /audit/stream) all exist with 100% coverage. `auditAggregateQuerySchema` + `resolveBucket`
  exist from Task 6.1.
- `app.module.ts` (P3/P4) is where feature modules are imported; `PrismaService` is global or importable.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "15. Audit Log & Delivery Tracking" (the `/audit/aggregate?from&to&tenantId` contract: time-bucketed
  counts by verb/channel/provider for the Overview charts).
- The sibling to copy & adapt (do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/api/src/logs/
  logs.aggregate.service.ts — copy the `$queryRaw` + `date_trunc` + `generate_series` zero-fill pattern and the
  bounded `groupBy` allow-list; re-map to NotificationLog (`timestamp`, group by `verb`/`channel`/`providerName`) and
  apply the source facet. Also re-read your own `audit.controller.ts` (Task 6.3) to add the aggregate handler.

TASK
Author `AuditAggregateService` + the `GET /audit/aggregate` handler, then assemble `audit.module.ts` and import it into
`app.module.ts` so all three endpoints are reachable; 100%-cover the new code; run the full local gate.

DELIVERABLES
1. `apps/api/src/audit/audit-aggregate.service.ts` — `@Injectable AuditAggregateService` with `query(q: AuditAggregateQueryDto
   & AuditRestriction)` running a parameterized `Prisma.sql` `$queryRaw`: `date_trunc(<unit>, "timestamp")` buckets,
   grouped by the requested dimension, COUNT(*) per bucket+dimension, LEFT JOIN against a `generate_series` so buckets are
   zero-filled, WHERE honours the window + tenantId + source facet. Return a typed series array. NEVER string-interpolate
   user input — use tagged-template params; `unit`/`interval` come from `resolveBucket`/the explicit bucket map only.
2. `apps/api/src/audit/audit.controller.ts` — add:
   ```typescript
   @Get('aggregate')
   async aggregate(
     @Headers() headers: Record<string, string>,
     @Query(new ZodValidationPipe(auditAggregateQuerySchema)) q: AuditAggregateQueryDto,
   ) {
     const restriction = /* resolve tenant server-side */
     return this.aggregate.query({ ...q, ...restriction })
   }
   ```
   (inject `AuditAggregateService` into the constructor).
3. `apps/api/src/audit/audit.module.ts` — controllers: [AuditController, AuditSseController]; providers: [AuditReadService,
   AuditEventBus, AuditAggregateService]; exports: [AuditEventBus]. Import `AuditModule` in `apps/api/src/app.module.ts`.
4. Specs to 100%: `audit-aggregate.service.spec.ts` (each groupBy dimension; the source facet; the zero-fill shape; window
   defaulting) and extend `audit.controller.spec.ts` for the aggregate handler. Each `it()` carries a scenario comment.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc on every export, English-only, no `any`, no suppression comments.
- Parameterized SQL ONLY (no PII/codes in the output). Resolve tenant server-side. Group-by is the bounded allow-list
  only — never recipient/cursor/high-cardinality fields. Timeless code: NO Phase/Task/roadmap references.

Verification:
- `pnpm --filter @nest-notification-example/api exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest src/audit --coverage --maxWorkers=2` — expected: pass, 100% on
  every src/audit/*.ts file (excluding *.module.ts / *.dto.ts per the coverage scope).
- `pnpm typecheck && pnpm lint && pnpm test:cov && pnpm audit:exports` — expected: all exit 0.
- (Optional with the stack up): `curl -s "http://localhost:3001/audit/aggregate?from=2026-06-23T00:00:00Z&to=2026-06-23T23:59:59Z"`
  — expected: a JSON series array (zero-filled buckets).

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 6.5 Status to ✅ (block + Task index row); tick the satisfied acceptance checkboxes.
2. Bump the file-header Progress to `5 / 5` + Last updated to today.
3. Update the P6 row Progress to `5 / 5` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 6.5 ✅ <YYYY-MM-DD> — GET /audit/aggregate + audit module wire-up`.
5. Commit: `feat(audit): add GET /audit/aggregate and wire the audit module` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol" + this file's "## Phase Completion Protocol"): once
the PR is merged and CI is green, in docs/DEVELOPMENT_PLAN.md set the **P6 Status to ✅** and **Progress `5 / 5`**, set
**Active phase** to `P7`, recompute **Overall progress** to `6 / 15 phases (40%)`; set this file's header **Status to ✅**;
commit `docs(plan): P6 complete` (no Co-Authored-By).
````

---

## Phase Completion Protocol

When **Task 6.5** is `✅` and every other task is `✅`:

1. Confirm all 5 tasks are `✅` and the P6 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P6`](../DEVELOPMENT_PLAN.md#phase-6--audit-read-api-keyset--sse)
   is met: keyset pagination + stale-cursor 410; SSE live tail emits new rows with resumable `id`s; aggregate returns the
   chart series; the dual-source semantics (service verbs vs interceptor `sent`/`failed`) are documented and
   facet-filterable; 100% covered.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P6 Status** to `✅`, **Progress** `5 / 5`, **Last
   updated** today; set **Active phase** to `P7`; recompute **Overall progress** to `6 / 15 phases (40%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `5 / 5 tasks`.
5. Commit `docs(plan): P6 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P6 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 6.1 ✅ 2026-06-23 — audit query DTOs + indexes + source facet
- 6.2 ✅ 2026-06-23 — audit read service (cursor codec + where builder)
- 6.3 ✅ 2026-06-23 — GET /audit/logs keyset controller (410 on stale)
- 6.4 ✅ 2026-06-23 — audit event bus + GET /audit/stream (@Sse live tail)
