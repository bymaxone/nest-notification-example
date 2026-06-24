# Phase 11 — Optional Auth Seam (`@bymax-one/nest-auth`)

> **Status**: 🔄 In Progress · **Progress**: 1 / 3 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P11
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

By the end of P10 the API surface (OTP, email, dispatch, audit, roadmap-rejection) and the web console
(Overview · Trigger Center · Audit Explorer · OTP-verify · provider matrix · roadmap · settings) all exist and pass at
100% coverage. The `EmailService` from `@bymax-one/nest-notification` is wired, the `CANONICAL_EMAIL_TEMPLATES` registry
(`otp_code`, `otp_password_reset`, `mfa_enabled`, `mfa_disabled`, `new_login_alert`, `welcome`, …) is registered, and the
delivery **audit log** records every send.

P11 demonstrates the **composition** with `@bymax-one/nest-auth` **without bundling a full auth stack**. `nest-auth` is a
separately published, full-stack auth library whose **email delivery is fully delegated** to the consumer via an
`IEmailProvider` port with **7 methods**. This phase implements that port **by delegating to `nest-notification`'s
`EmailService`**, so the whole app would have a single mailer, a single template registry, and a single audit log — auth
emails included. The phase adds three things: (1) the `NotificationAuthEmailProvider` adapter that maps all 7 port
methods to canonical templates; (2) **journey 13** — a `nest-auth`-style password-reset OTP that renders, sends (to
Mailpit), and audits through this pipeline, proving one email path with no OTP duplication; (3) the `AUTH_INTEGRATION.md`
doc that records the ownership boundary and the `notification:` vs `auth:` Redis-namespace isolation.

`nest-auth` is an **illustrative peer, not a hard dependency**: the adapter is typed against the port's shape, the demo
generates the "auth" OTP locally to stand in for what `nest-auth`'s own `OtpService` would emit, and no real
login/session UI is built (that is out of scope). When P11 is done, the adapter maps all 7 port methods, journey 13 runs
one event end-to-end against the live stack, the namespace isolation is documented, and everything is covered at 100%.

The gold source for the port shape is the sibling library `~/Documents/MyApps/bymax-one/nest-auth/` — its
`IEmailProvider` interface and README "Email delivery" section. Copy the **port's method signatures** and adapt; do not
invent new ones.

---

## Rules-of-phase

1. **`nest-auth` owns auth-OTP/MFA; `nest-notification` owns delivery.** Never duplicate OTP generation for the same
   purpose — the adapter only **renders + sends + audits** an already-generated code/token; it never generates an auth
   OTP through `nest-notification`'s `OtpService`. (OVERVIEW §14, reason 1.)
2. **`nest-auth` is an illustrative peer, not a hard dependency.** Type the adapter against the **shape** of nest-auth's
   port (a local interface mirror or a type-only import guarded so the build never requires the package at runtime). Do
   **not** add `@bymax-one/nest-auth` as a production dependency, do not bundle a login/session UI.
3. **All 7 port methods mapped.** `sendPasswordResetToken`, `sendPasswordResetOtp`, `sendEmailVerificationOtp`,
   `sendMfaEnabledNotification`, `sendMfaDisabledNotification`, `sendNewSessionAlert`, `sendInvitation` — each maps to a
   **canonical template** via `EmailService.sendTemplate` (no method left as a stub or `throw`).
4. **Isolated Redis namespaces.** Document and assert that `nest-notification` uses `notification:` while `nest-auth`
   uses `auth:`; the keyspaces never overlap on a shared Redis. (OVERVIEW §14, reason 2.)
5. **Never log codes/tokens/PII.** The adapter must never log the OTP, the reset token, the invite token, or unmasked
   recipient — exactly as the library's own services behave. Auth emails flow through the same masking + audit path.
6. **Single audit log.** A send through the adapter produces the **same** `NotificationLog` rows as any other
   `EmailService.sendTemplate` call (the delivery audit, including auth emails).
7. **Timeless, English-only deliverable code.** No `Phase N` / `Task` / roadmap-stage references in any committed source,
   config, or `docs/*.md` you write (doc-section refs like `OVERVIEW.md §14` are allowed). 100% coverage; TS strict;
   JSDoc on every export; no suppression comments.

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — § 14 _Ecosystem Fit — Coexistence with `@bymax-one/nest-auth`_ (the boundary table,
  the 3 no-conflict reasons, the adapter skeleton), § 16 journey 13, § 5 Repository Layout (target tree).
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P11, § 2 Global Conventions, § 3 Autonomous Execution Model.
- Sibling gold source (illustrative peer — copy the **port shape**, do not depend on the package):
  `~/Documents/MyApps/bymax-one/nest-auth/src/server/interfaces/email-provider.interface.ts` (the 7 methods +
  `SessionInfo` / `InviteData`) and `~/Documents/MyApps/bymax-one/nest-auth/README.md` § "Email delivery" / "Implement
  the Email Provider Interface".
- `/bymax-workflow:standards` skill — universal coding rules (TS strict, JSDoc on exports, English-only, no suppression).

---

## Task index

| ID   | Task                                                                                | Status  | Priority | Size | Depends on |
| ---- | ----------------------------------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 11.1 | `NotificationAuthEmailProvider` adapter (7 port methods → canonical templates)      | ✅ Done | P0       | M    | —          |
| 11.2 | Journey 13 — auth password-reset OTP rendered + sent + audited through the pipeline | 📋 ToDo | P0       | M    | 11.1       |
| 11.3 | `docs/AUTH_INTEGRATION.md` — boundary, namespace isolation, no-duplication          | 📋 ToDo | P1       | S    | 11.1, 11.2 |

---

## Tasks

### Task 11.1 — `NotificationAuthEmailProvider` adapter (7 port methods → canonical templates)

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Implement the optional adapter `NotificationAuthEmailProvider` that satisfies the shape of `@bymax-one/nest-auth`'s
`IEmailProvider` port by delegating each of its **7 methods** to `nest-notification`'s `EmailService.sendTemplate`,
mapping every auth event to a **canonical template**. `nest-auth` stays an illustrative peer — type against a local
mirror of the port, never add the package as a runtime dependency.

#### Acceptance criteria

- [x] `apps/api/src/notification/auth-email.provider.ts` exports an `@Injectable()` `NotificationAuthEmailProvider`
      implementing the **shape** of nest-auth's `IEmailProvider` (all 7 methods), constructed with `EmailService` (+ the
      tenant-context source) — JSDoc on the class and every method.
- [x] All **7 methods** are mapped to canonical templates and call `EmailService.sendTemplate` (no stub / no `throw`):
      `sendEmailVerificationOtp`→`otp_code`, `sendPasswordResetOtp`→`otp_password_reset`,
      `sendPasswordResetToken`→link/token email, `sendMfaEnabledNotification`→`mfa_enabled`,
      `sendMfaDisabledNotification`→`mfa_disabled`, `sendNewSessionAlert`→`new_login_alert`, `sendInvitation`→
      `welcome`/`invitation`.
- [x] The port shape (`IEmailProvider`, `SessionInfo`, `InviteData`) is provided as a **local type-only mirror** (or a
      `import type` guarded so the build never requires `@bymax-one/nest-auth` at runtime); `@bymax-one/nest-auth` is **not**
      added to `apps/api/package.json` dependencies.
- [x] The adapter never logs the OTP / token / invite token / unmasked recipient; auth emails flow through the same
      masking + audit path as any other `sendTemplate` call.
- [x] Unit-tested at 100% (every method asserts the correct `template`, `tenantId`, `to`, `locale`, and merged `data`);
      `pnpm --filter @nest-notification-example/api typecheck` and `lint` pass.

#### Files to create / modify

- `apps/api/src/notification/auth-email.provider.ts` (the adapter)
- `apps/api/src/notification/auth-email.types.ts` (the local mirror of the nest-auth port shape — or inline `import type`)
- `apps/api/src/app.module.ts` (register the adapter as a provider)
- `apps/api/test/notification/auth-email.provider.spec.ts` (100% unit coverage)

#### Agent prompt

````
You are a senior NestJS integration engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib: multi-tenant, pluggable providers/storage, delivery audit log, React hooks). pnpm monorepo (apps/api
NestJS 11 + apps/web Next.js 16), Node 24, TypeScript 5.9 strict, 100% coverage + Stryker ≥ 95 bar, built by autonomous
agents whose PRs Copilot reviews.

CURRENT PHASE: 11 (Optional Auth Seam (nest-auth)) — Task 11.1 of 3 (FIRST)

PRECONDITIONS
- P3–P10 done: apps/api boots; the notification module wires EmailService (@bymax-one/nest-notification) with the
  CANONICAL_EMAIL_TEMPLATES registry (otp_code, otp_password_reset, mfa_enabled, mfa_disabled, new_login_alert, welcome…)
  registered; a tenant-context source (the x-tenant-id guard / resolver) exists; the delivery audit log records sends.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "14. Ecosystem Fit — Coexistence with @bymax-one/nest-auth" (the boundary table, the 3 no-conflict
  reasons, AND the adapter skeleton + the "Why this is elegant" template mapping).
- docs/DEVELOPMENT_PLAN.md § "Phase 11 — Optional Auth Seam" (Goal / Scope / DoD / Rules-of-phase).
- The port shape to mirror (illustrative peer — copy the 7 method signatures + SessionInfo/InviteData, do NOT add the
  package as a dependency): ~/Documents/MyApps/bymax-one/nest-auth/src/server/interfaces/email-provider.interface.ts.
- ~/Documents/MyApps/bymax-one/nest-auth/README.md § "Email delivery" / "Implement the Email Provider Interface" (the
  consumer-adapter pattern + the BYMAX_AUTH_EMAIL_PROVIDER token binding it shows).

TASK
Implement NotificationAuthEmailProvider — the optional adapter that satisfies nest-auth's IEmailProvider shape by
delegating all 7 methods to nest-notification's EmailService.sendTemplate, mapping each auth event to a canonical
template. nest-auth stays an illustrative peer (type-only mirror; no runtime dependency).

DELIVERABLES
1. `apps/api/src/notification/auth-email.types.ts` — a LOCAL, type-only mirror of the nest-auth port shape so the build
   never requires @bymax-one/nest-auth at runtime:
   ```typescript
   /** Local mirror of @bymax-one/nest-auth's email port — kept type-only; the package is not a runtime dependency. */
   export interface SessionInfo { device: string; ip: string; sessionHash: string }
   export interface InviteData { inviterName: string; tenantName: string; inviteToken: string; expiresAt: Date }
   export interface AuthEmailPort {
     sendPasswordResetToken(email: string, token: string, locale?: string): Promise<void>
     sendPasswordResetOtp(email: string, otp: string, locale?: string): Promise<void>
     sendEmailVerificationOtp(email: string, otp: string, locale?: string): Promise<void>
     sendMfaEnabledNotification(email: string, locale?: string): Promise<void>
     sendMfaDisabledNotification(email: string, locale?: string): Promise<void>
     sendNewSessionAlert(email: string, sessionInfo: SessionInfo, locale?: string): Promise<void>
     sendInvitation(email: string, inviteData: InviteData, locale?: string): Promise<void>
   }
   ```
2. `apps/api/src/notification/auth-email.provider.ts` — the @Injectable() adapter, JSDoc on class + every method:
   ```typescript
   @Injectable()
   export class NotificationAuthEmailProvider implements AuthEmailPort {
     constructor(private readonly email: EmailService, private readonly tenants: TenantContext) {}
     // nest-auth generates the code; we only render + send + audit it via nest-notification.
     async sendEmailVerificationOtp(to: string, otp: string, locale = 'en'): Promise<void> {
       await this.email.sendTemplate({ tenantId: this.tenants.current(), to, template: 'otp_code', locale,
         data: { code: otp, purpose: 'email_verification', appName: 'Bymax' } })
     }
     // …the other 6 methods, each mapped to its canonical template (see OVERVIEW §14):
     //   sendPasswordResetOtp → 'otp_password_reset'   (data: { code: otp, purpose: 'password_reset' })
     //   sendPasswordResetToken → link/token email      (data: { resetUrl built from token }) — never log the token
     //   sendMfaEnabledNotification → 'mfa_enabled'     sendMfaDisabledNotification → 'mfa_disabled'
     //   sendNewSessionAlert → 'new_login_alert'        (data from SessionInfo: device, ip, sessionHash)
     //   sendInvitation → 'welcome'/'invitation'        (data from InviteData; build the accept URL from inviteToken)
   }
   ```
3. Register the adapter as a provider in `apps/api/src/app.module.ts` (add to `providers`, consistent with how the
   notification feature modules are wired there; export only if a downstream module needs it). It must construct cleanly
   from the existing EmailService + tenant-context DI.
4. `apps/api/test/notification/auth-email.provider.spec.ts` — 100% unit coverage: for EACH of the 7 methods assert the
   exact `template`, `tenantId`, `to`, `locale` (incl. the default 'en' branch), and the merged `data` passed to a mocked
   EmailService.sendTemplate; assert no code/token is logged.

Constraints (follow /bymax-workflow:standards):
- TS strict (no `any`; honour exactOptionalPropertyTypes + noUncheckedIndexedAccess). JSDoc on every export. English-only.
  No suppression comments (no @ts-ignore / eslint-disable).
- nest-auth is an ILLUSTRATIVE PEER: do NOT add @bymax-one/nest-auth to apps/api/package.json. Mirror the port shape
  locally (type-only). Never generate an auth OTP through nest-notification's OtpService — the adapter only renders+sends.
- Never log the OTP, reset token, invite token, or unmasked recipient. All 7 methods must call sendTemplate (no stub /
  no throw). Timeless code — no Phase/task references in the source.

Verification:
- `pnpm --filter @nest-notification-example/api typecheck` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api lint` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest auth-email.provider --coverage --maxWorkers=2` — expected: all
  green, 100% on auth-email.provider.ts (statements/branches/functions/lines).
- `grep -n "@bymax-one/nest-auth" apps/api/package.json` — expected: NO match (peer is illustrative only).
- `grep -rnE "console\.(log|info|warn|error)" apps/api/src/notification/auth-email.provider.ts` — expected: no code/token
  logging.

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 3` and Last updated to today.
4. Update the P11 row Progress to `1 / 3` in docs/DEVELOPMENT_PLAN.md (+ its Last updated).
5. Append to Completion log: `- 11.1 ✅ <YYYY-MM-DD> — NotificationAuthEmailProvider adapter (7 port methods)`.
6. Commit: `feat(api): add NotificationAuthEmailProvider adapter for the nest-auth email port` (no Co-Authored-By).
````

---

### Task 11.2 — Journey 13: auth password-reset OTP rendered + sent + audited through the pipeline

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 11.1

#### Description

Wire **journey 13** end-to-end: a `nest-auth`-style password-reset OTP (generated locally to stand in for nest-auth's own
`OtpService`) is rendered, sent to Mailpit, and recorded in the delivery audit log **through the
`NotificationAuthEmailProvider` adapter** — proving one mailer, one audit log, and no OTP duplication. Add a tiny demo
controller and an e2e test that asserts the email lands and the audit row is written.

#### Acceptance criteria

- [ ] A demo controller `POST /auth-demo/password-reset` (dev-only seam) accepts `{ to, locale? }`, generates a stand-in
      OTP **locally** (mirroring what nest-auth would emit — NOT via `nest-notification`'s `OtpService`), and calls
      `NotificationAuthEmailProvider.sendPasswordResetOtp(to, otp, locale)`. The response never returns the OTP.
- [ ] The send produces the **same** delivery-audit row(s) as any `EmailService.sendTemplate` call (visible via the
      existing `GET /audit/logs`); the recipient is masked in the audit.
- [ ] An e2e test drives the journey against the in-memory/mocked transport: it asserts a `sent` audit row exists for
      `template: 'otp_password_reset'` and that the OTP never appears in the response body or any log.
- [ ] No OTP duplication: the journey does **not** call `/otp/generate` — the adapter only renders+sends the supplied
      code (OVERVIEW §14, reason 1).
- [ ] 100% coverage on the new controller + journey; `pnpm --filter @nest-notification-example/api typecheck` and `lint`
      pass.

#### Files to create / modify

- `apps/api/src/notification/auth-demo.controller.ts` (the dev-only journey-13 seam)
- `apps/api/src/app.module.ts` (register the controller)
- `apps/api/test/notification/auth-demo.e2e-spec.ts` (the end-to-end journey assertion)

#### Agent prompt

````
You are a senior NestJS backend engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib: multi-tenant, pluggable providers/storage, delivery audit log, React hooks). pnpm monorepo (apps/api
NestJS 11 + apps/web Next.js 16), Node 24, TypeScript 5.9 strict, 100% coverage + Stryker ≥ 95 bar.

CURRENT PHASE: 11 (Optional Auth Seam (nest-auth)) — Task 11.2 of 3 (MIDDLE)

PRECONDITIONS
- Task 11.1 done: NotificationAuthEmailProvider exists in apps/api/src/notification/, is registered in the module, and
  delegates all 7 nest-auth port methods to EmailService.sendTemplate (sendPasswordResetOtp → 'otp_password_reset').
- The delivery audit log + GET /audit/logs (keyset) exist (P6); EmailService → Mailpit (or a mocked transport in e2e).

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "14. Ecosystem Fit" (reason 1: nest-auth GENERATES the OTP, nest-notification only sends it — do NOT
  route auth-OTP generation through nest-notification's OtpService) AND § "16" journey 13 (the exact end-to-end claim).
- docs/OVERVIEW.md § "15. Audit Log & Delivery Tracking" (what a delivery-audit row looks like + GET /audit/logs shape).
- docs/DEVELOPMENT_PLAN.md § "Phase 11 — Optional Auth Seam" (Scope-In = journey 13; Scope-Out = a real login/session UI).
- apps/api/src/notification/auth-email.provider.ts (produced by Task 11.1) — the adapter you will drive.

TASK
Wire journey 13: a nest-auth-style password-reset OTP (generated locally to stand in for nest-auth's OtpService) is
rendered, sent (Mailpit), and audited through the NotificationAuthEmailProvider — proving one mailer, one audit log, and
no OTP duplication. Add a dev-only demo controller + an e2e proof.

DELIVERABLES
1. `apps/api/src/notification/auth-demo.controller.ts` — a dev-only seam controller, JSDoc on class + handler:
   ```typescript
   @Controller('auth-demo')
   export class AuthDemoController {
     constructor(private readonly authEmail: NotificationAuthEmailProvider) {}
     /** Stand-in for nest-auth's password-reset flow: nest-auth would generate the OTP; here we mint a local code,
      *  then delegate rendering + sending + auditing to nest-notification via the adapter. The OTP is never returned. */
     @Post('password-reset')
     async passwordReset(@Body() dto: { to: string; locale?: string }): Promise<{ status: 'sent' }> {
       const otp = mintStandInOtp() // local, mirrors what @bymax-one/nest-auth's OtpService would emit — NOT OtpService here
       await this.authEmail.sendPasswordResetOtp(dto.to, otp, dto.locale ?? 'en')
       return { status: 'sent' } // never echo the OTP
     }
   }
   ```
   (Validate the body with the project's Zod pipe; mintStandInOtp may be a tiny local node:crypto numeric generator —
   it represents nest-auth's responsibility, NOT a second nest-notification OTP.)
2. Register AuthDemoController in the `controllers` array of `apps/api/src/app.module.ts` (consistent with how the other
   notification controllers are wired there).
3. `apps/api/test/notification/auth-demo.e2e-spec.ts` — drive POST /auth-demo/password-reset against the in-memory /
   mocked transport, then:
   - assert response body is `{ status: 'sent' }` and contains NO digits matching the generated OTP;
   - assert GET /audit/logs returns a row for template/verb of the password-reset send with the recipient MASKED;
   - assert /otp/generate was NOT called (no nest-notification OTP minted) — the adapter only sent the supplied code.

Constraints (follow /bymax-workflow:standards):
- TS strict; JSDoc on every export; English-only; no suppression comments.
- NO OTP duplication: the journey must NOT call nest-notification's OtpService / POST /otp/generate. The stand-in OTP
  represents nest-auth's own generation (reason 1, §14). nest-auth stays an illustrative peer — no package dependency.
- Never return or log the OTP. The recipient is masked in the audit. Scope-OUT: no login/session UI — this is one journey.
- Timeless code — no Phase/task references in the source (a `/** journey-13 seam */`-style comment is fine ONLY if it does
  NOT use a phase/task token; prefer "optional nest-auth password-reset seam").

Verification:
- `pnpm --filter @nest-notification-example/api typecheck` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api lint` — expected: exit 0.
- `pnpm --filter @nest-notification-example/api exec jest auth-demo --coverage --maxWorkers=2` — expected: green; 100% on
  the new controller.
- Live (optional, if the stack is up): `curl -s -X POST localhost:3001/auth-demo/password-reset -H 'content-type:
  application/json' -H 'x-tenant-id: demo' -d '{"to":"user@example.com"}'` → `{"status":"sent"}`; the email appears in
  Mailpit (http://localhost:8025) and a matching audit row appears in `GET /audit/logs`.

Completion Protocol (run after finishing):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `2 / 3` and Last updated to today.
4. Update the P11 row Progress to `2 / 3` in docs/DEVELOPMENT_PLAN.md (+ its Last updated).
5. Append to Completion log: `- 11.2 ✅ <YYYY-MM-DD> — journey 13: auth password-reset OTP sent + audited via the adapter`.
6. Commit: `feat(api): journey 13 — auth password-reset OTP through the notification pipeline` (no Co-Authored-By).
````

---

### Task 11.3 — `docs/AUTH_INTEGRATION.md` — boundary, namespace isolation, no-duplication

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: S
- **Depends on**: 11.1, 11.2

#### Description

Author `docs/AUTH_INTEGRATION.md` — the authoritative walkthrough of how `nest-notification` composes with
`@bymax-one/nest-auth`: the ownership boundary table, the **7-method → canonical-template** mapping the adapter
implements, the `notification:` vs `auth:` Redis-namespace isolation, the no-OTP-duplication rule, and a pointer to
journey 13. It expands OVERVIEW §14 into a standalone consumer guide.

#### Acceptance criteria

- [ ] `docs/AUTH_INTEGRATION.md` exists with: a one-paragraph summary of the seam; the **ownership boundary table** (who
      owns auth-OTP / MFA / email delivery / general OTP / transactional email) mirroring OVERVIEW §14; the **7-method →
      canonical-template** mapping table the adapter implements (Task 11.1); the **Redis-namespace isolation** section
      (`notification:` vs `auth:`, keys never overlap); the **no-OTP-duplication** rule (reason 1); and a "Try it" pointer to
      journey 13 (`POST /auth-demo/password-reset`).
- [ ] Code references point at the real produced files (`apps/api/src/notification/auth-email.provider.ts`,
      `auth-demo.controller.ts`); the doc states `nest-auth` is an **illustrative peer, not a hard dependency**.
- [ ] No phase/task references; English-only; `markdown-link-check` reports no dead links.
- [ ] The doc is linked from the README Documentation table / the docs index (matching how the other `docs/*.md` are
      linked) so it is discoverable.

#### Files to create / modify

- `docs/AUTH_INTEGRATION.md` (the guide)
- `README.md` (add the row to the Documentation table, if not already present)

#### Agent prompt

```
You are a senior developer-experience / technical-writer engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for @bymax-one/nest-notification (NestJS 11 email + OTP
notification lib: multi-tenant, pluggable providers, delivery audit log, React hooks). MIT, going public, built by
autonomous agents. nest-auth is an illustrative peer, not a hard dependency.

CURRENT PHASE: 11 (Optional Auth Seam (nest-auth)) — Task 11.3 of 3 (LAST)

PRECONDITIONS
- Tasks 11.1 + 11.2 done: apps/api/src/notification/auth-email.provider.ts implements the 7 nest-auth port methods →
  canonical templates; apps/api/src/notification/auth-demo.controller.ts exposes journey 13 (POST /auth-demo/password-
  reset) end-to-end; both covered at 100%.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "14. Ecosystem Fit — Coexistence with @bymax-one/nest-auth" (the boundary table + the 3 no-conflict
  reasons + the adapter skeleton — this doc EXPANDS §14 into a standalone guide; keep it consistent, do not contradict).
- docs/OVERVIEW.md § "16" journey 13 (the end-to-end claim you will point readers to).
- apps/api/src/notification/{auth-email.provider.ts, auth-demo.controller.ts} (produced by 11.1/11.2) — cite the real
  file paths + the actual 7-method → template mapping they implement.
- An existing docs/*.md in this repo (e.g. docs/MULTI_TENANCY.md if present, else docs/OVERVIEW.md) to MATCH the house
  style (headings, tone, link format) and the README Documentation-table row format.

TASK
Write docs/AUTH_INTEGRATION.md — the authoritative consumer guide for composing nest-notification with @bymax-one/nest-
auth: the ownership boundary, the 7-method → canonical-template mapping, the notification: vs auth: namespace isolation,
the no-OTP-duplication rule, and a "Try it" pointer to journey 13.

DELIVERABLES
1. `docs/AUTH_INTEGRATION.md` with these sections (English, timeless):
   - `# Auth Integration — composing with @bymax-one/nest-auth` + a one-paragraph summary (single mailer, single audit
     log; nest-auth owns auth-OTP/MFA, nest-notification owns delivery).
   - `## Ownership boundary` — the table from OVERVIEW §14 (Auth OTP / MFA / Email delivery / General OTP / App emails →
     who owns each).
   - `## The adapter` — describe `NotificationAuthEmailProvider` and the 7-method → canonical-template mapping table:
     | nest-auth port method | canonical template |
     | sendEmailVerificationOtp | otp_code |
     | sendPasswordResetOtp | otp_password_reset |
     | sendPasswordResetToken | reset link/token email |
     | sendMfaEnabledNotification | mfa_enabled |
     | sendMfaDisabledNotification | mfa_disabled |
     | sendNewSessionAlert | new_login_alert |
     | sendInvitation | welcome / invitation |
     …with the real file path apps/api/src/notification/auth-email.provider.ts and the BYMAX_AUTH_EMAIL_PROVIDER binding.
   - `## Redis namespace isolation` — `notification:` (notification:otp:…, notification:otp_cd:…, sha256 keys) vs `auth:`
     (auth:rt:…, auth:sess:…, auth:otp:…, auth:mfa:…); keyspaces never overlap on a shared Redis; both configurable.
   - `## No OTP duplication` — the rule of thumb (login / email-verification / password-reset / MFA → nest-auth;
     anything else → nest-notification); the adapter only renders + sends + audits an already-generated code.
   - `## Try it` — point at journey 13: `POST /auth-demo/password-reset` → email in Mailpit + an audit row in
     `GET /audit/logs`, no OTP duplication. State that nest-auth is an illustrative peer, NOT a hard dependency.
2. `README.md` — ensure the Documentation table has a row linking `docs/AUTH_INTEGRATION.md` (add it if missing, matching
   the existing rows).

Constraints (follow /bymax-workflow:standards):
- English-only; timeless — NO Phase/task/roadmap-stage references (this is committed docs-as-config; doc-section refs like
  "OVERVIEW.md §14" are allowed). Do not contradict OVERVIEW §14 — this guide expands it.
- Cite REAL file paths only. Do not imply @bymax-one/nest-auth is a runtime dependency — it is illustrative.

Verification:
- `test -f docs/AUTH_INTEGRATION.md` — expected: exists.
- `grep -c "|" docs/AUTH_INTEGRATION.md` — expected: > 0 (the boundary + mapping tables present); the file names all 7
  port methods (`grep -o "send[A-Za-z]*" docs/AUTH_INTEGRATION.md | sort -u` lists the 7).
- `npx markdown-link-check docs/AUTH_INTEGRATION.md --config .markdown-link-check.json` — expected: no dead links.
- `grep -riE "phase [0-9]|task [0-9]" docs/AUTH_INTEGRATION.md` — expected: no matches.
- `grep -q "AUTH_INTEGRATION" README.md` — expected: match (linked from the Documentation table).

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK:
1. Set 11.3 Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `3 / 3` and Last updated to today.
4. Update the P11 row Progress to `3 / 3` in docs/DEVELOPMENT_PLAN.md (+ its Last updated).
5. Append to Completion log: `- 11.3 ✅ <YYYY-MM-DD> — docs/AUTH_INTEGRATION.md (boundary, namespaces, no-duplication)`.
6. Commit: `docs(auth): add AUTH_INTEGRATION guide for the nest-auth email seam` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, in
docs/DEVELOPMENT_PLAN.md set the P11 **Status to ✅** and **Progress 3 / 3** (+ Last updated), advance **Active phase** to
P12, recompute **Overall progress** to `11 / 15 phases (73%)`, set this file's header Status to ✅ and Progress `3 / 3
tasks`, and commit `docs(plan): P11 complete` (no Co-Authored-By).
```

---

## Phase Completion Protocol

When **Task 11.3** is `✅` and every other task is `✅`:

1. Confirm all 3 tasks are `✅` and the P11 **Definition of Done** in
   [`DEVELOPMENT_PLAN.md § P11`](../DEVELOPMENT_PLAN.md#phase-11--optional-auth-seam-bymax-onenest-auth) is met: the
   adapter maps **all 7** nest-auth email-port methods to canonical templates; **journey 13** shows one event
   (password-reset OTP) end-to-end (rendered → Mailpit → audited); the `notification:` vs `auth:` namespace isolation is
   documented (`docs/AUTH_INTEGRATION.md`); everything is covered at 100%; `nest-auth` remains an illustrative peer (no
   runtime dependency added).
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P11 Status** to `✅`, **Progress** `3 / 3`, **Last
   updated** today; set **Active phase** to `P12`; recompute **Overall progress** to `11 / 15 phases (73%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `3 / 3 tasks`.
5. Commit `docs(plan): P11 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P11 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 11.1 ✅ 2026-06-23 — NotificationAuthEmailProvider adapter (7 port methods → canonical templates)
  </content>
  </invoke>
