# Auth Integration — composing with `@bymax-one/nest-auth`

`@bymax-one/nest-notification` is designed to run **alongside**
[`@bymax-one/nest-auth`](https://github.com/bymaxone/nest-auth) in a real Bymax product. `nest-auth` is a full-stack
authentication library that owns the OTP lifecycle for login, email verification, password reset, and MFA, but
**never imports a mailer** — it delegates every email send via its `IEmailProvider` port. `nest-notification` owns the
mailer: template rendering, HTML-escaping, delivery transport, and the audit log. The composition is a thin adapter
(`NotificationAuthEmailProvider`) that implements the port by delegating to `EmailService.sendTemplate`. The result is
**one mailer, one template registry, and one delivery audit log** — auth emails flow through exactly the same pipeline
as every other transactional send. `@bymax-one/nest-auth` is **not** a hard dependency of this example; it is an
illustrative peer whose port shape is mirrored locally so the build never requires the package at runtime. The full
boundary rationale is in [OVERVIEW.md §14](./OVERVIEW.md#14-ecosystem-fit--coexistence-with-bymax-onenest-auth).

---

## Ownership boundary

The table below defines which library owns each concern. Where a cell says ✅ the library generates, verifies, or
stores the data; where it says ✗ the library has no role.

| Concern                                                                   | `@bymax-one/nest-auth` owns                               | `@bymax-one/nest-notification` owns                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| **Auth OTP** (login email-verification, password reset)                   | ✅ generates + verifies its own codes, tied to user state | ✗ (never duplicate for the same purpose)                    |
| **MFA / TOTP** (authenticator app, recovery codes)                        | ✅                                                        | ✗ (TOTP ≠ delivered OTP)                                    |
| **Email delivery / rendering / templates**                                | ✗ delegates via the `IEmailProvider` port                 | ✅ single mailer + template registry + audit log            |
| **General / transactional OTP** (step-up, phone verification, magic-link) | ✗                                                         | ✅ `OtpService` with pluggable storage + per-purpose config |
| **App transactional emails** (welcome, receipts, alerts)                  | ✗                                                         | ✅ `EmailService`                                           |

**Rule of thumb:** if the concern is login / email-verification / password-reset / MFA → `nest-auth`; anything else →
`nest-notification`.

---

## The adapter

`NotificationAuthEmailProvider`
([`apps/api/src/notification/auth-email.provider.ts`](../apps/api/src/notification/auth-email.provider.ts)) implements
all 7 methods of the `IEmailProvider` port and delegates each to `EmailService.sendTemplate`. The adapter is
**REQUEST-scoped** (`Scope.REQUEST`) so it can resolve the tenant from the active HTTP request's trusted `x-tenant-id`
header without adding `tenantId` as a parameter to the port methods.

### 7-method → canonical template mapping

| `IEmailProvider` method                            | Canonical template    | Template data                                                                                         |
| -------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `sendEmailVerificationOtp(email, otp, locale?)`    | `otp_code`            | `{ code, purpose: 'email_verification', appName }`                                                    |
| `sendPasswordResetOtp(email, otp, locale?)`        | `otp_password_reset`  | `{ code, purpose: 'password_reset', appName }`                                                        |
| `sendPasswordResetToken(email, token, locale?)`    | `password_reset_link` | `{ resetUrl: APP_BASE_URL + '/reset-password?token=…', appName }`                                     |
| `sendMfaEnabledNotification(email, locale?)`       | `mfa_enabled`         | `{ appName }`                                                                                         |
| `sendMfaDisabledNotification(email, locale?)`      | `mfa_disabled`        | `{ appName }`                                                                                         |
| `sendNewSessionAlert(email, sessionInfo, locale?)` | `new_login_alert`     | `{ device, ip, sessionHash, appName }`                                                                |
| `sendInvitation(email, inviteData, locale?)`       | `invitation`          | `{ inviterName, tenantName, acceptUrl: APP_BASE_URL + '/accept-invite?token=…', expiresAt, appName }` |

`otp_code`, `otp_password_reset`, `mfa_enabled`, `mfa_disabled`, and `new_login_alert` are canonical templates
exported by `CANONICAL_EMAIL_TEMPLATES` from `@bymax-one/nest-notification`. `password_reset_link` and `invitation`
are app-registered templates added in
[`apps/api/src/notification/templates.ts`](../apps/api/src/notification/templates.ts).

### Wiring in nest-auth

When `@bymax-one/nest-auth` is present in the application, bind the adapter to its DI token:

```typescript
import { BYMAX_AUTH_EMAIL_PROVIDER } from '@bymax-one/nest-auth'
import { NotificationAuthEmailProvider } from './notification/auth-email.provider.js'

// In a NestJS module providers array:
{ provide: BYMAX_AUTH_EMAIL_PROVIDER, useClass: NotificationAuthEmailProvider }
```

`nest-auth` will inject the bound class whenever it needs to send an auth email. The adapter is already registered as
a plain provider in `apps/api/src/app.module.ts` for the demo; in a real integration the binding above is what
connects nest-auth's DI to the adapter.

### Security invariants

The adapter inherits all of `EmailService.sendTemplate`'s delivery guarantees:

- **No code or token is ever logged.** The OTP, reset token, and invite token are embedded in template data and
  passed directly to the mailer; they never appear in a logger call, an audit row, or a console output.
- **Recipient masking.** The audit log persists `jane@acme.com` as `j***@acme.com` — the raw address never reaches
  the `NotificationLog` table.
- **Single audit path.** A send through this adapter produces the same `NotificationLog` row(s) as any other
  `EmailService.sendTemplate` call (verb `sent` / `failed`, channel `email`, template name, masked recipient, tenant).

---

## Redis namespace isolation

`nest-notification` and `nest-auth` can share a single Redis instance without colliding:

| Library                        | Default namespace | Example keys                                                                                                                                |
| ------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `@bymax-one/nest-notification` | `notification:`   | `notification:otp:<sha256>`, `notification:otp_cd:<sha256>`                                                                                 |
| `@bymax-one/nest-auth`         | `auth:`           | `auth:otp:…`, `auth:rt:…` (refresh tokens), `auth:sess:…` (sessions), `auth:jti:…` (JTI blacklist), `auth:bf:…` (brute-force), `auth:mfa:…` |

The keyspaces are non-overlapping by default. Both namespaces are configurable — keep them distinct when overriding.
`nest-notification` additionally hashes OTP keys as `sha256(tenantId:recipient)`, so no plaintext recipient ever
appears in Redis, and two tenants sharing a recipient never collide.

---

## No OTP duplication

When the adapter sends a password-reset OTP email, the OTP was **generated by nest-auth's own `OtpService`** — the
adapter only renders, delivers, and audits the code nest-auth already minted. The adapter never calls
`nest-notification`'s `OtpService` for auth purposes.

The only integration error to avoid is routing the **same event** through both libraries' OTP — for example, calling
`nest-notification`'s `OtpService.generate` for an email-verification code that nest-auth also generates. That would
produce two codes for one verification slot and break the auth flow. The rule above prevents it: one event, one
owner.

---

## Try it

Journey 13
([`apps/api/src/notification/auth-demo.controller.ts`](../apps/api/src/notification/auth-demo.controller.ts)) is a
dev-only endpoint that demonstrates the seam end-to-end. It mints a local stand-in OTP (representing what
nest-auth's `OtpService` would emit), then delegates to the adapter:

```bash
curl -s -X POST http://localhost:3001/auth-demo/password-reset \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-id: demo' \
  -d '{"to":"user@example.com"}'
# → {"status":"sent"}
```

After the call:

- The rendered email appears in Mailpit at `http://localhost:8025`.
- A `verb: "sent"`, `channel: "email"`, `template: "otp_password_reset"` audit row appears in `GET /audit/logs`.
- No `verb: "generated"` row is present — the adapter does not invoke `OtpService`.
- The response contains no OTP digits.

`@bymax-one/nest-auth` is **not** added to `apps/api/package.json`. The adapter is typed against a local mirror of
the port shape (`apps/api/src/notification/auth-email.types.ts`). In a real integration nest-auth would be a full
runtime dependency, its `OtpService` would own OTP generation, and the adapter would be bound via
`BYMAX_AUTH_EMAIL_PROVIDER` as shown above.
