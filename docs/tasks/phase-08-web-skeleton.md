# Phase 8 — Web Skeleton & Design System

> **Status**: ✅ Done · **Progress**: 6 / 6 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P8
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

The backend is complete through P7: `apps/api` exposes the full HTTP surface — `/otp/*`, `/email/*`, `/dispatch`,
`/channels`, `/debug/key`, `/audit/{logs,stream,aggregate}` (keyset + SSE), and `/admin/try-configure-*` — all
multi-tenant (trusted `x-tenant-id`), masked-audited, and 100%-covered. There is **no `apps/web` yet**: P0 deliberately
deferred the design-system _web_ files (they need `apps/web`), keeping only `docs/design_system.html` as the reference.

Phase 8 produces the **Next.js console shell** under the shared Bymax design system, ready for pages to be filled in
from P9 onward. It scaffolds `apps/web` (Next 16 + React 19 + Tailwind 4), copies the design-system files **verbatim**
from `nest-logger-example` (forced dark, orange glass, Geist + Geist Mono — never re-styled), builds the app chrome
(64px topbar / 250px sidebar with the seven notification destinations), wires the global controls (tenant switcher,
role switcher, live toggle) into URL state via `nuqs`, and lays down the JSX-free `lib/` clients (`api-client`, the SSE
hook, the `error-codes` catalog from `./shared`, `severity`, `utils`). When P8 is done, `pnpm --filter web build`
succeeds — `next build` resolves the library's `./react` + `./shared` subpaths — every route renders the shell with a
placeholder body, and the global controls drive shareable deep-link URL state. **No page bodies are written here**
(charts, the Trigger Center, the Explorer, the OTP panel are P9/P10); the routes render the shell + an empty-state stub.

The gold source for every design-system file and shell component is the sibling `nest-logger-example/apps/web` — copy
the design-system files **byte-for-byte** and copy-and-**adapt** the shell/controls/lib clients to the notification
domain (notification destinations, `x-tenant-id` header, the `/audit/stream` SSE route, the `./shared` error catalog).

---

## Rules-of-phase

1. **Design system is verbatim** — `app/globals.css`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs`,
   and `components/ui/*` are copied **byte-identical** from `nest-logger-example/apps/web`. Never re-style, re-token,
   or "improve" them. A diff against the sibling for those files must be empty.
2. **`lib/` is JSX-free** — the `lib/` clients (`api-client`, the SSE hook, `error-codes`, `severity`, `utils`) contain
   no JSX and no React component code; they are pure TypeScript modules importable from server or client.
3. **Never import the library `.` (server) subpath in `apps/web`** — the browser bundle uses **only** the isomorphic
   `@bymax-one/nest-notification/shared` and `@bymax-one/nest-notification/react` subpaths. A `.`-root import is a
   blocker.
4. **Overlays render above the topbar** — modal/dropdown/sheet layers use a z-index above the fixed 64px topbar
   (the topbar is `z-200`); nothing the shell renders may sit under it.
5. **No page bodies** — routes render `<AppShell>` + a placeholder empty-state only. Charts, tables, the Trigger
   Center, OTP panel, and provider matrix are P9/P10. Do not pull in Recharts/TanStack Table data wiring here.
6. **Timeless, English-only deliverables** — the code you write carries **no** `Phase N` / `Task` / roadmap-stage
   references in comments or JSDoc (this planning file may name phases; the shipped source may not). JSDoc on every
   export; TS strict; zero `any`; no suppression comments (`@ts-ignore`, `eslint-disable`).
7. **Single React instance** — `next.config.ts` sets `transpilePackages: ['@bymax-one/nest-notification']`; React must
   not be duplicated (an "invalid hook call" from `useOtpInput` is the symptom). Verify `next build` resolves both
   subpaths.
8. **Versions** — Next.js 16.2.x, React 19, Tailwind 4.3, Geist, pnpm 11.x, Node 24, per [`OVERVIEW.md §4`](../OVERVIEW.md#4-tech-stack).

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §10 (the console IA: seven destinations + global controls), §4 (web stack), §5
  (the `apps/web` tree), §7 (consuming `./react` + `./shared` in Next.js: `transpilePackages`, single React).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P8, §2 Global Conventions, §3 Autonomous Execution Model.
- `docs/design_system.html` — the mandatory verbatim design-system reference (forced dark, orange glass, Geist + mono).
- Sibling gold source (copy / adapt): `~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/` —
  `{package.json, next.config.mjs, tsconfig.json, postcss.config.mjs, tailwind.config.ts, components.json}`,
  `app/{layout.tsx, globals.css, providers.tsx, page.tsx}`, `components/layout/{app-shell,topbar,sidebar}.tsx`,
  `components/ui/*`, `components/controls/{tenant-role-switcher,live-toggle}.tsx`,
  `lib/{utils,api-client,use-event-source,severity}.ts`.
- `/bymax-workflow:standards` skill — universal coding rules.

---

## Task index

| ID  | Task                                                                                                             | Status | Priority | Size | Depends on    |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------ | -------- | ---- | ------------- |
| 8.1 | `apps/web` scaffold (Next 16 + React 19 + Tailwind 4)                                                            | ✅     | P0       | M    | —             |
| 8.2 | Verbatim design system (`globals.css` + config + `components/ui/*`)                                              | ✅     | P0       | M    | 8.1           |
| 8.3 | App shell — `layout` · `providers` · topbar · sidebar                                                            | ✅     | P0       | M    | 8.2           |
| 8.4 | Global controls — tenant / role / live + `nuqs` URL state                                                        | ✅     | P1       | M    | 8.3           |
| 8.5 | `lib/` clients (`utils` · `api-client` · `sse` · `error-codes` · `severity`) + finalize `audit-error-codes` gate | ✅     | P0       | M    | 8.1           |
| 8.6 | Route placeholders + build/parity verification (closeout)                                                        | ✅     | P1       | S    | 8.3, 8.4, 8.5 |

---

## Tasks

### Task 8.1 — `apps/web` scaffold (Next 16 + React 19 + Tailwind 4)

- **Status**: ✅
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Create the `apps/web` package: the Next.js 16 + React 19 + Tailwind 4 dependency set (including the
`@bymax-one/nest-notification` workspace `file:` dependency — `apps/web` is created here), the workspace scripts, the
`next.config.ts` that transpiles the library (`transpilePackages: ['@bymax-one/nest-notification']`, moved here from
P2.1 now that `apps/web` exists → a single React instance), and the TypeScript / PostCSS config — so the empty web app
installs, typechecks, and produces a clean (empty) `next build` that resolves the library's `./react` + `./shared`
subpaths.

#### Acceptance criteria

- [ ] `apps/web/package.json` — `"name": "web"`, `private`, `"type": "module"`, `engines.node >=24`; the runtime deps
      (`next ^16.2`, `react ^19`, `react-dom ^19`, `@bymax-one/nest-notification` via the workspace `file:` reference,
      `nuqs ^2`, `@tanstack/react-query ^5`, `clsx`, `tailwind-merge`, `class-variance-authority`, `geist`, `lucide-react`,
      `sonner`, `zod ^4`, the `@radix-ui/*` primitives used by `components/ui/*`); dev deps
      (`tailwindcss ^4.2`, `@tailwindcss/postcss`, `eslint-config-next`, `@types/{node,react,react-dom}`); scripts
      `dev` (`next dev --port 3003`), `build`, `start`, `typecheck`, `lint`, `test`/`test:cov` placeholders.
- [ ] `apps/web/next.config.ts` — `transpilePackages: ['@bymax-one/nest-notification']` (moved here from P2.1, since
      `apps/web` is created in this task), `poweredByHeader: false`, `output: 'standalone'` + `outputFileTracingRoot` at
      the monorepo root, the security-headers block (CSP `connect-src` includes `NEXT_PUBLIC_API_URL`'s origin for the
      audit fetch + same-origin for the SSE proxy).
- [ ] `apps/web/tsconfig.json` extends `../../tsconfig.base.json`, `jsx: preserve`, `moduleResolution: bundler`,
      `paths: { "@/*": ["./*"] }`, the `next` TS plugin; `apps/web/postcss.config.mjs` loads `@tailwindcss/postcss`.
- [ ] `pnpm install` resolves; `pnpm --filter web typecheck` exits 0; `pnpm --filter web build` succeeds (empty app)
      and resolves the library's `./react` + `./shared` subpaths (no "Module not found" for either subpath).

#### Files to create / modify

- `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/postcss.config.mjs`
- `apps/web/next-env.d.ts` (generated by `next`); root `pnpm-lock.yaml` (updated install)

#### Agent prompt

```
You are a senior Next.js / build-tooling engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib: multi-tenant, pluggable providers/storage, audit log, React hooks). pnpm monorepo (apps/api NestJS +
apps/web Next.js 16/React 19), Node 24, TypeScript 5.9 strict, 100% coverage + Stryker ≥ 95 bar.

CURRENT PHASE: 8 (Web Skeleton & Design System) — Task 8.1 of 6 (FIRST)

PRECONDITIONS
- P0–P7 done: the workspace, toolchain, CI, and the full apps/api HTTP surface exist. apps/web does NOT exist yet.
- The library is consumed via `file:../../../nest-notification` (P2 wired it for apps/api; you add the apps/web ref now —
  apps/web is created in THIS task, so the `transpilePackages: ['@bymax-one/nest-notification']` setting also lands here,
  moved out of P2.1 which had no apps/web to host it).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "4. Tech Stack" (web versions) + § "7 … Consuming the ./react + ./shared subpaths in Next.js"
  (transpilePackages + single-React rule) + § "5 Repository Layout" (the apps/web tree + NEXT_PUBLIC_API_URL).
- docs/DEVELOPMENT_PLAN.md § "Phase 8 — Web Skeleton & Design System".
- Sibling files (copy & ADAPT, do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/
  {package.json, next.config.mjs, tsconfig.json, postcss.config.mjs}. Re-verify Next 16 config via context7 if unsure.

TASK
Scaffold the apps/web package (deps + scripts + next/ts/postcss config) so the empty web app installs, typechecks, and
builds — with the library transpiled and a single React instance.

DELIVERABLES
1. `apps/web/package.json` — mirror the sibling's, then ADAPT: name "web"; add the `@bymax-one/nest-notification`
   workspace `file:` dependency (`file:../../../nest-notification` — this is the apps/web library ref, the web
   counterpart of the apps/api ref P2 added); drop logger-only deps (recharts/table/virtual stay OUT until P9 — include
   only what the shell needs now: next, react, react-dom, @bymax-one/nest-notification (file: workspace ref), nuqs,
   @tanstack/react-query, clsx, tailwind-merge, class-variance-authority, geist, lucide-react, sonner, zod, and the
   @radix-ui/* primitives that components/ui/* import); dev deps tailwindcss + @tailwindcss/postcss + eslint-config-next
   + @types/*; scripts dev `next dev --port 3003`, build, start, typecheck `tsc --noEmit`,
   lint `eslint app components lib`, test:cov placeholder.
2. `apps/web/next.config.ts` — copy next.config.mjs's structure (rename to .ts); keep
   `transpilePackages: ['@bymax-one/nest-notification']` (this is the setting MOVED out of P2.1 — P2.1 had no apps/web,
   so the transpile of the library for the browser bundle is wired here, where apps/web is born; a single React
   instance), poweredByHeader false, output standalone + outputFileTracingRoot at '../../', and the security-headers/CSP
   block with connect-src = ["'self'", origin(NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')].
3. `apps/web/tsconfig.json` — extends ../../tsconfig.base.json; jsx preserve, module esnext, moduleResolution bundler,
   lib ES2023+DOM, paths @/* → ./*, plugins [{ name: 'next' }]; include next-env.d.ts + **/*.ts(x) + .next/types.
4. `apps/web/postcss.config.mjs` — `{ plugins: { '@tailwindcss/postcss': {} } }`.

Constraints:
- Follow /bymax-workflow:standards: TS strict, JSDoc/@fileoverview on every module, English-only, no suppression comments.
- Timeless code/comments — NO Phase/Task references in any shipped file. Do NOT pre-create empty dirs / .gitkeep.
- Run `pnpm install` (no --frozen-lockfile, since package.json changed) then commit the updated lockfile.

Verification:
- `pnpm install` — expected: resolves, updates pnpm-lock.yaml (the apps/web `@bymax-one/nest-notification` file: ref links).
- `pnpm --filter web typecheck` — expected: exit 0.
- `pnpm --filter web build` — expected: a clean `next build` of the empty app (no routes yet → trivial, exit 0); it must
  resolve the library's `./react` + `./shared` subpaths — no "Module not found: @bymax-one/nest-notification/{react,shared}".
- `grep -R "transpilePackages" apps/web/next.config.ts` — expected: the library name present.
- `node -e "import('@bymax-one/nest-notification/shared');import('@bymax-one/nest-notification/react')"` run from apps/web
  — expected: both subpaths resolve (sanity that the file: link exposes ./react + ./shared to the web build).

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 6` and Last updated to today.
4. Update the P8 row Progress to `1 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 8.1 ✅ <YYYY-MM-DD> — apps/web scaffold (Next 16 + React 19 + Tailwind 4)`.
6. Commit: `chore(web): scaffold apps/web (next 16 + react 19 + tailwind 4)` (no Co-Authored-By).
```

---

### Task 8.2 — Verbatim design system (`globals.css` + config + `components/ui/*`)

- **Status**: ✅
- **Priority**: P0
- **Size**: M
- **Depends on**: 8.1

#### Description

Copy the shared Bymax design system into `apps/web` **byte-for-byte** from `nest-logger-example`: the Tailwind 4 theme
(`globals.css`), the bridged `tailwind.config.ts`, the shadcn `components.json`, and the `components/ui/*` primitives.
This is a pure copy — no re-styling, no token edits.

#### Acceptance criteria

- [ ] `apps/web/app/globals.css` is **byte-identical** to the sibling's (the `@import 'tailwindcss'`, `@config`,
      `@custom-variant dark`, the `:root` / `.dark` token blocks, the orange-glass utilities, the glow keyframes).
- [ ] `apps/web/tailwind.config.ts` is byte-identical (keyframes/animation only — `glow-float`, `glow-drift`, `fade-in`).
- [ ] `apps/web/components.json` is byte-identical (`new-york`, `rsc`, `cssVariables`, the `@/` aliases, `lucide`).
- [ ] `apps/web/components/ui/*` are byte-identical copies of every primitive the shell + controls use (at least
      `button`, `card`, `badge`, `select`, `dropdown-menu`, `dialog`, `popover`, `tooltip`, `skeleton`, `sonner`, `tabs`,
      `scroll-area`, `input`, `label`, `avatar`, `command`, `table`).
- [ ] `pnpm --filter web typecheck` exits 0; a `diff -r` of those files against the sibling reports no differences.

#### Files to create / modify

- `apps/web/app/globals.css`, `apps/web/tailwind.config.ts`, `apps/web/components.json`
- `apps/web/components/ui/*.tsx` (the primitives listed above)

#### Agent prompt

```
You are a senior design-system / front-end engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. pnpm monorepo, apps/web is
Next.js 16 + React 19 + Tailwind 4 under the shared Bymax design system (forced dark, orange glass, Geist + Geist Mono).

CURRENT PHASE: 8 (Web Skeleton & Design System) — Task 8.2 of 6 (MIDDLE)

PRECONDITIONS
- Task 8.1 done: apps/web installs/typechecks/builds with Tailwind 4 + @tailwindcss/postcss wired; components.json's
  @/ aliases resolve via tsconfig paths.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10 … The console (apps/web)" (the forced-dark / orange-glass / Geist design language) and the
  § "2. Global Conventions" "Design system" row ("copied verbatim … never re-styled").
- docs/design_system.html — the canonical visual reference (open it to confirm parity; do NOT re-derive tokens from it,
  the CSS copy IS the source of truth).
- Sibling files to COPY BYTE-FOR-BYTE: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/
  {app/globals.css, tailwind.config.ts, components.json} and components/ui/*.tsx.

TASK
Copy the design system into apps/web verbatim — the Tailwind theme, the bridged config, components.json, and every
components/ui primitive. No re-styling.

DELIVERABLES
1. `apps/web/app/globals.css` — byte-identical copy of the sibling's globals.css.
2. `apps/web/tailwind.config.ts` — byte-identical copy (keyframes/animation only).
3. `apps/web/components.json` — byte-identical copy (new-york, rsc, @/ aliases, lucide).
4. `apps/web/components/ui/*.tsx` — byte-identical copies of every primitive the shell/controls/lib need:
   button, card, badge, select, dropdown-menu, dialog, popover, tooltip, skeleton, sonner, tabs, scroll-area, input,
   label, avatar, command, table. (Each imports `@/lib/utils`'s `cn`, added in Task 8.5 — typecheck passes once 8.5
   lands; if you run typecheck before 8.5, the `cn` import is the only expected unresolved symbol.)

Constraints:
- VERBATIM. Do NOT change tokens, class names, colours, radii, or fonts. A `diff` against the sibling MUST be empty for
  every copied file. Do not add JSDoc/comments to these copied files (that would break byte-parity) — they already
  carry the sibling's @fileoverview.
- Follow /bymax-workflow:standards otherwise. English-only. No Phase/Task references. No suppression comments.

Verification:
- `diff -r apps/web/components/ui ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/components/ui` — expected:
  no output (identical), allowing for any primitive the sibling has that the shell does not need (copy at least the list).
- `diff apps/web/app/globals.css ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/app/globals.css` — expected: empty.
- `diff apps/web/tailwind.config.ts ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/tailwind.config.ts` — empty.
- `diff apps/web/components.json ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/components.json` — empty.

Completion Protocol:
1. Set 8.2 ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance checkboxes.
3. Header Progress `2 / 6`, Last updated today.
4. Update the P8 row Progress to `2 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 8.2 ✅ <date> — verbatim design system (globals.css + config + components/ui)`.
6. Commit: `feat(web): vendor the shared design system verbatim` (no Co-Authored-By).
```

---

### Task 8.3 — App shell — `layout` · `providers` · topbar · sidebar

- **Status**: ✅
- **Priority**: P0
- **Size**: M
- **Depends on**: 8.2

#### Description

Build the console chrome: the root `layout.tsx` (Geist fonts + forced dark + `NuqsAdapter` + `Providers`), the
`providers.tsx` client boundary (TanStack Query + Sonner), and the `AppShell` (fixed 64px topbar + sticky 250px
sidebar + content well) with the topbar brand mark and the sidebar's **seven notification destinations**.

#### Acceptance criteria

- [ ] `app/layout.tsx` — Server Component; `<html class="<GeistSans.variable> <GeistMono.variable> dark">` with
      `suppressHydrationWarning` + `data-scroll-behavior="smooth"`; wraps `<NuqsAdapter><Providers>{children}</Providers>`;
      `metadata` titled for the notification console.
- [ ] `app/providers.tsx` — `'use client'`; a `QueryClientProvider` (lazy `useState` client, sane `staleTime`,
      `refetchOnWindowFocus: false`) + the Sonner `<Toaster />`.
- [ ] `components/layout/app-shell.tsx` — `<Topbar>` + `pt-16` flex row of `<Sidebar>` + a `max-w-7xl` content `<main>`;
      owns the mobile-sidebar open/close state.
- [ ] `components/layout/topbar.tsx` — fixed `h-16`, `z-200`, dark-glass; the orange brand mark + gradient
      `nest-notification-example` wordmark on the left; a controls slot (filled in 8.4) + the mobile hamburger on the right.
- [ ] `components/layout/sidebar.tsx` — 250px glass rail; the **seven** destinations (`/` Overview, `/trigger` Trigger
      Center, `/explorer` Audit Explorer, `/otp` OTP Verify, `/providers` Providers & Templates, `/roadmap` Roadmap,
      `/settings` Settings) with lucide icons; orange active item via `usePathname()` (exact match on `/`); carries the
      `nuqs` query string across navigation.
- [ ] `pnpm --filter web typecheck` exits 0; `pnpm --filter web build` succeeds.

#### Files to create / modify

- `apps/web/app/layout.tsx`, `apps/web/app/providers.tsx`
- `apps/web/components/layout/{app-shell,topbar,sidebar}.tsx`

#### Agent prompt

```
You are a senior front-end / React engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is a Next.js 16 +
React 19 console under the shared Bymax design system (forced dark, orange glass, Geist + Geist Mono); URL state via nuqs.

CURRENT PHASE: 8 (Web Skeleton & Design System) — Task 8.3 of 6 (MIDDLE)

PRECONDITIONS
- Tasks 8.1 + 8.2 done: apps/web installs/builds; globals.css + tailwind.config.ts + components/ui/* are vendored.
- `@/lib/utils`'s `cn` arrives in Task 8.5 — import it now; typecheck/build pass once both this task and 8.5 land.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10 … The console (apps/web)" — the seven left-nav destinations + the global-controls top bar.
- docs/DEVELOPMENT_PLAN.md § "Phase 8 — Web Skeleton & Design System" (Scope-In: 64px topbar / 250px sidebar; overlays
  above the topbar; never import the library `.` server subpath in apps/web).
- Sibling files (copy & ADAPT — swap the logger destinations/wordmark for the notification ones): ~/Documents/MyApps/
  bymax-one/nest-logger-example/apps/web/ {app/layout.tsx, app/providers.tsx, components/layout/app-shell.tsx,
  components/layout/topbar.tsx, components/layout/sidebar.tsx}.

TASK
Build the console chrome — root layout, the client provider boundary, and the AppShell (topbar + sidebar + content well)
with the seven notification destinations.

DELIVERABLES
1. `app/layout.tsx` — adapt the sibling: Geist + GeistMono variables + forced `dark`, suppressHydrationWarning,
   data-scroll-behavior="smooth"; wrap in NuqsAdapter → Providers; metadata title e.g.
   "nest-notification-example — Notification Console", a notification-flavoured description.
2. `app/providers.tsx` — copy verbatim-ish (QueryClient lazy useState, staleTime ~30s, refetchOnWindowFocus false,
   <Toaster/>); only the @fileoverview wording need differ.
3. `components/layout/app-shell.tsx` — `<Topbar onMenuOpen=…/>` then `pt-16` flex: `<Sidebar isOpen onNavClick/>` +
   `<main className="min-w-0 flex-1 px-6 py-8"><div className="mx-auto max-w-7xl">{children}</div></main>`; owns the
   mobile open/close useState.
4. `components/layout/topbar.tsx` — fixed h-16 z-200 dark-glass; orange brand mark (the stacked-layers svg) + gradient
   wordmark "nest-notification-example"; right cluster = a controls slot rendering the 8.4 controls
   (<TenantRoleSwitcher/> + <LiveToggle/>) inside `hidden md:flex` + the lg:hidden hamburger. If 8.4 is not yet merged,
   leave a clearly-typed placeholder slot you will not need to re-touch (e.g. an empty `<div className="…md:flex"/>`),
   but PREFER importing the real controls if 8.4 landed first.
5. `components/layout/sidebar.tsx` — 250px glass rail; NAV_ITEMS = Overview `/` (exact, LayoutDashboard), Trigger Center
   `/trigger` (Zap), Audit Explorer `/explorer` (Search), OTP Verify `/otp` (KeyRound), Providers & Templates
   `/providers` (Boxes), Roadmap `/roadmap` (Map), Settings `/settings` (Cog); orange active item via usePathname()
   (exact on `/`, prefix otherwise); carry useSearchParams().toString() across links.

Constraints:
- Overlays/dropdowns sit ABOVE the z-200 topbar. Never import @bymax-one/nest-notification (the `.` server root) in any
  of these files. lib/ stays JSX-free (these are components, not lib/). Follow /bymax-workflow:standards: TS strict,
  @fileoverview + JSDoc on every export, English-only, NO Phase/Task references, no suppression comments.

Verification:
- `pnpm --filter web typecheck` — expected: exit 0 (assuming 8.5's `cn` exists; if not, the only unresolved import is
  `@/lib/utils`).
- `pnpm --filter web build` — expected: succeeds.
- `grep -R "from '@bymax-one/nest-notification'" apps/web/components apps/web/app` — expected: NO match (no server root).
- `grep -c "href:" apps/web/components/layout/sidebar.tsx` — expected: 7 destinations.

Completion Protocol:
1. Set 8.3 ✅ (block + index). 2. Tick the criteria. 3. Header Progress `3 / 6`, Last updated today.
4. Update the P8 row Progress to `3 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append: `- 8.3 ✅ <date> — app shell (layout · providers · topbar · sidebar)`.
6. Commit: `feat(web): app shell — layout, providers, topbar, sidebar` (no Co-Authored-By).
```

---

### Task 8.4 — Global controls — tenant / role / live + `nuqs` URL state

- **Status**: ✅
- **Priority**: P1
- **Size**: M
- **Depends on**: 8.3

#### Description

Build the three top-bar global controls and the `nuqs` URL-state contract that backs them: a **tenant switcher** (sets
the trusted `x-tenant-id`), a **role switcher** (Viewer/Operator/Admin RBAC demo), and a **live toggle** (SSE tail
on/off) — all persisted to the URL so every console view is a shareable deep link, and mounted into the topbar slot.

#### Acceptance criteria

- [ ] `lib/filters.ts` (JSX-free) — the `nuqs` query parsers for the global state (`tenantId` string default `''`,
      `role` enum default `viewer`, `live` boolean default `false`) and a `useNotificationQuery()` hook returning
      `{ setQuery, tenantId, role, live }`; exports the `TENANTS` (`acme`/`globex`) + `ROLES` (`viewer`/`operator`/`admin`)
      constants.
- [ ] `components/controls/tenant-role-switcher.tsx` — two compact `Select`s bound to `useQueryStates`; the tenant
      select offers `All tenants` (sentinel → `''`) + each `TENANTS` value; the role select offers each `ROLES` value.
- [ ] `components/controls/live-toggle.tsx` — a `⟳` icon `Button` writing the `live` boolean to the URL (`aria-pressed`,
      spins when live).
- [ ] The topbar renders `<TenantRoleSwitcher/>` + `<LiveToggle/>` in its `hidden md:flex` controls slot.
- [ ] Changing any control updates the URL query string (e.g. `?tenantId=acme&role=admin&live=true`); reloading restores
      it. `pnpm --filter web typecheck` + `build` succeed.

#### Files to create / modify

- `apps/web/lib/filters.ts`
- `apps/web/components/controls/{tenant-role-switcher,live-toggle}.tsx`
- `apps/web/components/layout/topbar.tsx` (mount the controls in the slot)

#### Agent prompt

````
You are a senior React / front-end state engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is a Next.js 16 +
React 19 console; every view is a shareable deep-link because the global controls persist to the URL via nuqs. The
tenant switcher sets the trusted `x-tenant-id` header the API resolves; the role switcher drives the RBAC demo.

CURRENT PHASE: 8 (Web Skeleton & Design System) — Task 8.4 of 6 (MIDDLE)

PRECONDITIONS
- Task 8.3 done: the AppShell + topbar (with a controls slot) + sidebar render. `@/components/ui/select` + `button` are
  vendored (8.2). `cn` (lib/utils) arrives in 8.5 — only the controls' classnames depend on it.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10 … The console (apps/web)" — Global controls: tenant switcher (x-tenant-id), role switcher
  (Viewer/Operator/Admin), live toggle (SSE tail); URL-persisted via nuqs.
- docs/DEVELOPMENT_PLAN.md § "Phase 8 — Web Skeleton & Design System" (Scope-In: the global controls persisted via nuqs).
- Sibling files (copy & ADAPT — drop the logger's time-range/source controls; keep tenant/role + live): ~/Documents/
  MyApps/bymax-one/nest-logger-example/apps/web/ {components/controls/tenant-role-switcher.tsx,
  components/controls/live-toggle.tsx, lib/filters.ts (only the tenant/role/live parsers + ROLES + the query hook)}.
- Re-verify nuqs v2 parser API (parseAsString/parseAsStringEnum/parseAsBoolean.withDefault, useQueryStates) via context7
  if unsure — the NuqsAdapter is already mounted in app/layout.tsx (8.3).

TASK
Build the tenant/role/live controls + the nuqs URL-state contract and mount the controls into the topbar slot.

DELIVERABLES
1. `lib/filters.ts` (JSX-free) — export `TENANTS = ['acme','globex'] as const`, `ROLES = ['viewer','operator','admin']
   as const`, a `RbacRole` type, the `notificationQueryParsers` map (tenantId: parseAsString.withDefault(''),
   role: parseAsStringEnum([...ROLES]).withDefault('viewer'), live: parseAsBoolean.withDefault(false)), and a
   `useNotificationQuery()` hook wrapping `useQueryStates(notificationQueryParsers)` → `{ setQuery, tenantId, role,
   live }`.

   ```ts
   // lib/filters.ts (shape)
   export const TENANTS = ['acme', 'globex'] as const
   export const ROLES = ['viewer', 'operator', 'admin'] as const
   export type RbacRole = (typeof ROLES)[number]
   export const notificationQueryParsers = {
     tenantId: parseAsString.withDefault(''),
     role: parseAsStringEnum<RbacRole>([...ROLES]).withDefault('viewer'),
     live: parseAsBoolean.withDefault(false),
   }
   export function useNotificationQuery() {
     const [{ tenantId, role, live }, setQuery] = useQueryStates(notificationQueryParsers)
     return { tenantId, role, live, setQuery }
   }
   ```
2. `components/controls/tenant-role-switcher.tsx` — two `Select`s (h-8 font-mono text-xs): tenant offers
   `All tenants` (sentinel `__all__` ↔ `''`) + acme/globex; role offers Viewer/Operator/Admin. Bind to setQuery.
3. `components/controls/live-toggle.tsx` — a lucide `RefreshCw` `Button` (variant default when live, outline when off),
   `aria-pressed={live}`, spins when live; `onClick` flips `live` via setQuery.
4. `components/layout/topbar.tsx` — render `<TenantRoleSwitcher/>` + `<LiveToggle/>` inside the `hidden md:flex` slot.

Constraints:
- lib/filters.ts is JSX-free. The controls are `'use client'`. Never import the library `.` server root. Follow
  /bymax-workflow:standards: TS strict (no `any` — the enum parser must yield `RbacRole`, not `string`), @fileoverview +
  JSDoc on every export, English-only, NO Phase/Task references, no suppression comments.

Verification:
- `pnpm --filter web typecheck` — expected: exit 0.
- `pnpm --filter web build` — expected: succeeds.
- `pnpm --filter web dev` then open `http://localhost:3003/?tenantId=acme&role=admin&live=true` — expected: the controls
  reflect the URL, and toggling them rewrites the query string (manual check; or assert the parsers in a later test phase).
- `grep -R "x-tenant-id\|server root import" apps/web/components/controls` — expected: no library `.`-root import.

Completion Protocol:
1. Set 8.4 ✅ (block + index). 2. Tick the criteria. 3. Header Progress `4 / 6`, Last updated today.
4. Update the P8 row Progress to `4 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append: `- 8.4 ✅ <date> — global controls (tenant/role/live) + nuqs URL state`.
6. Commit: `feat(web): global controls (tenant, role, live) over nuqs url state` (no Co-Authored-By).
````

---

### Task 8.5 — `lib/` clients — `utils` · `api-client` · `sse` · `error-codes` · `severity`

- **Status**: ✅
- **Priority**: P0
- **Size**: M
- **Depends on**: 8.1

#### Description

Lay down the JSX-free `lib/` clients the pages will consume: the `cn` class-merge `utils`, the typed `api-client` over
the `apps/api` surface (RBAC headers from tenant/role), the `sse` live-tail hook for `/audit/stream`, the `error-codes`
localization map (driven by the `./shared` `NOTIFICATION_ERROR_CODES` 22-key catalog), and `severity` (channel/verb
visual metadata). These import **only** the isomorphic `./shared` subpath — never the server `.` root. This task is
where `apps/web/lib/error-codes.ts` first imports the `./shared` catalog, so it also **finalizes**
`scripts/audit-error-codes.mjs` — promoting it from its P0 no-op stub into the real CI gate that parses the 22
`NOTIFICATION_ERROR_CODES` keys from the linked library and word-boundary-searches `apps/web`, failing if any key is
not localized (mirroring how P2 finalized the export-usage audit once the first real consumer landed).

#### Acceptance criteria

- [ ] `lib/utils.ts` — the `cn(...inputs)` `clsx` + `tailwind-merge` helper (unblocks `components/ui/*` + the shell).
- [ ] `lib/api-client.ts` (JSX-free) — a `BASE` from `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`), an
      `apiFetch<T>` that sets `Accept: application/json` + the RBAC headers (`x-tenant-id` from `tenantId`, `x-role` from
      `role`) and maps non-2xx → a thrown `ApiError`, plus thin typed callers for `/audit/logs`, `/audit/aggregate`, and
      `/channels`; an `encodeAuditQuery` that serializes the active filter to a query string (reused by the SSE hook).
- [ ] `lib/sse.ts` (the `useAuditStream` hook, `'use client'`) — opens an `EventSource` against the same-origin proxy
      `/api/audit/stream?…` (the proxy injects RBAC headers an `EventSource` cannot), rAF-flushes into a bounded ring buffer
      (drop-oldest), ignores keep-alive pings, exposes `{ rows, clear, connected, failed }`, idle-stops, and gates on an
      `enabled` flag (the live toggle).
- [ ] `lib/error-codes.ts` (JSX-free) — imports `NOTIFICATION_ERROR_CODES` from `@bymax-one/nest-notification/shared`
      and exposes a `localizeErrorCode(code)` returning a human message for **every** one of the 22 catalog keys (so
      `scripts/audit-error-codes.mjs` passes once the UI uses it); typed against `NotificationErrorCode` from `./shared`.
- [ ] `lib/severity.ts` (JSX-free) — accessible visual metadata (`{ color, icon, label }`) per channel/verb, importing
      the channel/purpose **type-only** unions (`NotificationChannel`, `OtpPurpose`) from `./shared` only — there is no
      runtime `CHANNELS`/`VERBS`/`PURPOSES` array on `./shared`, so any local value list is a local `as const` array.
- [ ] `scripts/audit-error-codes.mjs` is **finalized** from its P0 no-op stub into the real gate: it parses the 22
      `NOTIFICATION_ERROR_CODES` keys from the linked library and word-boundary-searches `apps/web` (under `lib/` + the
      pages), exiting non-zero if any key is not localized. `node scripts/audit-error-codes.mjs` passes now that
      `lib/error-codes.ts` localizes all 22 (mirrors P2's finalized export-usage audit).
- [ ] `pnpm --filter web typecheck` exits 0; `next build` resolves `./shared`; **no** `.`-root import exists in `lib/`.

#### Files to create / modify

- `apps/web/lib/utils.ts`, `apps/web/lib/api-client.ts`, `apps/web/lib/sse.ts`,
  `apps/web/lib/error-codes.ts`, `apps/web/lib/severity.ts`
- `scripts/audit-error-codes.mjs` (finalize from the P0 no-op stub into the real gate)

#### Agent prompt

```
You are a senior TypeScript / front-end integration engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web's console calls the
apps/api surface (/otp/*, /email/*, /dispatch, /channels, /audit/{logs,stream,aggregate}) from the browser, sending the
trusted `x-tenant-id` + RBAC `x-role` headers, and localizes the library's `./shared` error catalog. The browser bundle
uses ONLY the isomorphic ./shared and ./react subpaths — never the server `.` root.

CURRENT PHASE: 8 (Web Skeleton & Design System) — Task 8.5 of 6 (MIDDLE)

PRECONDITIONS
- Task 8.1 done: apps/web installs/builds; @bymax-one/nest-notification is a transpiled file: dependency with ./shared +
  ./react subpaths resolvable. (Independent of 8.3/8.4 — only shares lib/utils' `cn`, which THIS task provides.)

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10 … The console (apps/web)" (the endpoint table the api-client wraps + the global controls →
  headers) + § "7 … Consuming the ./shared subpath" (isomorphic imports, single React) + the § "6" note on the
  22-key NOTIFICATION_ERROR_CODES catalog (rows 52/53/57 — what must be localized).
- docs/DEVELOPMENT_PLAN.md § "Phase 8 — Web Skeleton & Design System" (Scope-In: lib/ api-client, sse, error-codes from
  ./shared, severity; Rules: lib/ JSX-free, never import the library `.` server subpath).
- Sibling files (copy & ADAPT — re-point at the notification API + the notification ./shared catalog): ~/Documents/
  MyApps/bymax-one/nest-logger-example/apps/web/ {lib/utils.ts (copy verbatim), lib/api-client.ts (adapt: BASE,
  apiFetch + RBAC headers, encode<Query>, typed callers), lib/use-event-source.ts (adapt to /audit/stream → name it
  sse.ts/useAuditStream), lib/severity.ts (adapt: import from @bymax-one/nest-notification/shared, channel/verb meta)}.
- Re-verify the @bymax-one/nest-notification/shared export names against the library's dist/shared/index.d.ts before
  importing — the ./shared barrel exports ONLY: `type OtpPurpose`, `type NotificationChannel`,
  `type NotificationErrorResponse`, `NOTIFICATION_ERROR_CODES` (the 22-key const), `type NotificationErrorCode`,
  `DEFAULT_TTLS`. There is NO runtime CHANNELS/VERBS/PURPOSES array and NO verb union on ./shared (the verb type
  `NotificationLogVerb` lives on the package root `@bymax-one/nest-notification`, not ./shared). The channel/purpose
  unions are TYPE-ONLY — build any Zod enum / value list from a LOCAL `as const` array, then pin it with a type-level
  `satisfies` parity guard against the imported union.

TASK
Author the five JSX-free lib/ clients (utils (cn), api-client, sse (useAuditStream), error-codes, severity) AND finalize
scripts/audit-error-codes.mjs from its P0 no-op stub into the real localization gate now that error-codes.ts is the
first real consumer of the ./shared catalog.

DELIVERABLES
1. `lib/utils.ts` — copy the sibling's `cn` verbatim (clsx + tailwind-merge).
2. `lib/api-client.ts` — `const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`; an `ApiError`
   (status + message); `rbacHeaders({ tenantId, role })` → `{ 'x-tenant-id'?, 'x-role'? }`; `apiFetch<T>(path, headers)`
   (Accept json, non-2xx → throw ApiError, JSON parse); `encodeAuditQuery(q)`; and typed callers `getAuditLogs`,
   `getAuditAggregate`, `getChannels`. Keep it JSX-free.
3. `lib/sse.ts` — `'use client'` `useAuditStream(filter, enabled)` over `new EventSource('/api/audit/stream?…')`: a
   bounded RingBuffer (drop-oldest, ~10k), rAF-coalesced flush, ignore empty-data pings, idle auto-stop, return
   `{ rows, clear, connected, failed }`. Mirror the sibling's structure; re-point the URL + the row mapping.
4. `lib/error-codes.ts` — import `NOTIFICATION_ERROR_CODES` (+ `type NotificationErrorCode`) from
   `@bymax-one/nest-notification/shared`; export `ERROR_CODE_MESSAGES: Record<NotificationErrorCode, string>` covering
   ALL 22 keys and `localizeErrorCode(code: NotificationErrorCode): string`. (This is what makes audit:error-codes pass.)
5. `lib/severity.ts` — `{ color, icon, label }` metadata per channel/verb, importing the channel/purpose unions
   (`type NotificationChannel`, `type OtpPurpose`) TYPE-ONLY from `@bymax-one/nest-notification/shared`; there is no
   runtime CHANNELS/VERBS/PURPOSES array on ./shared, so derive any value list from a local `as const` array (pinned to
   the imported union with `satisfies`); lucide icons.
6. `scripts/audit-error-codes.mjs` — FINALIZE the P0 no-op stub into the real gate (mirror how P2 finalized the
   export-usage audit once the first real consumer landed): read the linked library's `NOTIFICATION_ERROR_CODES` (parse
   the 22 keys from `@bymax-one/nest-notification/shared`), then word-boundary-search `apps/web` (at minimum `apps/web/lib`
   + the pages) for each key, and `process.exit(1)` listing any key that is never localized. With deliverable 4 in place
   it must now PASS (all 22 keys referenced via `lib/error-codes.ts`). Keep the script timeless (no Phase/Task strings).

Constraints:
- lib/ is JSX-free (sse.ts may use React hooks but renders no JSX). Import ONLY @bymax-one/nest-notification/shared
  (and /react where hooks are needed in later phases) — NEVER the `.` server root. Follow /bymax-workflow:standards:
  TS strict (no `any`), @fileoverview + JSDoc on every export, English-only, NO Phase/Task references, no suppression.

Verification:
- `pnpm --filter web typecheck` — expected: exit 0.
- `pnpm --filter web build` — expected: succeeds (next build resolves ./shared).
- `grep -Rn "from '@bymax-one/nest-notification'" apps/web/lib` — expected: NO match (only `/shared` or `/react`).
- `grep -Rn "CHANNELS\|VERBS\|PURPOSES" apps/web/lib` — expected: no import of a runtime CHANNELS/VERBS/PURPOSES array
  from ./shared (those do not exist there; any value list is a local `as const`).
- `node -e "import('@bymax-one/nest-notification/shared').then(m=>console.log(Object.keys(m.NOTIFICATION_ERROR_CODES).length))"`
  — expected: 22 (sanity: error-codes.ts must localize all of them).
- `node scripts/audit-error-codes.mjs` — expected: exit 0 (the finalized gate finds all 22 keys localized in apps/web).

Completion Protocol:
1. Set 8.5 ✅ (block + index). 2. Tick the criteria. 3. Header Progress `5 / 6`, Last updated today.
4. Update the P8 row Progress to `5 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append: `- 8.5 ✅ <date> — lib/ clients (utils · api-client · sse · error-codes · severity) + audit-error-codes gate`.
6. Commit: `feat(web): lib clients + finalize audit-error-codes localization gate` (no Co-Authored-By).
```

---

### Task 8.6 — Route placeholders + build/parity verification (closeout)

- **Status**: ✅
- **Priority**: P1
- **Size**: S
- **Depends on**: 8.3, 8.4, 8.5

#### Description

Wire the shell end-to-end: a `page.tsx` for each of the seven routes that renders `<AppShell>` + a labelled
empty-state placeholder (no page bodies), confirm the production build resolves `./react` + `./shared`, and capture the
design-parity check. This is the phase closeout — it runs the per-phase Completion Protocol.

#### Acceptance criteria

- [ ] `app/page.tsx` + `app/{trigger,explorer,otp,providers,roadmap,settings}/page.tsx` — each a thin shell that renders
      `<AppShell>` with a placeholder body (a centered empty-state card naming the destination + "coming in a later
      iteration"); no charts/tables/data wiring. Each may set `export const dynamic = 'force-dynamic'` (URL-driven).
- [ ] `app/error.tsx` + `app/not-found.tsx` (optional but recommended) render inside the design system.
- [ ] `pnpm --filter web build` succeeds and the build log shows the library's `./react` + `./shared` subpaths resolved
      (no "invalid hook call"; no duplicate-React warning).
- [ ] `pnpm --filter web dev` serves all seven routes; the topbar + sidebar + global controls render; switching the
      tenant/role/live controls rewrites the URL query string; the active sidebar item tracks the route.
- [ ] A shell screenshot is design-indistinguishable from the sibling examples (forced dark, orange glass, Geist) —
      attach/note the parity check in the PR.

#### Files to create / modify

- `apps/web/app/page.tsx`, `apps/web/app/{trigger,explorer,otp,providers,roadmap,settings}/page.tsx`
- `apps/web/app/error.tsx`, `apps/web/app/not-found.tsx`
- `docs/tasks/phase-08-web-skeleton.md` + `docs/DEVELOPMENT_PLAN.md` (the closeout dashboard updates)

#### Agent prompt

````
You are a senior Next.js / front-end engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. apps/web is a Next.js 16 +
React 19 console under the shared Bymax design system; the shell (topbar/sidebar/controls/lib) is built — this task
hangs an empty placeholder page on each of the seven routes and verifies the production build + design parity.

CURRENT PHASE: 8 (Web Skeleton & Design System) — Task 8.6 of 6 (LAST)

PRECONDITIONS
- Tasks 8.1–8.5 done: apps/web scaffold + verbatim design system + AppShell (topbar/sidebar) + global controls (nuqs) +
  lib/ clients all exist and typecheck/build. The seven destinations are wired in the sidebar.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10 … The console (apps/web)" (the seven routes + their jobs — for the placeholder labels) and
  § "5 Repository Layout" (the app/ route tree).
- docs/DEVELOPMENT_PLAN.md § "Phase 8 — Web Skeleton & Design System" (Definition of Done: `pnpm --filter web build`
  succeeds; next build resolves ./react + ./shared; shell screenshot is design-parity; controls drive URL state).
- Sibling: ~/Documents/MyApps/bymax-one/nest-logger-example/apps/web/app/page.tsx (the thin "AppShell + content" page
  shape) + app/error.tsx — copy the SHAPE only; the placeholder body is a simple empty-state, not the logger content.

TASK
Add a placeholder page per route (shell + empty-state), an error/not-found boundary, then verify the build + parity and
run the phase closeout.

DELIVERABLES
1. `app/page.tsx` (Overview) + `app/{trigger,explorer,otp,providers,roadmap,settings}/page.tsx` — each:
   ```tsx
   import { AppShell } from '@/components/layout/app-shell'
   export const dynamic = 'force-dynamic'
   export default function TriggerPage() {
     return (
       <AppShell>
         <section className="flex min-h-[40vh] items-center justify-center">
           <p className="text-sm text-white/55">Trigger Center — coming in a later iteration.</p>
         </section>
       </AppShell>
     )
   }
   ```
   (re-label per destination; no data wiring, no charts/tables).
2. `app/error.tsx` + `app/not-found.tsx` — minimal boundaries rendered under the design system (dark card + message).

Constraints:
- NO page bodies (charts/tables/Trigger/OTP/provider matrix are later phases). Never import the library `.` server root
  in any page. Follow /bymax-workflow:standards: TS strict, @fileoverview + JSDoc on every export, English-only, NO
  Phase/Task references in shipped files (the placeholder text says "a later iteration", never "Phase 9"), no suppression.

Verification:
- `pnpm --filter web build` — expected: succeeds; the build output lists all seven routes; no invalid-hook-call / no
  duplicate-React warning (confirms ./react + ./shared resolved).
- `pnpm --filter web typecheck && pnpm --filter web lint` — expected: exit 0.
- `pnpm --filter web dev` then visit `/`, `/trigger`, `/explorer`, `/otp`, `/providers`, `/roadmap`, `/settings` —
  expected: each renders the shell + its empty-state; the active sidebar item tracks the route; the tenant/role/live
  controls rewrite the URL query.
- Capture a shell screenshot and confirm design parity with the sibling (forced dark, orange glass, Geist).

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 8.6 ✅ (block + index). 2. Tick the criteria. 3. Header Progress `6 / 6`, Last updated today.
4. Update the P8 row Progress to `6 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append: `- 8.6 ✅ <date> — route placeholders + build/parity verification`.
6. Commit: `feat(web): route placeholders + verify build resolves ./react + ./shared` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, in
docs/DEVELOPMENT_PLAN.md set the P8 **Status to ✅** and Progress `6 / 6`, advance **Active phase** to P9, recompute
**Overall progress** to `8 / 15 phases (53%)`; set this file's header **Status** to ✅; commit `docs(plan): P8 complete`.
````

---

## Phase Completion Protocol

When **Task 8.6** is `✅` and every other task is `✅`:

1. Confirm all 6 tasks are `✅` and the P8 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P8`](../DEVELOPMENT_PLAN.md#phase-8--web-skeleton--design-system)
   is met: `pnpm --filter web build` succeeds and `next build` resolves the library's `./react` + `./shared` subpaths;
   the shell screenshot is design-indistinguishable from the sibling examples (design parity); the global controls
   (tenant / role / live) drive shareable deep-link URL state; the design-system files are byte-identical to the
   sibling's; `lib/` is JSX-free and imports no library `.`-server subpath.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P8 Status** to `✅`, **Progress** `6 / 6`, **Last
   updated** today; set **Active phase** to `P9`; recompute **Overall progress** to `8 / 15 phases (53%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `6 / 6 tasks`.
5. Commit `docs(plan): P8 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P8 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 8.1 ✅ 2026-06-23 — apps/web scaffold (Next 16 + React 19 + Tailwind 4)
- 8.2 ✅ 2026-06-23 — verbatim design system (globals.css + config + components/ui)
- 8.3 ✅ 2026-06-23 — app shell (layout · providers · topbar · sidebar)
- 8.4 ✅ 2026-06-23 — global controls (tenant/role/live) + nuqs URL state
- 8.5 ✅ 2026-06-23 — lib/ clients (utils · api-client · sse · error-codes · severity) + audit-error-codes gate
- 8.6 ✅ 2026-06-23 — route placeholders + build/parity verification (closeout)
