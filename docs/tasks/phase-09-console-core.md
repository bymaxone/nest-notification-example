# Phase 9 — Console Core (Overview · Trigger Center · Explorer)

> **Status**: 🔄 In progress · **Progress**: 4 / 6 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P9
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

Phase 8 produced the **Next.js console shell**: `app/layout.tsx` (Geist + forced dark + Providers), the app shell
(64px topbar / 250px sidebar), the global controls (tenant switcher, role switcher, live toggle) persisted via `nuqs`,
and the `lib/` clients (`api-client`, `sse`, `error-codes` from `./shared`, `severity`). The seven page bodies are still
empty placeholders. Phase 6 produced the backend the console reads: `GET /audit/logs` (keyset, 410 on stale cursor),
`GET /audit/stream` (`@Sse`, `id` = cursor, `Last-Event-ID` resume), and `GET /audit/aggregate` (time-bucketed counts).
Phase 5 produced the feature surface the Trigger Center fires (`/otp/*`, `/email/*`, `/dispatch`, `/channels`,
`/debug/key`).

Phase 9 builds the **three daily-driver surfaces**:

- **Overview** (`/`) — delivery-health charts (send/verify/failure rates, latency-to-sent, provider mix, channel
  badges) fed by `/audit/aggregate`; breakdown panels are click-to-filter, pivoting to the Explorer via the URL.
- **Audit Explorer** (`/explorer`) — a faceted, virtualized table over `/audit/logs` with a **source facet**
  (`providerName === '__interceptor__'` separates "what the service did" from "what the HTTP boundary saw"), a query
  bar, a detail drawer carrying the **never-contains-code proof**, and a **live tail** over `/audit/stream` with
  follow-mode (pinned auto-scroll; scroll-up pauses with an "N new — jump to latest" pill).
- **Trigger Center** (`/trigger`) — a card per feature (send email, generate+verify OTP, trip cooldown, force
  max-attempts, oversize attachment, break audit sink, spoof tenant, dispatch) that fires the backend and
  **auto-pivots the Explorer** to the resulting audit row(s).

When P9 is done, every backend feature is fireable from the Trigger Center and lands a deep-linked audit row; the
Explorer searches/filters/tails-live and renders the never-contains-code proof; web coverage on the new
`lib/` + `components/` is 100%.

The gold sources are the sibling **`nest-logger-example`** `apps/web` files — copy and **adapt** their proven
overview charts, the fire-every-feature trigger grid that auto-pivots the explorer, the faceted virtualized table, and
the SSE follow-mode live tail. The notification domain replaces logger concepts: a row is a `NotificationLog`
(`verb`/`channel`/`provider`/`recipient` masked, **never the code**), the correlation pivot is the row `id` / `verb` /
`recipient` / `purpose` (there is no `traceId`/`requestId`), and the Overview measures delivery health
(send/verify/failure rates) rather than RED/log-volume.

---

## Rules-of-phase

1. **Charts use percentile/rate series** — every series carries colour **+ icon + label** (never colour alone); the
   Overview shows send/verify/failure **rates** and latency-to-sent percentiles, not raw counts only.
2. **Skeletons, not spinners** — loading states render `Skeleton` placeholders; empty states are **action-oriented**
   ("No events yet — fire one from the Trigger Center").
3. **Never the code** — the Explorer detail drawer renders the **never-contains-code proof** as a green check; no view
   ever displays an OTP code, and recipients render masked (`j***@acme.com`) as the API returns them.
4. **`lib/` stays JSX-free** — clients/parsers/types in `lib/`; all rendering in `components/`. Never import the library
   `.` (server) subpath in `apps/web` — only `./shared` (`NotificationChannel`/`OtpPurpose` types,
   `NOTIFICATION_ERROR_CODES`/`DEFAULT_TTLS` values — **no** verb union) and `./react` (hooks). The `verb` union is
   app-local (declared in `lib/types.ts`).
5. **URL is the single source of filter state** — all filter/range/facet state lives in `nuqs` search params so a
   brushed range, a click-to-filter, and a Trigger auto-pivot all land the Explorer pre-filtered and shareable.
6. **Timeless, English-only deliverables** — the **code** these prompts produce carries no `Phase N` / `Task` / plan
   references in comments or identifiers (only doc-section refs like `OVERVIEW.md §15` are allowed). This planning file
   may name phases/tasks freely.
7. **100% web coverage** — every new `lib/**` and `components/**` file ships with a co-located Vitest spec; non-render
   glue is excluded per [§2 Global Conventions](../DEVELOPMENT_PLAN.md#2-global-conventions). Memory-safe: `maxWorkers`
   is `'50%'`; never fan out parallel test agents.
8. **Clean Code sizing** — functions ≤ 50 lines; files ≤ 800 (200–400 typical); SRP per file; explicit DI.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §10 (The Demo Domain & Notification Console — the route table + the console),
  §14 (Ecosystem Fit — the dual-source nuance), §15 (Audit Log & Delivery Tracking — the read API, the two sources,
  the source facet, the live-tail UX), §5 (Repository Layout — the `apps/web` target tree).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P9, §2 Global Conventions, §3 Autonomous Execution Model.
- Sibling gold sources (copy & adapt — do not invent): `~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/`
  — `app/{page.tsx,trigger/page.tsx,explorer/page.tsx}`, `components/{charts,explorer,trigger,controls,common}`,
  `hooks/{use-aggregate.ts,use-facets.ts,use-follow-mode.ts,use-logs.ts}`, `lib/{use-event-source.ts,explorer-link.ts,
trigger-api.ts,api-client.ts}`.
- `/bymax-workflow:standards` skill — universal coding rules.

---

## Task index

| ID  | Task                                                          | Status  | Priority | Size | Depends on |
| --- | ------------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 9.1 | Audit data layer — `lib/` clients, types, hooks, pivot helper | ✅ Done | P0       | M    | —          |
| 9.2 | Overview page — delivery-health charts                        | ✅ Done | P1       | L    | 9.1        |
| 9.3 | Audit Explorer — facets, query bar, virtualized table         | ✅ Done | P0       | L    | 9.1        |
| 9.4 | Live tail — SSE stream + follow-mode                          | ✅ Done | P0       | M    | 9.3        |
| 9.5 | Detail drawer + never-contains-code proof                     | 📋 ToDo | P1       | M    | 9.3        |
| 9.6 | Trigger Center — fire-every-feature grid that auto-pivots     | 📋 ToDo | P0       | L    | 9.1, 9.3   |

---

## Tasks

### Task 9.1 — Audit data layer — `lib/` clients, types, hooks, pivot helper

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Author the JSX-free `lib/` foundation the three surfaces share: the typed `NotificationLog` row + query types, the
audit-API client (`logs` keyset, `aggregate`), the facet derivation, the TanStack-Query hooks, and the Explorer
deep-link builder. This is the data spine every page reads from.

#### Acceptance criteria

- [ ] `lib/types.ts` (or extension) declares `NotificationLog` (`id`, `timestamp` (epoch number, per the P4 Prisma
      model — there is **no** `createdAt` column), `tenantId`, `channel`, `verb`, `provider`/`providerName`,
      `recipient` masked, `purpose`, `locale`, `template`, `status`, `errorCode`, `errorMessage`, `cursor`). Import **only**
      `NotificationChannel` + `OtpPurpose` (types) from `'@bymax-one/nest-notification/shared'`; type `verb` as an
      **app-local** string-literal union in `lib/types.ts` (`./shared` exports no verb union — the verb type
      `NotificationLogVerb` lives on the package root, which `apps/web` must not import). Add `AuditQuery`,
      `AggregateBucket`, and the keyset `PageResult` shapes. **No OTP `code` field exists on the type.**
- [ ] `lib/audit-api.ts` (JSX-free) exposes `fetchLogs(query)` (keyset `?cursor&tenantId&channel&verb&recipient&purpose
&source&limit` → `{ data, nextCursor, hasMore }`; surfaces a stale-cursor **410** as a typed `ApiError`) and
      `fetchAggregate(query)` (`?from&to&tenantId` → bucketed counts by `verb`/`channel`/`provider`). It sends the trusted
      `x-tenant-id` header from the active tenant via the P8 `api-client`.
- [ ] `lib/audit-facets.ts` derives facet value-counts (`channel`, `verb`, `provider`, `purpose`, **`source`** =
      service vs `__interceptor__`) from the current page (or a `/audit/aggregate` field) — stable references, no per-render
      array allocation.
- [ ] `hooks/use-audit-logs.ts` (`useInfiniteQuery`, keyset `getNextPageParam` from `nextCursor`, never OFFSET) +
      `hooks/use-aggregate.ts` (`useQuery` for the charts) + `hooks/use-facets.ts` (facet counts). All keyed by the query.
- [ ] `lib/explorer-link.ts` builds a root-relative `/explorer?…` href from an `ExplorerTarget`
      (`id` / `verb` / `recipient` / `purpose` / `from` / `to` / `range`, default relative `range` = `15m`) reusing the
      exact `nuqs` param names the Explorer reads.
- [ ] Each `lib/**` + `hooks/**` file has a co-located `*.test.ts` at 100%; `pnpm --filter web typecheck` exits 0.

#### Files to create / modify

- `apps/web/lib/types.ts` (extend), `apps/web/lib/audit-api.ts`, `apps/web/lib/audit-facets.ts`,
  `apps/web/lib/explorer-link.ts`
- `apps/web/hooks/use-audit-logs.ts`, `apps/web/hooks/use-aggregate.ts`, `apps/web/hooks/use-facets.ts`
- co-located `*.test.ts` for each

#### Agent prompt

````
You are a senior frontend data-layer engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib). pnpm monorepo, Node 24, TypeScript 5.9 strict; apps/web is Next.js 16 + React 19 + Tailwind 4,
reading apps/api over HTTP. The console is the @bymax-one design system (forced dark, orange glass, Geist).

CURRENT PHASE: 9 (Console Core (Overview, Trigger, Explorer)) — Task 9.1 of 6 (FIRST)

PRECONDITIONS
- P8 done: app shell + global controls (tenant/role/live, nuqs) + the P8 lib/ clients (api-client, sse, error-codes
  from ./shared, severity) exist; the seven page bodies are empty placeholders.
- P6 done (backend): GET /audit/logs (keyset, 410 on stale cursor), GET /audit/stream (@Sse), GET /audit/aggregate.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "15. Audit Log & Delivery Tracking" (the read API shapes, the two sources, the source facet) and
  § "10. The Demo Domain & Notification Console" (the route table + the console controls).
- The gold sources to copy & adapt: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/lib/
  {api-client.ts, explorer-link.ts} and hooks/{use-logs.ts, use-aggregate.ts, use-facets.ts}. Replace logger concepts:
  a row is a NotificationLog (verb/channel/provider/recipient-masked, NO code), the pivot key is id/verb/recipient/
  purpose (there is NO traceId/requestId), the source facet is providerName === '__interceptor__'.

TASK
Build the JSX-free lib/ data spine + the TanStack-Query hooks + the Explorer deep-link builder the three surfaces share.

DELIVERABLES (paths under apps/web, the OVERVIEW §5 tree)
1. `lib/types.ts` (extend) — the NotificationLog row + AuditQuery + AggregateBucket + keyset PageResult. From
   '@bymax-one/nest-notification/shared' import ONLY the type-only `NotificationChannel` + `OtpPurpose` unions.
   './shared' exports NO verb union (the runtime exports there are NOTIFICATION_ERROR_CODES + DEFAULT_TTLS only, and
   the verb type `NotificationLogVerb` lives on the package root — which apps/web must NOT import). So declare `verb`
   as an APP-LOCAL string-literal union right here in lib/types.ts. NO `code` field anywhere on the type.
   ```ts
   import type { NotificationChannel, OtpPurpose } from '@bymax-one/nest-notification/shared';

   // App-local verb union (the './shared' subpath exports no verb type).
   export type NotificationVerb =
     | 'otp_generated' | 'otp_verified' | 'otp_failed' | 'email_sent' | 'email_failed';

   export interface NotificationLog {
     id: string; timestamp: number; tenantId: string;   // timestamp = epoch ms (P4 model has no createdAt column)
     channel: NotificationChannel; verb: NotificationVerb;
     providerName: string;            // '__interceptor__' for boundary rows (the source facet)
     recipient: string;               // already masked by the API (j***@acme.com)
     purpose: OtpPurpose | null; locale: string | null; template: string | null;
     status: 'sent' | 'failed' | 'generated' | 'verified' | string;
     errorCode: string | null; errorMessage: string | null; cursor: string;
   }
   export type AuditSource = 'service' | 'interceptor';
   ```
2. `lib/audit-api.ts` (JSX-free) — `fetchLogs(query)` (keyset; maps a 410 stale-cursor to a typed ApiError) and
   `fetchAggregate(query)` (bucketed by verb/channel/provider). Use the P8 api-client to attach x-tenant-id.
3. `lib/audit-facets.ts` — derive value-counts for channel/verb/provider/purpose/source; STABLE module-level field
   arrays (no per-render allocation).
4. `hooks/use-audit-logs.ts` — `useInfiniteQuery`, `getNextPageParam` = nextCursor (keyset, never OFFSET).
   `hooks/use-aggregate.ts` — `useQuery` for the charts. `hooks/use-facets.ts` — facet counts. Keyed by the query.
5. `lib/explorer-link.ts` — `explorerHref(target)` → `/explorer?…` reusing the Explorer's nuqs param names
   (id/verb/recipient/purpose/from/to/range; default relative range '15m').
6. A co-located `*.test.ts` for every file above, 100% (statements/branches/functions/lines).

Constraints (follow /bymax-workflow:standards):
- TS strict (exactOptionalPropertyTypes, noUncheckedIndexedAccess); zero `any`; zero suppression comments
  (@ts-ignore/eslint-disable). JSDoc on EVERY export (@param/@returns/@throws). English-only, timeless comments — no
  Phase/Task references in the deliverable code (doc-section refs like "OVERVIEW.md §15" are fine).
- lib/ stays JSX-free. Never import the library `.` (server) subpath — only `./shared`, and from it ONLY the
  NotificationChannel/OtpPurpose types + the NOTIFICATION_ERROR_CODES/DEFAULT_TTLS values. './shared' exports NO verb
  union — `verb` is an app-local string-literal union in lib/types.ts. Files ≤ 800 lines, fns ≤ 50.

Verification:
- `pnpm --filter web typecheck` — expected: exit 0.
- `pnpm --filter web exec vitest run lib hooks --coverage` — expected: all green, 100% on the new files.
- `pnpm --filter web lint` — expected: exit 0 (--max-warnings 0).

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 6` and Last updated to today.
4. Update the P9 row Progress to `1 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 9.1 ✅ <YYYY-MM-DD> — audit data layer (lib clients, types, hooks, pivot)`.
6. Commit: `feat(web): audit data layer — clients, types, query hooks, explorer-link` (no Co-Authored-By).
````

---

### Task 9.2 — Overview page — delivery-health charts

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: L
- **Depends on**: 9.1

#### Description

Build the Overview surface: the delivery-health dashboard (send/verify/failure rates, latency-to-sent percentiles,
provider mix, channel badges) fed by `/audit/aggregate`, with breakdown panels that click-to-filter and pivot to the
Explorer via the URL.

#### Acceptance criteria

- [ ] `app/page.tsx` is a thin server shell (`export const dynamic = 'force-dynamic'`) rendering the `'use client'`
      `OverviewContent` inside the `AppShell`.
- [ ] `components/charts/overview-content.tsx` composes top→bottom, general→specific: a **health strip**
      (send/verify/failure rate stat tiles) → **delivery-rate line** (sent vs failed/min) → **latency-to-sent** percentile
      lines (p50/p95/p99) → a **breakdown row** (channel badges, provider mix donut, top purposes, top tenants), each panel
      reading `use-aggregate` / `use-facets` from 9.1.
- [ ] Every chart series carries **colour + icon + label** (a shared `chart-series.ts` legend definition); breakdown
      panels are **click-to-filter**, calling `setQuery(...)` so the click pivots the Explorer via the URL (`explorerHref`
      or a direct nuqs set + nav).
- [ ] Loading renders `Skeleton`, not spinners; the empty state is action-oriented ("No delivery events yet — fire one
      from the Trigger Center" linking `/trigger`).
- [ ] `chart-card.tsx`, `chart-legend.tsx`, `stat-tile.tsx`, `chart-series.ts` (adapted from the sibling) are present;
      every new `components/charts/**` file has a co-located `*.test.tsx` at 100%.

#### Files to create / modify

- `apps/web/app/page.tsx`
- `apps/web/components/charts/{overview-content,health-strip,delivery-rate-line,latency-lines,provider-mix,
channel-badges,top-bar,chart-card,chart-legend,stat-tile}.tsx`, `apps/web/lib/chart-series.ts`
- co-located `*.test.tsx` / `*.test.ts` for each

#### Agent prompt

```
You are a senior frontend dataviz engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is Next.js 16 +
React 19 + Tailwind 4 under the @bymax-one design system (forced dark, orange glass, Geist + mono). Charts are Recharts.
The Overview reads apps/api GET /audit/aggregate over HTTP.

CURRENT PHASE: 9 (Console Core (Overview, Trigger, Explorer)) — Task 9.2 of 6 (MIDDLE)

PRECONDITIONS
- 9.1 done: lib/audit-api.ts (fetchAggregate), hooks/use-aggregate.ts + hooks/use-facets.ts, lib/explorer-link.ts, and
  the NotificationLog/AggregateBucket types exist. The app shell (AppShell) + global controls + nuqs filter state exist
  from P8.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10. The Demo Domain & Notification Console" (the Overview job: send/verify/failure rates, latency-
  to-sent, provider mix, channel badges) and § "15" (what /audit/aggregate returns: bucketed counts by verb/channel/
  provider).
- The gold sources to copy & adapt: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/
  app/page.tsx and components/charts/{overview-content.tsx, chart-card.tsx, chart-legend.tsx, stat-tile.tsx,
  health-strip.tsx, top-bar.tsx} and lib/chart-series.ts. Translate logger→notification: the RED row becomes a
  delivery-rate line (sent vs failed/min) + latency-to-sent percentiles; the breakdown row becomes channel badges +
  provider-mix donut + top purposes + top tenants. There is no log level/volume here.

TASK
Build the Overview delivery-health dashboard: a thin page shell + the OverviewContent composition of charts fed by
/audit/aggregate, with click-to-filter breakdown panels that pivot the Explorer via the URL.

DELIVERABLES (paths under apps/web)
1. `app/page.tsx` — thin server shell, `export const dynamic = 'force-dynamic'`, renders <AppShell><OverviewContent/>.
2. `components/charts/overview-content.tsx` — top→bottom: HealthStrip (send/verify/failure rate tiles) → DeliveryRateLine
   (sent vs failed/min) → LatencyLines (p50/p95/p99 latency-to-sent) → breakdown row (ChannelBadges, ProviderMix donut,
   TopBar "Top purposes", TopBar "Top tenants"). Each panel reads use-aggregate/use-facets; breakdown panels call
   setQuery(...) to pivot the Explorer (click-to-filter).
3. `components/charts/{health-strip,delivery-rate-line,latency-lines,provider-mix,channel-badges,top-bar,chart-card,
   chart-legend,stat-tile}.tsx` — adapted from the sibling; EVERY series carries colour + icon + label.
4. `lib/chart-series.ts` — the legend series definitions (colour + icon + label) for sent/failed/verify + the latency
   percentiles + channel/provider colours.
5. Skeletons (not spinners) for loading; an action-oriented empty state linking /trigger.
6. A co-located *.test.tsx (or .test.ts) for every new file, 100%.

Constraints (follow /bymax-workflow:standards):
- TS strict; zero `any`; zero suppression comments. JSDoc on every export. English-only, timeless — no Phase/Task refs
  in the code. Every chart series = colour + icon + label (never colour alone). Skeletons not spinners; action-oriented
  empty states. Files ≤ 800 lines, fns ≤ 50. lib/chart-series.ts stays JSX-free (icon = component reference is fine).

Verification:
- `pnpm --filter web typecheck` — expected: exit 0.
- `pnpm --filter web exec vitest run components/charts --coverage` — expected: green, 100% on the new files.
- `pnpm --filter web build` — expected: succeeds (the `/` route renders).

Completion Protocol:
1. Set 9.2 Status to ✅ (block + Task index row).
2. Tick the satisfied acceptance checkboxes.
3. Bump the file-header Progress to `2 / 6` + Last updated to today.
4. Update the P9 row Progress to `2 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append: `- 9.2 ✅ <YYYY-MM-DD> — Overview delivery-health charts`.
6. Commit: `feat(web): Overview page — delivery-health charts` (no Co-Authored-By).
```

---

### Task 9.3 — Audit Explorer — facets, query bar, virtualized table

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: 9.1

#### Description

Build the static (non-live) Explorer: a two-pane layout with the faceted left rail (including the **source facet**), a
query bar, and a virtualized, keyset-paginated table of `NotificationLog` rows. Row click selects a row for the drawer
(wired in 9.5). The live tail is added in 9.4.

#### Acceptance criteria

- [ ] `app/explorer/page.tsx` is a thin server shell rendering the `'use client'` `ExplorerContent` in `AppShell`.
- [ ] `components/explorer/explorer-content.tsx` lays out `FacetRail` (left) + `QueryBar` + `LogTable` (right), reading
      the `nuqs` filter state so a brushed range / a Trigger auto-pivot / an Overview click lands here pre-filtered.
- [ ] `components/explorer/facet-rail.tsx` shows value-counts for `channel`, `verb`, `provider`, `purpose`, and the
      **source** facet (`service` vs `__interceptor__`); clicking a value sets a positive filter via the URL; ⌥/Alt-click
      clears that field.
- [ ] `components/explorer/log-table.tsx` is virtualized (TanStack Table v8 headless + TanStack Virtual v3), newest-first,
      with **keyset infinite scroll** (`fetchNextPage` near the bottom, never OFFSET) from `use-audit-logs`. Columns
      (`columns.tsx`): time · channel · verb · recipient (masked) · purpose · provider · status — `verb`/`status` carry a
      severity colour + icon + label. Loading = `Skeleton`; empty = action-oriented ("No events match — widen the range or
      fire one from the Trigger Center").
- [ ] `components/explorer/query-bar.tsx` exposes free-text recipient/purpose search + a clear-all, all via `nuqs`.
- [ ] Row click calls an `onRowClick(row)` prop (the drawer is wired in 9.5); for now it can set local selection state.
- [ ] Every new `components/explorer/**` file + the columns have a co-located `*.test.tsx` at 100%.

#### Files to create / modify

- `apps/web/app/explorer/page.tsx`
- `apps/web/components/explorer/{explorer-content,facet-rail,query-bar,log-table,columns}.tsx`
- co-located `*.test.tsx` for each

#### Agent prompt

```
You are a senior frontend engineer (data grids / virtualization) working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is Next.js 16 +
React 19 + Tailwind 4 under the @bymax-one design system (forced dark). The Explorer reads apps/api GET /audit/logs
(keyset, 410 on stale cursor) over HTTP and renders NotificationLog rows (verb/channel/provider/recipient-masked,
NO code).

CURRENT PHASE: 9 (Console Core (Overview, Trigger, Explorer)) — Task 9.3 of 6 (MIDDLE)

PRECONDITIONS
- 9.1 done: lib/audit-api.ts (fetchLogs keyset), hooks/use-audit-logs.ts (useInfiniteQuery), hooks/use-facets.ts,
  lib/audit-facets.ts, and the NotificationLog/AuditQuery types exist (the `verb` union is the app-local
  NotificationVerb declared in lib/types.ts — do NOT import a verb union from './shared', it exports none). App shell +
  nuqs filter state from P8.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "15. Audit Log & Delivery Tracking" (the read API, the TWO sources — service verbs vs interceptor
  sent/failed — and the source facet `providerName === '__interceptor__'`) and § "10" (the Explorer job: search/filter
  by tenant/channel/verb/recipient/purpose + a source facet, virtualized table).
- The gold sources to copy & adapt: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/
  app/explorer/page.tsx and components/explorer/{explorer-content.tsx, facet-rail.tsx, query-bar.tsx, log-table.tsx,
  columns.tsx}. Translate logger→notification: facets are channel/verb/provider/purpose/SOURCE (not level/service/
  logKey); columns are time/channel/verb/recipient/purpose/provider/status (no traceId/requestId); the source facet is
  service vs __interceptor__. DO NOT port the live-tail wiring here — 9.4 adds it; this task is the static table only.

TASK
Build the two-pane static Explorer: facet rail + query bar + a virtualized, keyset-paginated NotificationLog table.

DELIVERABLES (paths under apps/web)
1. `app/explorer/page.tsx` — thin server shell, `export const dynamic = 'force-dynamic'`, <AppShell><ExplorerContent/>.
2. `components/explorer/explorer-content.tsx` — grid [260px | 1fr]: <FacetRail/> + (<QueryBar/> + <LogTable/>); reads
   nuqs filter state; holds local `selected`/`onRowClick` (drawer wired in 9.5).
3. `components/explorer/facet-rail.tsx` — value-counts for channel/verb/provider/purpose/source; click = positive
   filter via URL; ⌥/Alt-click clears the field. Skeleton while loading.
4. `components/explorer/log-table.tsx` — TanStack Table v8 (headless) + TanStack Virtual v3; newest-first; keyset
   infinite scroll via use-audit-logs (fetchNextPage near bottom, NEVER OFFSET). Skeleton loading; action-oriented
   empty state.
5. `components/explorer/columns.tsx` — time · channel · verb · recipient(masked) · purpose · provider · status; verb +
   status carry colour + icon + label (reuse lib/severity).
6. `components/explorer/query-bar.tsx` — recipient/purpose free-text + clear-all, via nuqs.
7. A co-located *.test.tsx for every new file, 100%.

Constraints (follow /bymax-workflow:standards):
- TS strict; zero `any`; zero suppression comments. JSDoc on every export. English-only, timeless — no Phase/Task refs
  in the code. URL is the single source of filter state (nuqs). NEVER render an OTP code; recipients stay masked as the
  API returns them. Skeletons not spinners; action-oriented empty states. Keyset only (no OFFSET). Files ≤ 800 lines.

Verification:
- `pnpm --filter web typecheck` — expected: exit 0.
- `pnpm --filter web exec vitest run components/explorer --coverage` — expected: green, 100% on the new files.
- `pnpm --filter web build` — expected: succeeds (the `/explorer` route renders, table paginates via keyset).

Completion Protocol:
1. Set 9.3 Status to ✅ (block + Task index row).
2. Tick the satisfied acceptance checkboxes.
3. Bump the file-header Progress to `3 / 6` + Last updated to today.
4. Update the P9 row Progress to `3 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append: `- 9.3 ✅ <YYYY-MM-DD> — Audit Explorer (facets + query bar + virtualized table)`.
6. Commit: `feat(web): Audit Explorer — facets, query bar, virtualized table` (no Co-Authored-By).
```

---

### Task 9.4 — Live tail — SSE stream + follow-mode

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 9.3

#### Description

Add the **live tail**: a same-origin SSE proxy route (`app/api/audit/stream/route.ts`) that forwards the API's
`GET /audit/stream` (attaching the trusted `x-tenant-id` header an `EventSource` cannot set and passing through
`Last-Event-ID`), an SSE client over that proxy (with `Last-Event-ID` resume) and the follow-mode behaviour
(pinned auto-scroll; scroll-up pauses with an "N new — jump to latest" pill), wired into the Explorer when the global
**live toggle** is on and the range is relative.

#### Acceptance criteria

- [ ] `app/api/audit/stream/route.ts` is a Next route handler that proxies the API's `GET /audit/stream` as
      **same-origin SSE** (the `EventSource` consumes `/api/audit/stream`): it forwards the request to apps/api, attaches
      the trusted `x-tenant-id` header from the active tenant (an `EventSource` cannot set headers), passes through the
      inbound `Last-Event-ID`, streams the upstream body back with `Content-Type: text/event-stream` (no buffering), and is
      declared `export const dynamic = 'force-dynamic'` (Node runtime, never statically cached).
- [ ] `lib/use-audit-stream.ts` (JSX-free hook) opens an `EventSource` against the same-origin proxy
      `/api/audit/stream`, coalesces incoming events into a **bounded ring buffer** (drop-oldest) flushed on
      `requestAnimationFrame`, ignores keep-alive `ping` events, relies on the browser's auto-reconnect + `Last-Event-ID`
      (each event `id` = the row's keyset cursor, per §15), exposes `{ rows, connected, failed, clear }`, and auto-stops
      after a long idle.
- [ ] `hooks/use-follow-mode.ts` provides `{ paused, newCount, jumpToLatest, pause, resume }`: pinned-to-bottom
      auto-scrolls on new rows; scrolling up pauses and accumulates `newCount`; `jumpToLatest()` returns to the bottom and
      resumes.
- [ ] `explorer-content.tsx` wires them: when `live && isRelative`, the stream is enabled; live rows append at the
      bottom of `LogTable` (highlighted) via a `liveRows` prop + a shared `scrollRef`; a control bar shows
      Streaming/Connecting/Paused/Failed status + a `N live` count + Pause/Resume/Clear; the "N new — Jump to latest" pill
      appears when paused with `newCount > 0`.
- [ ] When the range is absolute (not relative), the stream is paused with a clear "Paused (absolute range)" status.
- [ ] `app/api/audit/stream/route.ts` + `lib/use-audit-stream.ts` + `hooks/use-follow-mode.ts` have co-located tests at
      100% (the route handler test asserts it attaches `x-tenant-id` + passes through `Last-Event-ID` and returns
      `text/event-stream`; the hook tests mock `EventSource`); the wiring in `explorer-content.tsx`/`log-table.tsx` stays
      covered.

#### Files to create / modify

- `apps/web/app/api/audit/stream/route.ts` (same-origin SSE proxy for `/audit/stream`)
- `apps/web/lib/use-audit-stream.ts`, `apps/web/hooks/use-follow-mode.ts`
- `apps/web/components/explorer/explorer-content.tsx` (wire live tail), `apps/web/components/explorer/log-table.tsx`
  (accept `liveRows` + `scrollRef`)
- co-located `*.test.ts` / `*.test.tsx`

#### Agent prompt

```
You are a senior frontend real-time / streaming engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is Next.js 16 +
React 19 under the @bymax-one design system. The live tail reads apps/api GET /audit/stream (NestJS @Sse; each event's
`id` is the row's keyset cursor so a reconnect resumes from Last-Event-ID, per OVERVIEW §15).

CURRENT PHASE: 9 (Console Core (Overview, Trigger, Explorer)) — Task 9.4 of 6 (MIDDLE)

PRECONDITIONS
- 9.3 done: the static Explorer (explorer-content + log-table + facet-rail + query-bar + columns) renders a keyset-
  paginated NotificationLog table; lib/audit-api + the types + use-audit-logs exist (9.1). The global LIVE toggle
  (nuqs) exists from P8.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "15. Audit Log & Delivery Tracking" (GET /audit/stream: @Sse, event id = keyset cursor, Last-Event-
  ID resume; the follow-mode live-tail UX: pinned auto-scroll, scroll-up pauses with an "N new — jump to latest" pill).
- The gold sources to copy & adapt: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/
  lib/use-event-source.ts (the rAF-flushed bounded ring buffer + EventSource lifecycle), hooks/use-follow-mode.ts (the
  follow-mode state machine), and the live-tail wiring in components/explorer/explorer-content.tsx + the `liveRows`/
  `scrollRef` props in components/explorer/log-table.tsx, and the same-origin SSE proxy route the EventSource consumes.
  Translate logger→notification: rows are NotificationLog, the upstream endpoint is apps/api /audit/stream, and the
  Next route handler app/api/audit/stream/route.ts proxies it as same-origin SSE, attaching the trusted x-tenant-id
  header an EventSource cannot set (the EventSource opens /api/audit/stream, not the API directly).

TASK
Add the SSE live tail (same-origin proxy route + stream hook + follow-mode) and wire it into the Explorer behind the
global live toggle.

DELIVERABLES (paths under apps/web)
1. `app/api/audit/stream/route.ts` — a Next route handler that proxies apps/api's GET /audit/stream as SAME-ORIGIN SSE
   (the EventSource consumes /api/audit/stream). Forward to apps/api, attach the trusted x-tenant-id header from the
   active tenant (an EventSource cannot set headers), pass through the inbound Last-Event-ID, stream the upstream body
   back unbuffered with Content-Type: text/event-stream; `export const dynamic = 'force-dynamic'` (Node runtime).
2. `lib/use-audit-stream.ts` — EventSource against the same-origin proxy /api/audit/stream; coalesce → bounded ring
   buffer (drop-oldest) flushed on requestAnimationFrame; ignore `ping` keep-alives; rely on browser auto-reconnect +
   Last-Event-ID; expose { rows, connected, failed, clear }; auto-stop after a long idle.
3. `hooks/use-follow-mode.ts` — { paused, newCount, jumpToLatest, pause, resume }; pinned auto-scrolls on new rows;
   scroll-up pauses + accumulates newCount; jumpToLatest returns to bottom + resumes.
4. `components/explorer/explorer-content.tsx` — enable the stream when `live && isRelative`; pass `liveRows` +
   `scrollRef` to LogTable; render the control bar (Streaming/Connecting/Paused (absolute range)/Failed + `N live`
   count + Pause/Resume/Clear) and the "N new — Jump to latest" pill when paused with newCount > 0.
5. `components/explorer/log-table.tsx` — accept `liveRows` (append at the bottom, highlighted) + a shared `scrollRef`.
6. Co-located *.test.ts(x) for the proxy route (assert it sets x-tenant-id, passes Last-Event-ID through, returns
   text/event-stream) + the stream hook + follow-mode (mock `EventSource` + a fake rAF), 100%; keep the wiring covered.

Constraints (follow /bymax-workflow:standards):
- TS strict; zero `any`; zero suppression comments. JSDoc on every export. English-only, timeless — no Phase/Task refs
  in the code. lib/use-audit-stream.ts stays JSX-free. The ring buffer must be bounded (a high-rate stream never freezes
  the tab). NEVER render an OTP code; live rows are masked NotificationLog rows. Files ≤ 800 lines, fns ≤ 50.

Verification:
- `pnpm --filter web typecheck` — expected: exit 0.
- `pnpm --filter web exec vitest run app/api/audit/stream lib/use-audit-stream hooks/use-follow-mode components/explorer
  --coverage` — expected: green, 100% on the new + touched files.
- `pnpm --filter web build` — expected: succeeds (the EventSource consumes /api/audit/stream; turning the live toggle on
  tails new rows; scroll-up shows the pill).

Completion Protocol:
1. Set 9.4 Status to ✅ (block + Task index row).
2. Tick the satisfied acceptance checkboxes.
3. Bump the file-header Progress to `4 / 6` + Last updated to today.
4. Update the P9 row Progress to `4 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append: `- 9.4 ✅ <YYYY-MM-DD> — SSE live tail (same-origin proxy route + stream hook + follow-mode)`.
6. Commit: `feat(web): Explorer live tail — SSE stream + follow-mode` (no Co-Authored-By).
```

---

### Task 9.5 — Detail drawer + never-contains-code proof

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: M
- **Depends on**: 9.3

#### Description

Build the row detail drawer: a tabbed inspector (Overview / Raw entry / Proof) opened on row click, where the **Proof**
tab renders the never-contains-code green check (`JSON.stringify(row)` does not contain any OTP code) and every field
offers a "filter for" pivot. Wire it into `ExplorerContent`.

#### Acceptance criteria

- [ ] `components/explorer/detail-drawer.tsx` opens on row click (Dialog) and shows tabs: **Overview** (each scalar
      field with a "filter for" pivot that sets the `nuqs` query), **Raw entry** (the full, already-masked
      `NotificationLog` JSON — there is **no** unmask and **no** code field to reveal), and **Proof**.
- [ ] The **Proof** tab renders the never-contains-code check: it asserts the serialized row carries no OTP code (the
      code lives only in the TTL store, never in the audit log) and renders a green check + the explanation; the recipient
      is shown masked, mirroring `OVERVIEW.md §13`/§15.
- [ ] Row `verb`/`status` render with their severity colour + icon + label; an `errorCode`/`errorMessage` (when present)
      is shown with its localized label from `./shared` error codes.
- [ ] `explorer-content.tsx` wires `selected` + `drawerOpen` so `onRowClick` opens the drawer; closing clears selection.
- [ ] `detail-drawer.tsx` has a co-located `*.test.tsx` at 100% covering the proof path, the masked-raw path, and each
      "filter for" pivot.

#### Files to create / modify

- `apps/web/components/explorer/detail-drawer.tsx`
- `apps/web/components/explorer/explorer-content.tsx` (wire `selected`/drawer)
- co-located `*.test.tsx`

#### Agent prompt

```
You are a senior frontend engineer (component design / accessibility) working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is Next.js 16 +
React 19 under the @bymax-one design system (forced dark). A core teaching point: the audit log NEVER contains the OTP
code and renders recipients masked (OVERVIEW §13/§15) — the detail drawer proves it.

CURRENT PHASE: 9 (Console Core (Overview, Trigger, Explorer)) — Task 9.5 of 6 (MIDDLE)

PRECONDITIONS
- 9.3 done: the Explorer (explorer-content + log-table) renders a NotificationLog table and exposes an `onRowClick`/
  `selected` seam. The NotificationLog type + lib/severity + the ./shared error-code localization (from P8) exist.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "13. Multi-Tenant Security & Recipient Privacy" (the never-log-codes invariant + maskRecipient —
  the drawer renders the proof as a green check; getStatus never returns the code) and § "15" (the detail drawer
  includes the no-code-present proof).
- The gold source to copy & adapt: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/
  components/explorer/detail-drawer.tsx (the tabbed Dialog inspector + the per-field "filter for" pivots + the
  already-redacted Raw JSON with no unmask). Translate logger→notification: tabs are Overview / Raw entry / PROOF (not
  Context/Trace — there is no traceId here); the Proof tab asserts JSON.stringify(row) contains no OTP code and renders
  the green check; fields pivot on verb/recipient/purpose/channel/provider.

TASK
Build the row detail drawer with the never-contains-code Proof tab and wire it into the Explorer.

DELIVERABLES (paths under apps/web)
1. `components/explorer/detail-drawer.tsx` — Dialog with tabs:
   - Overview: each scalar field with a "filter for" pivot (sets the nuqs query); verb/status carry colour + icon +
     label; an errorCode shows its localized ./shared label.
   - Raw entry: the full, already-masked NotificationLog JSON — NO unmask, NO code field exists to reveal.
   - Proof: render the never-contains-code check — assert no OTP code appears in the serialized row, show a green check
     + a one-line explanation ("the code lives only in the TTL-bound store, never in the audit log"); show the masked
     recipient.
2. `components/explorer/explorer-content.tsx` — wire `selected` + `drawerOpen`; `onRowClick` opens, closing clears.
3. A co-located *.test.tsx at 100% covering: the proof green-check path, the masked-raw path, and each "filter for"
   pivot.

Constraints (follow /bymax-workflow:standards):
- TS strict; zero `any`; zero suppression comments. JSDoc on every export. English-only, timeless — no Phase/Task refs
  in the code. NEVER render or reconstruct an OTP code; the Raw tab shows the masked row as-is (no unmask control).
  Skeletons not spinners. Accessible Dialog (focus trap, labelled). Files ≤ 800 lines, fns ≤ 50.

Verification:
- `pnpm --filter web typecheck` — expected: exit 0.
- `pnpm --filter web exec vitest run components/explorer/detail-drawer --coverage` — expected: green, 100%.
- `pnpm --filter web build` — expected: succeeds (clicking a row opens the drawer; Proof shows the green check).

Completion Protocol:
1. Set 9.5 Status to ✅ (block + Task index row).
2. Tick the satisfied acceptance checkboxes.
3. Bump the file-header Progress to `5 / 6` + Last updated to today.
4. Update the P9 row Progress to `5 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append: `- 9.5 ✅ <YYYY-MM-DD> — detail drawer + never-contains-code proof`.
6. Commit: `feat(web): Explorer detail drawer + never-contains-code proof` (no Co-Authored-By).
```

---

### Task 9.6 — Trigger Center — fire-every-feature grid that auto-pivots

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 9.1, 9.3

#### Description

Build the Trigger Center: a card per backend feature (send email, generate+verify OTP, trip cooldown, force
max-attempts, oversize attachment, break audit sink, spoof tenant, dispatch) that fires the endpoint and, on success,
reveals a "View in Explorer →" deep-link that **auto-pivots** the Explorer to the resulting audit row(s). This is the
last task — it also runs the per-phase closeout.

#### Acceptance criteria

- [ ] `app/trigger/page.tsx` is a thin server shell rendering the `'use client'` `TriggerGrid` in `AppShell` with a
      header + a one-line "fire each feature, then jump to the Explorer" description.
- [ ] `lib/trigger-api.ts` (JSX-free) wraps the demo endpoints (`/email/send`, `/email/send-template` incl. the
      oversize-attachment path, `/otp/generate`, `/otp/verify`, `/otp/resend` for the cooldown, repeated `/otp/verify` for
      max-attempts, `/dispatch` incl. the spoof-tenant forged-body path, the break-audit-sink demo) and returns a typed
      `TriggerResult` carrying the audit pivot key (`id` / `verb` / `recipient` / `purpose`) — never an OTP code.
- [ ] `components/trigger/trigger-grid.tsx` declares one descriptor per feature: title, "Demonstrates" line, endpoint
      badge, the **fire** action, and an `explorerTarget(result, firedAtMs)` that builds the deep-link via 9.1's
      `explorerHref`. `isExpectedError` cards (cooldown 429, max-attempts 429, oversize 413, broken-sink 500) treat the
      error status as the expected outcome, not a failure toast.
- [ ] `components/trigger/trigger-card.tsx` is presentational + local fire state: Fire button → loading → toast outcome
      → on success reveal the correlation summary + "View in Explorer →" linking the deep-link (relative `range` so the
      just-fired row is in-window).
- [ ] Spoof-tenant card posts a forged `payload.tenantId` to `/dispatch` alongside the trusted `x-tenant-id` header and
      links to the row showing the **resolver** tenant (proving the anti-spoof, per §13).
- [ ] Every new `lib/trigger-api.ts` + `components/trigger/**` file has a co-located test at 100%.

#### Files to create / modify

- `apps/web/app/trigger/page.tsx`
- `apps/web/lib/trigger-api.ts`, `apps/web/components/trigger/{trigger-grid,trigger-card}.tsx`
- co-located `*.test.ts` / `*.test.tsx`

#### Agent prompt

```
You are a senior frontend product engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is Next.js 16 +
React 19 under the @bymax-one design system (forced dark). The Trigger Center fires apps/api demo endpoints (/email/*,
/otp/*, /dispatch, /channels) and deep-links each result into the Explorer.

CURRENT PHASE: 9 (Console Core (Overview, Trigger, Explorer)) — Task 9.6 of 6 (LAST)

PRECONDITIONS
- 9.1 done: lib/explorer-link.ts (explorerHref + ExplorerTarget) + the api-client + types exist.
- 9.3 done: the Explorer reads the nuqs filter state and lands pre-filtered from a deep-link.
- P5 done (backend): /otp/{generate,verify,resend,consume} + /otp/status; /email/{send,send-template} (+ oversize
  attachment → 413); /dispatch (façade) + /channels; /debug/key. /audit/stream emits the resulting rows.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10. The Demo Domain & Notification Console" (the route table + the Trigger Center job: fire every
  feature, each auto-pivoting the Explorer to the resulting row) and § "13" (the spoof-tenant anti-spoof: a forged
  payload.tenantId on /dispatch is overridden by the resolver in the audit row) and § "16" (the journeys the cards map
  to: first email, register+verify OTP, wrong-code lockout, resend cooldown, XSS escape, multi-tenant spoof, dispatch).
- The gold sources to copy & adapt: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/
  app/trigger/page.tsx and components/trigger/{trigger-grid.tsx, trigger-card.tsx} and lib/trigger-api.ts. Translate
  logger→notification: a descriptor's outcome is a TriggerResult carrying the audit pivot key (id/verb/recipient/
  purpose — there is NO traceId/requestId/logKey), explorerTarget builds the deep-link via explorerHref (9.1), and the
  cards fire /email//otp//dispatch (not log endpoints). NEVER surface an OTP code in a TriggerResult or a toast.

TASK
Build the Trigger Center grid + cards that fire each feature and auto-pivot the Explorer to the resulting audit row(s).

DELIVERABLES (paths under apps/web)
1. `app/trigger/page.tsx` — thin server shell, `export const dynamic = 'force-dynamic'`, header + description +
   <AppShell><TriggerGrid/>.
2. `lib/trigger-api.ts` (JSX-free) — typed wrappers for: send email, send-template, oversize-attachment (413),
   generate OTP, verify OTP, resend (cooldown 429), force max-attempts (repeat verify → 429), break audit sink (500),
   spoof tenant (forged payload.tenantId on /dispatch), dispatch. Each returns a TriggerResult { pivot key, status,
   firedAtMs } — NEVER a code.
3. `components/trigger/trigger-grid.tsx` — one descriptor per feature (title, "Demonstrates", endpoint badge, fire,
   explorerTarget via explorerHref). Mark cooldown/max-attempts/oversize/broken-sink as `isExpectedError` so their 4xx/
   5xx is the expected outcome.
4. `components/trigger/trigger-card.tsx` — presentational + local fire state: Fire → loading → toast → reveal the
   correlation summary + "View in Explorer →" deep-link (relative range so the just-fired row is in-window).
5. A co-located *.test.ts(x) for every new file, 100% (incl. the spoof-tenant resolver-override assertion).

Constraints (follow /bymax-workflow:standards):
- TS strict; zero `any`; zero suppression comments. JSDoc on every export. English-only, timeless — no Phase/Task refs
  in the code. lib/trigger-api.ts stays JSX-free. NEVER place an OTP code in a TriggerResult, a toast, or a deep-link.
  Spoof-tenant must keep the trusted x-tenant-id header (only the body tenantId is forged). Files ≤ 800 lines, fns ≤ 50.

Verification:
- `pnpm --filter web typecheck` — expected: exit 0.
- `pnpm --filter web exec vitest run lib/trigger-api components/trigger --coverage` — expected: green, 100%.
- `pnpm --filter web build` — expected: succeeds (firing a card lands a deep-link that opens the Explorer pre-filtered
  on the new row).
- `pnpm --filter web test:cov` — expected: 100% on all P9 lib/ + components/.

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 9.6 Status to ✅ (block + Task index row).
2. Tick the satisfied acceptance checkboxes.
3. Bump the file-header Progress to `6 / 6` + Last updated to today.
4. Update the P9 row Progress to `6 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append: `- 9.6 ✅ <YYYY-MM-DD> — Trigger Center grid (fire every feature, auto-pivot Explorer)`.
6. Commit: `feat(web): Trigger Center — fire-every-feature grid that auto-pivots the Explorer` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"; run once the PR is merged + CI green):
- In docs/DEVELOPMENT_PLAN.md set the P9 Status to ✅ and Progress `6 / 6`; advance Active phase to P10; recompute
  Overall progress to `9 / 15 phases (60%)`. Set this file's header Status to ✅ and Progress `6 / 6 tasks`. Commit
  `docs(plan): P9 complete` (no Co-Authored-By).
```

---

## Phase Completion Protocol

When **Task 9.6** is `✅` and every other task is `✅`:

1. Confirm all 6 tasks are `✅` and the P9 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P9`](../DEVELOPMENT_PLAN.md#phase-9--console-core-overview--trigger-center--explorer)
   is met: every backend feature is fireable from the Trigger Center and auto-pivots to its audit row; the Explorer
   searches/filters (incl. the source facet), tails live, and renders the never-contains-code proof; 100% web coverage
   on the new `lib/` + `components/`.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P9 Status** to `✅`, **Progress** `6 / 6`, **Last
   updated** today; set **Active phase** to `P10`; recompute **Overall progress** to `9 / 15 phases (60%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `6 / 6 tasks`.
5. Commit `docs(plan): P9 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P9 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 9.1 ✅ 2026-06-23 — audit data layer (lib clients, types, hooks, pivot)
- 9.2 ✅ 2026-06-23 — Overview delivery-health charts (latency panel omitted — no duration data in the audit model)
- 9.3 ✅ 2026-06-23 — Audit Explorer (facets + query bar + virtualized table)
- 9.4 ✅ 2026-06-23 — SSE live tail (same-origin proxy route + stream hook + follow-mode)
