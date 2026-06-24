# Phase 10 — OTP & Providers Panels

> **Status**: 🔄 In progress · **Progress**: 1 / 6 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P10
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

P8 produced the Next.js 16 shell — `apps/web` with the **verbatim** Bymax design system (`globals.css`,
`tailwind.config.ts`, `components.json`, `components/ui/*`), the forced-dark layout, the global controls (tenant / role
switchers + live toggle), and `lib/` plumbing (`api-client`, `sse`, `nuqs` filters, the `./shared` error-code catalog,
severity helpers). P9 built the first three console destinations — **Overview**, **Trigger Center**, and **Audit
Explorer** (with the SSE live tail). The backend surface (P5–P7) is complete: `/otp/*`, `/email/send-template`,
`/dispatch`, `/channels`, `/admin/try-configure-{sms,push,async-useclass}`, and `/debug/key` all respond.

**P10 fills in the four notification-specific destinations that have no sibling analog** — the surfaces that make this
the _notification_ example and not a generic console:

- **`/otp` — OTP Verify**: the end-to-end OTP UX. The library's `useOtpInput` (segmented 6-cell box with paste,
  auto-advance, Backspace navigation, `reset`, `isComplete`) + `useOtpCountdown` (expiry pill, `MM:SS`) drive a **real
  verify** against `POST /otp/verify`, with a cooldown-gated resend and **every `OTP_*` error localized** from
  `./shared`. The hooks are state/UX only — issuing the request is the app's job.
- **`/providers` — Providers & Templates**: the provider / storage / renderer **matrix** (each row with health + active
  state, read from `GET /channels` + config status) and an **email preview** with **Rendered / HTML / Text / Metadata**
  tabs that prove the _html-body-only_ HTML-escape behavior (journey 6).
- **`/roadmap` — Roadmap**: an honest v0.2 preview — "Enable SMS / Push / useClass" posts to
  `/admin/try-configure-*` and surfaces the library's **actual startup-rejection error string** (journey 12).
- **`/settings` — Settings**: channel / provider config status + the RBAC roles, and the **boot-frozen** display of
  `consumeOnVerify` / `swallowErrors` (resolved once at boot — the page shows the configured value, it is not a live
  toggle).

The closing task localizes **every remaining `NOTIFICATION_ERROR_CODES` key** so `pnpm audit:error-codes` passes, and
reconciles the matrix rows. The observable end-state: a fresh OTP can be generated (via the Trigger Center or this
panel), the segmented box accepts/pastes it, the countdown ticks, `verify` succeeds against the live backend,
wrong/exhausted/expired codes render their localized message, the provider matrix + email preview + roadmap rejection
render, Settings shows the frozen options, and **web coverage stays at 100%**.

The gold source for the hooks is the sibling **library itself** — its `src/react/{useOtpInput.ts, useOtpCountdown.ts}`
and the README "Frontend OTP hooks" example show the exact `onComplete → backend` boundary; copy that boundary, do not
re-implement the hooks.

---

## Rules-of-phase

1. **The hooks are state/UX only — verifying is the app's job.** `useOtpInput`/`useOtpCountdown` never perform network
   I/O; the `/otp` page issues the `POST /otp/verify` request from the `onComplete` callback. Never reach for an HTTP
   client inside a hook wrapper.
2. **Accessibility on the OTP box** — each slot carries `autoComplete="one-time-code"` + `inputMode="numeric"` (or the
   matching `inputMode` for `alpha`/`alphanumeric` purposes), `maxLength={1}`, and an `aria-label`; the paste handler is
   attached to the **first** slot only.
3. **Never render the code anywhere it could leak** — the OTP code lives only in the box's local state and the verify
   request body. The panel never logs it, never puts it in a URL/`nuqs` param, and never shows it in any audit/debug
   surface. `GET /otp/status` and the panel never display the code.
4. **Every `NOTIFICATION_ERROR_CODES` key is localized in `apps/web`** — the error-code → message map covers all 22
   keys (`audit:error-codes` is CI-gating). Match by `error.code` from `NotificationErrorResponse`, never by HTTP status.
5. **Design system is verbatim** — compose the existing `components/ui/*` primitives (P8). Never re-style, never add a
   new global token, never hand-roll a primitive the design system already provides.
6. **Use the library's public surface only** — import the hooks from `@bymax-one/nest-notification/react` and the
   types/codes from `@bymax-one/nest-notification/shared`. Never import the server entry (`.`) into `apps/web`.
7. **Settings is read-only for boot-frozen options** — render `consumeOnVerify` / `swallowErrors` as configured values
   with an explanatory note; do **not** wire a runtime mutation control for them.
8. **Timeless, English-only deliverable code** — no `Phase N` / `Task` / roadmap-stage references in any committed
   source, component, comment, or test (this planning file may name them; the code it asks you to write may not).
9. **100% web coverage holds** — every new `components/**` and `lib/**` file is unit-tested (Vitest, jsdom, v8) to 100%
   statements/branches/functions/lines as it lands; `maxWorkers: '50%'` stays baked in.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §10 (the console: `/otp`, `/providers`, `/roadmap`, `/settings` route table + the
  `apps/web` IA), §16 (the demonstrated journeys — 2, 3, 4, 5 for OTP; 6 for the XSS-escape preview; 12 for roadmap
  rejection), §12 (Channels & Providers showcase — the matrix contents), §13 (never-log-codes invariant).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P10, §2 Global Conventions, §3 Autonomous Execution Model,
  Appendix B (export → matrix map — rows 15, 18, 19, 52, 53, 55, 56, 58a–c).
- Library gold sources (copy the boundary, do not re-implement): `~/Documents/MyApps/bymax-one/nest-notification/`
  `src/react/{useOtpInput.ts, useOtpCountdown.ts, types.ts, index.ts}`, `src/shared/constants/error-codes.ts`,
  `src/shared/constants/default-ttls.ts`, `README.md` "Frontend OTP hooks (`./react`)" example, and
  `docs/technical_specification.md` §16 (`./shared` + `./react` subpaths).
- `/bymax-workflow:standards` skill — universal coding rules (TS strict, JSDoc on exports, English-only, no
  suppression comments).

---

## Task index

| ID   | Task                                                       | Status  | Priority | Size | Depends on             |
| ---- | ---------------------------------------------------------- | ------- | -------- | ---- | ---------------------- |
| 10.1 | Error-code localization map + OTP API client helpers       | ✅ Done | P0       | M    | —                      |
| 10.2 | OTP Verify panel — segmented box + countdown + live verify | 📋 ToDo | P0       | L    | 10.1                   |
| 10.3 | Providers & Templates — matrix + email preview tabs        | 📋 ToDo | P1       | L    | 10.1                   |
| 10.4 | Roadmap panel — startup-rejection preview                  | 📋 ToDo | P1       | M    | 10.1                   |
| 10.5 | Settings panel — config status + boot-frozen options       | 📋 ToDo | P2       | M    | 10.1                   |
| 10.6 | Error-code audit reconciliation + matrix close-out         | 📋 ToDo | P0       | M    | 10.2, 10.3, 10.4, 10.5 |

---

## Tasks

### Task 10.1 — Error-code localization map + OTP API client helpers

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Build the shared foundation the four panels reuse: a pure `localizeNotificationError` map (every
`NOTIFICATION_ERROR_CODES` key → a human message), a `formatCooldown` seconds-formatter, and typed `api-client` helpers
for the OTP routes (`generate` / `verify` / `resend` / `status`). All pure, all unit-tested to 100% — no React yet.

#### Acceptance criteria

- [ ] `apps/web/lib/error-codes.ts` exports `localizeNotificationError(code: string): string` and
      `NOTIFICATION_ERROR_MESSAGES` — a `Record<NotificationErrorCode, string>` covering **all 22** keys from
      `NOTIFICATION_ERROR_CODES`, with a safe fallback for an unknown code. It matches on `error.code`, never HTTP status.
- [ ] `apps/web/lib/cooldown.ts` exports `formatCooldown(seconds: number): string` → `MM:SS` (clamps negatives to
      `00:00`), mirroring the library's `useOtpCountdown.formatted` style for consistency.
- [ ] `apps/web/lib/api/otp.ts` exports typed `generateOtp` / `verifyOtp` / `resendOtp` / `getOtpStatus` wrappers over
      the P8 `api-client` (sending `x-tenant-id`, surfacing `Retry-After` on 429 and the `NotificationErrorResponse` body).
- [ ] A type-level assertion guarantees the message map stays exhaustive (a `satisfies Record<NotificationErrorCode,
string>` so a future library code addition fails `tsc`).
- [ ] Unit tests cover 100% of the three files (every code mapped, the fallback, `formatCooldown` boundaries, each
      client helper's success + error path).

#### Files to create / modify

- `apps/web/lib/error-codes.ts`, `apps/web/lib/cooldown.ts`, `apps/web/lib/api/otp.ts`
- `apps/web/lib/error-codes.test.ts`, `apps/web/lib/cooldown.test.ts`, `apps/web/lib/api/otp.test.ts`

#### Agent prompt

````
You are a senior frontend (TypeScript / React) engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (a NestJS 11 email + OTP
notification library: multi-tenant, pluggable providers/storage, audit log, React hooks). pnpm monorepo, apps/api
(NestJS 11) + apps/web (Next.js 16 + React 19), Node 24, TypeScript 5.9 strict, 100% web coverage (Vitest).

CURRENT PHASE: 10 (OTP & Providers Panels) — Task 10.1 of 6 (FIRST)

PRECONDITIONS
- P8 done: apps/web exists with the verbatim design system, the api-client (lib/api-client), nuqs filters, and the
  ./shared error-code catalog wired. P9 done: Overview / Trigger Center / Audit Explorer pages exist.
- The backend (P5) serves POST /otp/{generate,verify,resend,consume} and GET /otp/status.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10. The Demo Domain & Notification Console" (the /otp route row + the endpoint table: the
  controller maps OtpVerifyResult → 200 / 401 invalid_code / 404 not_found / 429 max_attempts, and resend returns 429 +
  Retry-After under cooldown).
- docs/DEVELOPMENT_PLAN.md § "Phase 10 — OTP & Providers Panels" (Scope-In + Rules-of-phase).
- Library gold sources (copy values, do not re-implement):
  ~/Documents/MyApps/bymax-one/nest-notification/src/shared/constants/error-codes.ts  (the 22 NOTIFICATION_ERROR_CODES
  keys + the NotificationErrorCode type), src/shared/constants/default-ttls.ts (DEFAULT_TTLS), and
  src/shared/types/notification-error.types.ts (the NotificationErrorResponse shape).

TASK
Author the pure, reusable foundation the four P10 panels share: a complete error-code → message map, a cooldown
formatter, and typed OTP api-client helpers — all unit-tested to 100%. No React in this task.

DELIVERABLES
1. `apps/web/lib/error-codes.ts`:
   ```ts
   import {
     NOTIFICATION_ERROR_CODES,
     type NotificationErrorCode,
     type NotificationErrorResponse
   } from '@bymax-one/nest-notification/shared'

   /** Human-readable message for every known notification error code. */
   export const NOTIFICATION_ERROR_MESSAGES = {
     [NOTIFICATION_ERROR_CODES.OTP_INVALID_CODE]: 'Incorrect code — check the digits and try again.',
     [NOTIFICATION_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED]: 'Too many attempts. Request a new code.',
     [NOTIFICATION_ERROR_CODES.OTP_NOT_FOUND]: 'This code has expired or never existed. Request a new one.',
     [NOTIFICATION_ERROR_CODES.OTP_COOLDOWN_ACTIVE]: 'Please wait before requesting another code.',
     // …all 22 keys (EMAIL_*, TEMPLATE_*, OTP_*, SMS_*, PUSH_*, AUDIT_LOG_FAILED, CHANNEL_DISABLED)…
   } satisfies Record<string, string>

   /** Resolves a notification error code to a message, falling back for unknown codes. */
   export function localizeNotificationError(code: string): string { /* lookup by VALUE, fallback */ }
   ```
   IMPORTANT: key the map by the code VALUE (`'notification.otp_invalid_code'`), and add a compile-time
   exhaustiveness guard so a future added code fails `tsc` (e.g. a `const _assertExhaustive: Record<
   NotificationErrorCode, string> = byValueMap`).
2. `apps/web/lib/cooldown.ts` — `formatCooldown(seconds: number): string` → `MM:SS`, negatives clamped to `00:00`,
   zero-padded; mirror the library's useOtpCountdown formatting so the two read identically.
3. `apps/web/lib/api/otp.ts` — `generateOtp(input)`, `verifyOtp(input)`, `resendOtp(input)`, `getOtpStatus(query)` over
   the P8 api-client: send the trusted `x-tenant-id` header, return a discriminated result `{ ok: true; data } |
   { ok: false; code: string; retryAfterSeconds?: number }` parsed from `NotificationErrorResponse` (read Retry-After on
   429). Never include the OTP code in any GET query string.
4. `*.test.ts` for all three — 100% coverage: every code mapped + the fallback; formatCooldown boundaries (0, 59, 60,
   negative, large); each helper's success and error path (mock the api-client).

Constraints (follow /bymax-workflow:standards):
- TS strict; JSDoc on every export; English-only; NO suppression comments (@ts-ignore / eslint-disable).
- Import ONLY from `@bymax-one/nest-notification/shared` — never the server entry `.`. No React here.
- Timeless code: no phase/task references in any source or test.
- Every `it()` carries a one-line scenario comment naming the rule it protects.

Verification (run from repo root):
- `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter web exec vitest run lib/error-codes.test.ts lib/cooldown.test.ts lib/api/otp.test.ts --coverage`
  — expected: all pass, 100% on the three files.
- `node -e "const m=require('@bymax-one/nest-notification/shared');console.log(Object.keys(m.NOTIFICATION_ERROR_CODES).length)"`
  — expected: prints 22 (sanity: the map must cover this many).

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 6` and Last updated to today.
4. Update the P10 row Progress to `1 / 6` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 10.1 ✅ <YYYY-MM-DD> — error-code map + cooldown + OTP api helpers`.
6. Commit: `feat(web): error-code localization map + OTP api-client helpers` (no Co-Authored-By).
````

---

### Task 10.2 — OTP Verify panel — segmented box + countdown + live verify

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 10.1

#### Description

Build `/otp` — the end-to-end OTP UX. Wire the library's `useOtpInput` (segmented box) + `useOtpCountdown` (expiry pill)
to a **real** `verify` against the backend, with a purpose selector (driving length/type/TTL from an **app-local
purpose map** in `apps/web` that mirrors the backend OVERVIEW §9 `perPurpose` config — **not** from `DEFAULT_TTLS`,
which is seconds-only and carries no length/type), a cooldown-gated resend, `remainingAttempts` display, and every
`OTP_*` error localized from `./shared`.

> Note: the OTP **purpose** `mfa_oob` (an out-of-band MFA challenge code) is distinct from the email-template names
> `mfa_enabled` / `mfa_disabled` (MFA state-change notifications) — they are different concepts, do not conflate them.

#### Acceptance criteria

- [ ] `apps/web/components/otp/otp-input-box.tsx` renders an N-slot box from `useOtpInput`: each slot has
      `autoComplete="one-time-code"`, `inputMode` matching the purpose's type, `maxLength={1}`, `aria-label`; paste on slot
      0 only; auto-advance, Backspace nav, and `reset` work. The wrapper consumes the documented `useOtpInput` surface
      (`values`, `refs`, `onChange`, `onKeyDown`, `onPaste`, `reset`, `setValue`, `code`, `isComplete`, `autoSubmit`,
      `sanitizeOnPaste`) per `src/react/types.ts` — never re-implement any of it.
- [ ] `apps/web/components/otp/otp-countdown-pill.tsx` renders `useOtpCountdown.formatted` and an `expired` state.
- [ ] `apps/web/components/otp/otp-verify-panel.tsx` ties it together: a purpose selector driven by an **app-local
      purpose map** (in `apps/web`) that mirrors the backend OVERVIEW §9 `perPurpose` config (`email_verification` →
      6-digit/60min, `password_reset` → **8-char alphanumeric / 900s (15 min)**, etc.) — length/type/TTL come from this
      local map, **never** derived from `DEFAULT_TTLS` (seconds-only, no length/type); a generate action, the box whose
      `onComplete` calls `verifyOtp`, a resend button **disabled while cooldown > 0** (showing `formatCooldown`),
      `remainingAttempts` on a wrong code, and a localized message for `OTP_INVALID_CODE` / `OTP_MAX_ATTEMPTS_EXCEEDED` /
      `OTP_NOT_FOUND` / `OTP_COOLDOWN_ACTIVE` / `OTP_EXPIRED`. The `max_attempts` 429 carries **no** Retry-After (only
      generate/resend surface a cooldown), so the lockout message shows no countdown.
- [ ] `apps/web/app/otp/page.tsx` mounts the panel under the shared layout.
- [ ] The code never appears in a URL/`nuqs` param, a log, or any rendered debug surface (verified by a test asserting
      the rendered DOM + any captured request URL never contain the typed code).
- [ ] On a successful verify the panel shows a success state and offers `consume`; a fresh generate resets the box and
      restarts the countdown.
- [ ] 100% coverage on every new `components/otp/**` file.

#### Files to create / modify

- `apps/web/components/otp/otp-input-box.tsx`, `otp-countdown-pill.tsx`, `otp-verify-panel.tsx`
- `apps/web/lib/otp-purposes.ts` (app-local purpose → { length, type, ttlSeconds } map mirroring OVERVIEW §9) +
  `otp-purposes.test.ts`
- `apps/web/app/otp/page.tsx`
- `apps/web/components/otp/*.test.tsx` (one per component)

#### Agent prompt

````
You are a senior frontend (React 19 / Next.js 16) engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library: multi-tenant, pluggable providers, React hooks). pnpm monorepo, apps/web is a Next.js 16 console
on the verbatim Bymax design system; TypeScript 5.9 strict; 100% web coverage (Vitest, jsdom).

CURRENT PHASE: 10 (OTP & Providers Panels) — Task 10.2 of 6 (MIDDLE)

PRECONDITIONS
- Task 10.1 done: lib/error-codes.ts (localizeNotificationError), lib/cooldown.ts (formatCooldown), and lib/api/otp.ts
  (generateOtp/verifyOtp/resendOtp/getOtpStatus) exist and are 100% covered.
- P8 design system + global controls (tenant/role switchers) and P9 console pages exist. Backend POST /otp/* responds.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10" (the /otp route row: "useOtpInput segmented 6-cell box (paste, auto-advance, backspace nav) +
  useOtpCountdown expiry pill + cooldown-gated resend; surfaces remainingAttempts and every OTP_* error localized from
  ./shared") AND § "9" (the perPurpose config the app-local purpose map mirrors: password_reset overridden to 8-char
  alphanumeric / 900s / 15 min) AND § "16" journeys 2, 3, 4, 5 (verify, lockout, resend cooldown, per-purpose config).
- docs/DEVELOPMENT_PLAN.md § "Phase 10" Rules-of-phase ("the hooks are state/UX only — verifying is the app's job;
  honor autocomplete='one-time-code' + inputmode='numeric'").
- Library gold sources (copy the onComplete→backend BOUNDARY, do NOT re-implement the hooks):
  ~/Documents/MyApps/bymax-one/nest-notification/src/react/{useOtpInput.ts, useOtpCountdown.ts, types.ts} and the
  README "Frontend OTP hooks (./react)" example (~/Documents/MyApps/bymax-one/nest-notification/README.md, the
  useOtpInput + useOtpCountdown block) and docs/technical_specification.md §16.2/16.3.

TASK
Build the /otp page: a segmented OTP box + countdown pill driven by the library hooks, wired to a REAL verify against
POST /otp/verify, with a purpose selector, cooldown-gated resend, remainingAttempts, and localized OTP_* errors.

DELIVERABLES
1. `apps/web/components/otp/otp-input-box.tsx` — a `'use client'` component wrapping `useOtpInput`:
   ```tsx
   import { useOtpInput } from '@bymax-one/nest-notification/react'
   import type { OtpInputType } from '@bymax-one/nest-notification/react'
   // props: { length; type: OtpInputType; onComplete: (code: string) => void; disabled?: boolean }
   // render: values.map((v,i) => <input ref={refs[i]} value={v} maxLength={1}
   //   inputMode={type === 'numeric' ? 'numeric' : 'text'} autoComplete="one-time-code"
   //   aria-label={`Digit ${i + 1}`} onChange={onChange(i)} onKeyDown={onKeyDown(i)}
   //   onPaste={i === 0 ? onPaste : undefined} ... design-system input classes/>)
   // expose a reset affordance via the hook's reset().
   ```
   Consume the documented useOtpInput surface from src/react/types.ts — values, refs, onChange, onKeyDown, onPaste,
   reset, setValue, code, isComplete, autoSubmit, sanitizeOnPaste — never re-implement any of it.
   Compose the design-system input primitive — do not hand-roll styling.
2. `apps/web/components/otp/otp-countdown-pill.tsx` — wraps `useOtpCountdown({ expiresAt })`, renders `formatted` and an
   `expired` badge using the design-system pill/badge.
3. `apps/web/components/otp/otp-verify-panel.tsx` — the orchestrator:
   - a purpose selector backed by an APP-LOCAL purpose map (defined in apps/web, e.g. lib/otp-purposes.ts) that MIRRORS
     the backend OVERVIEW §9 perPurpose config: purpose → { length, type, ttlSeconds }. email_verification = 6/numeric,
     password_reset = 8/alphanumeric/900s (15 min), mfa_oob = 6/numeric, etc. Do NOT derive length/type from
     DEFAULT_TTLS — it is SECONDS-ONLY (e.g. OTP_PASSWORD_RESET_SECONDS = 600) and carries no length/type; the example
     deliberately overrides password_reset to 8-char alphanumeric / 900s, so keep 900s (15 min) here, not 600s.
     (The OTP purpose mfa_oob is unrelated to the email templates mfa_enabled / mfa_disabled — do not conflate them.)
   - a "Generate" action calling generateOtp → store { expiresAt, cooldownSeconds };
   - the box whose onComplete(code) calls verifyOtp({ code, purpose, recipient }); on { ok:false } render
     localizeNotificationError(code) and show remainingAttempts when present. OtpService.verify NEVER throws — the
     max_attempts branch is a 429 with NO Retry-After (no cooldown value), so render the lockout message WITHOUT a
     countdown; only generate/resend (OTP_COOLDOWN_ACTIVE, whose details carry retryAfter) surface a cooldown timer;
   - a "Resend" button disabled while a cooldown counter > 0, showing formatCooldown(remaining);
   - a success state on { ok:true } offering "Consume".
   The OTP code lives ONLY in box state + the verify request body — never a nuqs param, never logged, never rendered
   in a debug panel.
4. `apps/web/app/otp/page.tsx` — server component mounting <OtpVerifyPanel/> under the shared layout.
5. `apps/web/lib/otp-purposes.test.ts` + `apps/web/components/otp/*.test.tsx` — 100% coverage with
   @testing-library/react: the purpose map asserts password_reset = 8-char alphanumeric / 900s (15 min) and
   email_verification = 6/numeric (mirroring OVERVIEW §9, NOT DEFAULT_TTLS); typing/paste/backspace/reset;
   onComplete fires verify; a wrong code renders the localized message + remainingAttempts; max-attempts (429) renders
   the lockout message WITH NO Retry-After countdown; resend disabled during cooldown then re-enabled; countdown
   formats; AND an assertion that the typed code never appears in any captured request URL or in the rendered DOM
   outside the input values.

Constraints (follow /bymax-workflow:standards):
- TS strict; JSDoc on every exported component/prop type; English-only; NO suppression comments.
- Hooks do NO network I/O — only the panel calls the api helpers (rule of phase). Import hooks from
  `@bymax-one/nest-notification/react`, codes/types from `@bymax-one/nest-notification/shared`; never the server `.`.
- Verbatim design system — compose components/ui/*; never re-style or add a global token.
- Timeless code: no phase/task references anywhere in source or tests.
- Each `it()` carries a one-line scenario comment.

Verification (run from repo root):
- `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter web exec vitest run components/otp --coverage` — expected: all pass, 100% on components/otp/**.
- `pnpm --filter web dev` then load http://localhost:3003/otp, Generate → copy the code from Mailpit (:8025) → paste →
  the box auto-advances, the countdown ticks, verify returns 200 (success state); a wrong code shows the localized
  message — expected: matches journeys 2–5.

Completion Protocol:
1. Set 10.2 ✅ in its block AND the Task index row; tick the satisfied checkboxes.
2. Bump the file-header Progress to `2 / 6` + Last updated today.
3. Update the P10 row Progress to `2 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 10.2 ✅ <YYYY-MM-DD> — OTP Verify panel (box + countdown + live verify)`.
5. Commit: `feat(web): OTP verify panel with segmented box and live countdown` (no Co-Authored-By).
````

---

### Task 10.3 — Providers & Templates — matrix + email preview tabs

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: L
- **Depends on**: 10.1

#### Description

Build `/providers` — the provider / storage / renderer **matrix** (each boundary with its bundled reference, the wired
adapter, and a health/active badge from `GET /channels` **and** the `GET /config/status` endpoint added in P5.4) and the
**email preview** with Rendered / HTML / Text / Metadata tabs proving the `html`-body-only escape behavior (journey 6).

#### Acceptance criteria

- [ ] `apps/web/components/providers/provider-matrix.tsx` renders the four boundaries from §12 (Email transport / OTP
      storage / Template rendering / Audit sink) with: contract name, bundled reference, **this example wires**, and a
      health/active badge derived from `GET /channels` **and** the `GET /config/status` endpoint (added in P5.4).
- [ ] `apps/web/components/providers/email-preview.tsx` renders a `send-template` result in **four tabs** — **Rendered**
      (sandboxed iframe / safe HTML), **HTML** (the raw escaped html source), **Text** (the plain-text body), **Metadata**
      (subject, locale, template id, renderer). A variable containing `<script>…</script>` shows the **html body escaped**
      while subject and text stay raw — proving the html-only escape (journey 6).
- [ ] `apps/web/app/providers/page.tsx` mounts the matrix + preview under the shared layout.
- [ ] The renderer demos (Default / Handlebars / MJML / React Email) are surfaced as selectable in the preview where the
      backend exposes them.
- [ ] 100% coverage on every new `components/providers/**` file.

#### Files to create / modify

- `apps/web/components/providers/provider-matrix.tsx`, `email-preview.tsx`
- `apps/web/lib/api/providers.ts` (GET /channels + send-template preview wrappers) + `providers.test.ts`
- `apps/web/app/providers/page.tsx`
- `apps/web/components/providers/*.test.tsx`

#### Agent prompt

````
You are a senior frontend (React 19 / Next.js 16) engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library: multi-tenant, pluggable providers/storage/renderers, audit log). apps/web is a Next.js 16 console
on the verbatim Bymax design system; TypeScript 5.9 strict; 100% web coverage (Vitest, jsdom).

CURRENT PHASE: 10 (OTP & Providers Panels) — Task 10.3 of 6 (MIDDLE)

PRECONDITIONS
- Task 10.1 done: lib/error-codes.ts + lib/api/* + the P8 api-client exist. P8/P9 pages + design system exist.
- Backend serves GET /channels, GET /config/status (the config-status endpoint added in P5.4), and
  POST /email/send-template (P4–P5).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10" (the /providers route row: "the provider matrix (email provider + storage + renderer, each
  with health/active state) and an email preview (Rendered / HTML / Text / Metadata tabs) proving the
  HTML-escape-html-body-only behavior") AND § "12. Channels & Providers Showcase" (the four-boundary table: contracts,
  bundled references, what THIS example wires) AND § "16" journey 6 (template render + XSS guard).
- docs/DEVELOPMENT_PLAN.md § "Phase 10" (Scope-In: "Providers & Templates").
- Library gold source: ~/Documents/MyApps/bymax-one/nest-notification/docs/technical_specification.md the renderer
  contract + the "html body only" escape note (and OVERVIEW §11 stage 2 "HTML-escapes the html body only").

TASK
Build the /providers page: a four-boundary provider/storage/renderer matrix with health badges from GET /channels, and
a four-tab email preview that proves the html-body-only HTML escape.

DELIVERABLES
1. `apps/web/lib/api/providers.ts` — `getChannels()` (GET /channels → enabled channels + provider/storage/renderer
   metadata), `getConfigStatus()` (GET /config/status → the resolved config-status surface added in P5.4), and
   `renderEmailPreview(input)` (POST /email/send-template in a preview mode, or the existing send-template
   returning the rendered { subject, html, text, metadata }); plus `providers.test.ts` (100%).
2. `apps/web/components/providers/provider-matrix.tsx` — a table over the four §12 boundaries:
   | Boundary | Contract | Bundled reference | This example wires | Status |
   Email transport / OTP storage / Template rendering / Audit sink; the Status badge = active/health derived from
   getChannels() AND getConfigStatus() (GET /channels + GET /config/status). Compose the design-system table + badge
   primitives.
3. `apps/web/components/providers/email-preview.tsx` — a tabbed preview:
   ```tsx
   // tabs: 'rendered' | 'html' | 'text' | 'metadata'
   // 'rendered'  → render the escaped html safely (sandboxed iframe or a safe-HTML container)
   // 'html'      → show the raw escaped html source (so a <script> variable appears as &lt;script&gt;)
   // 'text'      → the plain-text body (NOT html-escaped — proves subject/text stay raw)
   // 'metadata'  → subject, locale, templateId, renderer name
   ```
   Include a renderer selector (Default / Handlebars / MJML / React Email) where getChannels exposes them.
4. `apps/web/app/providers/page.tsx` — server component mounting <ProviderMatrix/> + <EmailPreview/>.
5. `*.test.tsx` for both components — 100% coverage: matrix rows render with the right badge per channels payload;
   the preview's four tabs switch; a `<script>` in a template variable renders ESCAPED in the html tab but RAW in the
   text tab (the journey-6 assertion).

Constraints (follow /bymax-workflow:standards):
- TS strict; JSDoc on every export; English-only; NO suppression comments.
- The 'rendered' tab must NOT introduce an XSS sink — render via a sandboxed iframe or a vetted safe container; the
  point of the panel is to PROVE the escape, never to defeat it.
- Verbatim design system — compose components/ui/*; never re-style. Import from ./shared / api-client only, never `.`.
- Timeless code: no phase/task references. Each `it()` carries a scenario comment.

Verification (run from repo root):
- `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter web exec vitest run components/providers lib/api/providers.test.ts --coverage`
  — expected: all pass, 100% on the new files.
- `pnpm --filter web dev` → http://localhost:3003/providers: the matrix shows the wired adapters with live badges; a
  template preview with a `<script>` variable shows it escaped in HTML and raw in Text — expected: journey 6 holds.

Completion Protocol:
1. Set 10.3 ✅ (block + Task index row); tick the satisfied checkboxes.
2. Bump the file-header Progress to `3 / 6` + Last updated today.
3. Update the P10 row Progress to `3 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 10.3 ✅ <YYYY-MM-DD> — Providers & Templates matrix + email preview`.
5. Commit: `feat(web): provider matrix and four-tab email preview` (no Co-Authored-By).
````

---

### Task 10.4 — Roadmap panel — startup-rejection preview

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: M
- **Depends on**: 10.1

#### Description

Build `/roadmap` — the honest v0.2 preview. "Enable SMS" / "Enable Push" / "Use useClass" each post to
`/admin/try-configure-{sms,push,async-useclass}` and render the library's **actual startup-rejection error string**,
proving the v0.2 interfaces exist but the channels are deliberately rejected today (journey 12).

#### Acceptance criteria

- [ ] `apps/web/lib/api/roadmap.ts` exports `tryConfigureSms` / `tryConfigurePush` / `tryConfigureAsyncUseClass`,
      each POSTing to the matching `/admin/try-configure-*` route and returning the rejection `{ code, message }`.
- [ ] `apps/web/components/roadmap/roadmap-panel.tsx` renders three cards (SMS / Push / useClass), each with a button
      that triggers the call and displays the **real** rejection message verbatim from the backend (not a hard-coded
      string), with the localized code where one maps (`SMS_PROVIDER_NOT_CONFIGURED` / `PUSH_PROVIDER_NOT_CONFIGURED`).
- [ ] A short "why" note frames these as declared-but-not-deliverable v0.2 surfaces (timeless wording — no roadmap-stage
      jargon in the committed copy).
- [ ] `apps/web/app/roadmap/page.tsx` mounts the panel under the shared layout.
- [ ] 100% coverage on every new `components/roadmap/**` and `lib/api/roadmap.ts` file.

#### Files to create / modify

- `apps/web/lib/api/roadmap.ts` + `roadmap.test.ts`
- `apps/web/components/roadmap/roadmap-panel.tsx` + `roadmap-panel.test.tsx`
- `apps/web/app/roadmap/page.tsx`

#### Agent prompt

```
You are a senior frontend (React 19 / Next.js 16) engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library; the SMS/Push channels and async-useClass providers are DECLARED in v0.1 but rejected at startup —
they ship in v0.2). apps/web is a Next.js 16 console on the verbatim Bymax design system; TS 5.9 strict; 100% web
coverage (Vitest).

CURRENT PHASE: 10 (OTP & Providers Panels) — Task 10.4 of 6 (MIDDLE)

PRECONDITIONS
- Task 10.1 done: lib/error-codes.ts + api-client exist. P7 backend serves POST
  /admin/try-configure-{sms,push,async-useclass}, each booting an isolated module that throws the real startup
  rejection and returns its error string. P8/P9 pages + design system exist.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10" (the /roadmap route row: "clicking 'Enable SMS' / 'Enable Push' / 'Use useClass' surfaces the
  library's ACTUAL startup-rejection error string, proving the interfaces exist but the channels are rejected") AND
  the endpoint-table row for POST /admin/try-configure-{sms,push,async-useclass} AND § "16" journey 12 (Roadmap honesty).
- docs/DEVELOPMENT_PLAN.md § "Phase 10" (Scope-In: "the Roadmap panel surfacing the P7 rejections").

TASK
Build the /roadmap page: three cards (SMS / Push / useClass) that POST to /admin/try-configure-* and render the real
backend rejection string verbatim, proving the v0.2 surface is declared but not deliverable.

DELIVERABLES
1. `apps/web/lib/api/roadmap.ts` — `tryConfigureSms()`, `tryConfigurePush()`, `tryConfigureAsyncUseClass()` over the
   api-client, each returning `{ code: string | null; message: string }` parsed from the backend response (the message
   is the LIBRARY's real rejection text — do not synthesize it); + `roadmap.test.ts` (100%, success of the call + the
   rejection-body path).
2. `apps/web/components/roadmap/roadmap-panel.tsx` — three cards, each:
   - a title + a one-line "what this would enable" description (timeless wording);
   - an "Enable" / "Try" button that calls the matching api helper;
   - on response, render the backend `message` verbatim and, where it maps, the localized code
     (localizeNotificationError on SMS_PROVIDER_NOT_CONFIGURED / PUSH_PROVIDER_NOT_CONFIGURED).
   Compose the design-system card + alert/badge primitives.
3. `apps/web/app/roadmap/page.tsx` — server component mounting <RoadmapPanel/>.
4. `*.test.tsx` — 100% coverage: each button triggers its call; the rejection message renders verbatim; the localized
   code shows where mapped; a network/unknown error path renders the fallback message.

Constraints (follow /bymax-workflow:standards):
- TS strict; JSDoc on every export; English-only; NO suppression comments.
- Render the backend's REAL rejection string — never hard-code the message in the component (the whole point is honesty).
- The committed copy must be timeless: describe the channel ("SMS delivery is not enabled in this build"), never name a
  roadmap stage/phase. Verbatim design system; import from ./shared / api-client only, never `.`.
- Each `it()` carries a scenario comment.

Verification (run from repo root):
- `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter web exec vitest run components/roadmap lib/api/roadmap.test.ts --coverage`
  — expected: all pass, 100% on the new files.
- `pnpm --filter web dev` → http://localhost:3003/roadmap: clicking "Enable SMS" shows the real
  SMS_PROVIDER_NOT_CONFIGURED rejection from the backend — expected: journey 12 holds.

Completion Protocol:
1. Set 10.4 ✅ (block + Task index row); tick the satisfied checkboxes.
2. Bump the file-header Progress to `4 / 6` + Last updated today.
3. Update the P10 row Progress to `4 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 10.4 ✅ <YYYY-MM-DD> — Roadmap startup-rejection panel`.
5. Commit: `feat(web): roadmap panel surfacing real startup rejections` (no Co-Authored-By).
```

---

### Task 10.5 — Settings panel — config status + boot-frozen options

- **Status**: 📋 ToDo
- **Priority**: P2
- **Size**: M
- **Depends on**: 10.1

#### Description

Build `/settings` — the channel / provider config status and the RBAC roles, plus the **read-only** display of the
boot-frozen `consumeOnVerify` / `swallowErrors` options (resolved once at boot — the page shows the configured value
with an explanatory note, it is not a live toggle).

#### Acceptance criteria

- [ ] `apps/web/lib/api/settings.ts` exports `getConfigStatus()` (channels enabled from `GET /channels`,
      provider/storage/renderer in use + `consumeOnVerify` + `swallowErrors` as configured + `maskRecipient` mode from the
      `GET /config/status` endpoint added in P5.4) over the api-client; + `settings.test.ts`.
- [ ] `apps/web/components/settings/config-status.tsx` renders the channel/provider config and the RBAC role list
      (Viewer / Operator / Admin) read from the global role switcher (P8).
- [ ] `apps/web/components/settings/frozen-options.tsx` renders `consumeOnVerify` / `swallowErrors` as **read-only**
      badges with an explanatory note ("resolved once at boot; flipping them is demonstrated by booting a second module
      variant, not a live mutation") — **no runtime mutation control**.
- [ ] `apps/web/app/settings/page.tsx` mounts both under the shared layout.
- [ ] 100% coverage on every new `components/settings/**` and `lib/api/settings.ts` file.

#### Files to create / modify

- `apps/web/lib/api/settings.ts` + `settings.test.ts`
- `apps/web/components/settings/config-status.tsx`, `frozen-options.tsx` + their `*.test.tsx`
- `apps/web/app/settings/page.tsx`

#### Agent prompt

```
You are a senior frontend (React 19 / Next.js 16) engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library; `consumeOnVerify` and `swallowErrors` are resolved ONCE at boot — they are frozen options, not
runtime toggles). apps/web is a Next.js 16 console on the verbatim Bymax design system; TS 5.9 strict; 100% web
coverage (Vitest).

CURRENT PHASE: 10 (OTP & Providers Panels) — Task 10.5 of 6 (MIDDLE)

PRECONDITIONS
- Task 10.1 done: lib/error-codes.ts + api-client exist. P8 global role switcher (Viewer/Operator/Admin) exists. The
  backend exposes GET /channels and the GET /config/status endpoint (added in P5.4) — provider/storage/renderer, the
  frozen options (consumeOnVerify/swallowErrors), and the maskRecipient mode.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "10" (the /settings route row: "Channel/provider config status and the RBAC roles. Note:
  consumeOnVerify and swallowErrors are resolved ONCE at boot (frozen options), so the Settings page SHOWS the
  configured value; flipping them at runtime is demonstrated by booting a second module variant, not a live mutation")
  AND § "13" (maskRecipient: a Settings toggle compares masked vs raw).
- docs/DEVELOPMENT_PLAN.md § "Phase 10" (Scope-In: "Settings (config status + the boot-frozen consumeOnVerify/
  swallowErrors display)" + Rule-of-phase 7).

TASK
Build the /settings page: channel/provider config status + RBAC roles, and a READ-ONLY display of the boot-frozen
consumeOnVerify / swallowErrors options with an explanatory note (no runtime mutation control for them).

DELIVERABLES
1. `apps/web/lib/api/settings.ts` — `getConfigStatus()` over the api-client, composing GET /channels (enabled channels)
   with GET /config/status (the endpoint added in P5.4) and returning
   `{ channels, provider, storage, renderer, consumeOnVerify, swallowErrors, maskRecipientMode }`; + `settings.test.ts`
   (100%).
2. `apps/web/components/settings/config-status.tsx` — renders the channels/provider/storage/renderer config and the
   RBAC role list (Viewer/Operator/Admin) from the global role switcher; a maskRecipient masked-vs-raw comparison row.
3. `apps/web/components/settings/frozen-options.tsx` — consumeOnVerify / swallowErrors as READ-ONLY design-system
   badges + a short timeless note explaining they are boot-resolved (no toggle, no mutation handler).
4. `apps/web/app/settings/page.tsx` — server component mounting <ConfigStatus/> + <FrozenOptions/>.
5. `*.test.tsx` — 100% coverage: config-status renders each field from the payload; the role list reflects the switcher;
   frozen-options renders both flags read-only with NO mutating control (assert no toggle/button mutates them).

Constraints (follow /bymax-workflow:standards):
- TS strict; JSDoc on every export; English-only; NO suppression comments.
- frozen-options is READ-ONLY (rule of phase) — do NOT wire a runtime mutation for consumeOnVerify/swallowErrors.
- Verbatim design system — compose components/ui/*; never re-style. Import from ./shared / api-client only, never `.`.
- Timeless code: no phase/task references. Each `it()` carries a scenario comment.

Verification (run from repo root):
- `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
- `pnpm --filter web exec vitest run components/settings lib/api/settings.test.ts --coverage`
  — expected: all pass, 100% on the new files.
- `pnpm --filter web dev` → http://localhost:3003/settings: the config status + RBAC roles render; consumeOnVerify and
  swallowErrors show their configured values as read-only — expected: matches OVERVIEW §10.

Completion Protocol:
1. Set 10.5 ✅ (block + Task index row); tick the satisfied checkboxes.
2. Bump the file-header Progress to `5 / 6` + Last updated today.
3. Update the P10 row Progress to `5 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 10.5 ✅ <YYYY-MM-DD> — Settings config status + frozen options`.
5. Commit: `feat(web): settings panel with config status and boot-frozen options` (no Co-Authored-By).
```

---

### Task 10.6 — Error-code audit reconciliation + matrix close-out

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 10.2, 10.3, 10.4, 10.5

#### Description

Close the phase: make `pnpm audit:error-codes` pass by guaranteeing **every** `NOTIFICATION_ERROR_CODES` key is
referenced in `apps/web`, reconcile the Feature Coverage Matrix rows P10 owns (15, 18, 19, 52, 53, 55, 56, 58a–c), run
the full local gate, and run the Per-phase Completion Protocol.

#### Acceptance criteria

- [ ] `pnpm audit:error-codes` exits 0 — every one of the 22 `NOTIFICATION_ERROR_CODES` keys is localized/referenced in
      `apps/web` (the four panels collectively reference all of them; any key with no natural UI home is referenced in the
      `error-codes` map and asserted by a test).
- [ ] The `./react` hook allow-list entries that P2 added to `.audit-ignore.json` (`useOtpInput`, `useOtpCountdown`) are
      **removed** — the hooks are now demonstrated in the `/otp` UI, so they no longer need an ignore entry — and
      `pnpm audit:exports` is re-run.
- [ ] `pnpm audit:exports` exits 0 — the React hooks (`useOtpInput`, `useOtpCountdown`) and the `./shared` symbols P10
      consumes are all referenced; no allow-list entry is needed for a P10 export (or, if one is, it carries a reason).
- [ ] The full local gate passes: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov &&
pnpm audit:exports && pnpm audit:error-codes`, with `apps/web` at **100%** coverage on all four metrics.
- [ ] The Feature Coverage Matrix rows owned by P10 (15, 18, 19, 52, 53, 55, 56, 58a–c) are reconciled — each marked
      demonstrated with its `apps/web` reference (per Appendix B).
- [ ] The four P10 destinations are reachable from the left-nav and deep-link via `nuqs` (consistent with P9).

#### Files to create / modify

- `apps/web/lib/error-codes.ts` (fill any remaining unreferenced keys) + its test
- `docs/OVERVIEW.md` (§6 Feature Coverage Matrix — tick the P10 rows) if the matrix is tracked there
- `.audit-ignore.json` (remove the `./react` hook entries P2 added — `useOtpInput` / `useOtpCountdown` — now that the
  `/otp` UI demonstrates them; add a reasoned entry only for a genuinely-undemonstrable export)
- this file + `docs/DEVELOPMENT_PLAN.md` (the completion-protocol updates)

#### Agent prompt

```
You are a senior frontend / quality engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification library). pnpm monorepo, apps/web Next.js 16, TS 5.9 strict, 100% coverage + audit gates
(audit:exports + audit:error-codes are CI-gating).

CURRENT PHASE: 10 (OTP & Providers Panels) — Task 10.6 of 6 (LAST)

PRECONDITIONS
- Tasks 10.1–10.5 done: the four panels (/otp, /providers, /roadmap, /settings) + lib helpers exist and are tested.
- The export audit (scripts/audit-library-exports.mjs) + error-code audit (scripts/audit-error-codes.mjs) from P0/P2
  are wired to `pnpm audit:exports` / `pnpm audit:error-codes`.

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Phase 10" (Definition of Done — "every NOTIFICATION_ERROR_CODES key is localized;
  audit:error-codes passes; 100% web coverage") + § "Appendix B Library Export → Phase Coverage Map" (the P10 rows:
  15, 18, 19, 52, 53, 55, 56, 58a–c) + § "3. Autonomous Execution Model" (the local gate + the per-phase closeout).
- docs/OVERVIEW.md § "6. Feature Coverage Matrix" (how a row is marked demonstrated) + § "13" (never-log-codes — the
  proof a regression test asserts).
- Library gold source: ~/Documents/MyApps/bymax-one/nest-notification/src/shared/constants/error-codes.ts (confirm all
  22 keys).

TASK
Close P10: guarantee every error code is referenced in apps/web (audit:error-codes green), reconcile the P10 matrix
rows, run the full local gate, and execute the per-phase completion protocol.

DELIVERABLES
1. Reconcile `apps/web/lib/error-codes.ts` so all 22 NOTIFICATION_ERROR_CODES keys are referenced — the OTP_* and
   EMAIL_*/TEMPLATE_*/AUDIT_LOG_FAILED/CHANNEL_DISABLED keys via the panels' localized messages; any code with no
   natural UI home (e.g. SMS_*/PUSH_* that the roadmap panel already surfaces, or OTP_INVALID_LENGTH /
   OTP_STORAGE_NOT_CONFIGURED) referenced in the map and asserted by a test that iterates Object.values(
   NOTIFICATION_ERROR_CODES) and expects a message for each.
2. Remove the `./react` hook allow-list entries that P2 added to `.audit-ignore.json` (`useOtpInput`,
   `useOtpCountdown`) — they are now demonstrated in the `/otp` UI, so they no longer need an ignore — and re-run
   `pnpm audit:exports` to confirm it stays green without them. If a genuine library export still cannot be
   demonstrated, add a reasoned `.audit-ignore.json` entry — otherwise leave it empty. Prefer demonstrating over
   ignoring.
3. Reconcile the Feature Coverage Matrix P10 rows (15, 18, 19, 52, 53, 55, 56, 58a–c) in docs/OVERVIEW.md §6 — mark each
   demonstrated with its apps/web reference.
4. Run the full local gate and fix any gap so it is green.

Constraints (follow /bymax-workflow:standards):
- TS strict; English-only; NO suppression comments; timeless code. Prefer a real UI reference over an audit-ignore.
- The never-log-codes invariant test (§13) must still pass — the OTP code never appears in any audit/log/URL surface.

Verification (run from repo root):
- `pnpm typecheck && pnpm lint && pnpm format:check` — expected: exit 0.
- `pnpm test:cov` — expected: apps/web 100% on statements/branches/functions/lines.
- `pnpm audit:exports` — expected: exit 0.
- `pnpm audit:error-codes` — expected: exit 0 (every key localized).
- `node -e "const m=require('@bymax-one/nest-notification/shared');const fs=require('fs');const src=fs.readFileSync('apps/web/lib/error-codes.ts','utf8');for(const v of Object.values(m.NOTIFICATION_ERROR_CODES)){if(!src.includes(v))throw new Error('unreferenced: '+v)}console.log('all 22 referenced')"`
  — expected: prints "all 22 referenced".

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 10.6 ✅ (block + Task index row); tick the satisfied checkboxes.
2. Bump the file-header Progress to `6 / 6` + Last updated today.
3. Update the P10 row Progress to `6 / 6` in docs/DEVELOPMENT_PLAN.md.
4. Append to Completion log: `- 10.6 ✅ <YYYY-MM-DD> — error-code audit reconciliation + matrix close-out`.
5. Commit: `chore(web): reconcile error-code audit and P10 coverage matrix` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, in
docs/DEVELOPMENT_PLAN.md set the P10 **Status to ✅** and **Progress `6 / 6`** + Last updated; advance **Active phase**
to P11; recompute **Overall progress** to `10 / 15 phases (67%)`. Set this file's header **Status to ✅** and Progress
`6 / 6 tasks`. Commit `docs(plan): P10 complete` (no Co-Authored-By).
```

---

## Phase Completion Protocol

When **Task 10.6** is `✅` and every other task is `✅`:

1. Confirm all 6 tasks are `✅` and the P10 **Definition of Done** in
   [`DEVELOPMENT_PLAN.md § P10`](../DEVELOPMENT_PLAN.md#phase-10--otp--providers-panels) is met: the OTP box
   (paste/auto-advance/backspace/`reset`/`isComplete`) + countdown drive a real verify against the backend; the
   provider matrix + email preview + roadmap rejection render; **every `NOTIFICATION_ERROR_CODES` key is localized**
   (`audit:error-codes` passes); `apps/web` is at **100%** coverage.
2. Ensure the phase PR is **merged** to `main` with **CI green** (every required check, including `export-usage-check`).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P10 Status** to `✅`, **Progress** `6 / 6`, **Last
   updated** today; set **Active phase** to `P11`; recompute **Overall progress** to `10 / 15 phases (67%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `6 / 6 tasks`.
5. Commit `docs(plan): P10 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P10 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 10.1 ✅ 2026-06-23 — error-code map + cooldown + OTP api helpers
  </content>
  </invoke>
