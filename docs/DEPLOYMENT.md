# Deployment

The production checklist for running `nest-notification-example` — container images, managed backends,
security settings, and shutdown. Anything that goes wrong at runtime is in
**[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**.

---

## Production checklist

- **Managed PostgreSQL** — point `DATABASE_URL` at a managed Postgres instance. The Zod schema rejects
  loopback URLs in production (`localhost` / `127.0.0.1` / `[::1]`), so a misconfigured dev URL is caught
  at boot.
- **Managed Redis** — set `REDIS_URL` to a managed Redis (so OTP storage is durable and atomic across API
  instances). Without it the API falls back to `InMemoryOtpStorage` — codes are lost on restart and cannot
  be shared across instances.
- **Real email provider** — set `RESEND_API_KEY` (or wire your own `IEmailProvider`) and a verified
  `MAIL_FROM` domain. The default `NodemailerEmailProvider → Mailpit` path is for local development only.
- **`WEB_ORIGIN` must be `https://`** — the Zod schema enforces this in production. The CORS policy exposes
  the `Retry-After` header (OTP cooldown UX) only to this origin.
- **`AUDIT_MASK_RECIPIENT=true`** (the default) — keep recipient masking on so the Postgres audit table
  does not store plain email addresses.
- **`audit.swallowErrors: true`** (the default) — an audit outage must never break delivery. If you need
  zero-tolerance auditing, set `false` and monitor `AUDIT_LOG_FAILED` responses.
- **`tenantIdResolver` from a trusted source** — in production the resolver must read a JWT claim or a
  gateway-checked header, not a client-supplied header. The demo trusts `x-tenant-id` directly; a real
  deployment validates the header at the gateway before it reaches the API.
- **`app.enableShutdownHooks()` is NOT used** — `main.ts` owns a single idempotent SIGTERM/SIGINT handler
  that calls `app.close()` (draining NestJS shutdown hooks — Redis and Prisma release connections) before
  exiting. Enabling `enableShutdownHooks()` in NestJS 11 re-raises the signal and races this owner.

---

## Container images

`release.yml` (on a `v*` tag) builds and pushes two multi-stage images via OIDC to GHCR:

| Image                                            | Dockerfile            | Exposes |
| ------------------------------------------------ | --------------------- | ------- |
| `ghcr.io/bymaxone/nest-notification-example-api` | `apps/api/Dockerfile` | `3001`  |
| `ghcr.io/bymaxone/nest-notification-example-web` | `apps/web/Dockerfile` | `3003`  |

Both images are built from the repo root so the workspace `pnpm-lock.yaml` is available during the build.
The web image accepts the build argument `NEXT_PUBLIC_API_URL` (default: `https://example.com/api`).

```bash
# Pull a specific release
docker pull ghcr.io/bymaxone/nest-notification-example-api:0.1.0
docker pull ghcr.io/bymaxone/nest-notification-example-web:0.1.0
```

---

## Env vars — production values

| Variable               | Dev default                     | Production value                                  |
| ---------------------- | ------------------------------- | ------------------------------------------------- |
| `NODE_ENV`             | `development`                   | `production`                                      |
| `DATABASE_URL`         | `postgresql://…@localhost:5432` | managed Postgres URL (no loopback)                |
| `REDIS_URL`            | _(unset)_                       | managed Redis URL (no loopback)                   |
| `SMTP_URL`             | `smtp://localhost:1025`         | _(unset — use `RESEND_API_KEY` instead)_          |
| `RESEND_API_KEY`       | _(unset)_                       | your Resend API key (or your custom provider)     |
| `MAIL_FROM`            | `no-reply@notification.local`   | a verified domain address (`noreply@yourapp.com`) |
| `WEB_ORIGIN`           | `http://localhost:3003`         | `https://app.yourapp.com`                         |
| `AUDIT_MASK_RECIPIENT` | `true`                          | `true`                                            |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:3001`         | `https://api.yourapp.com`                         |

Full reference: **[ENVIRONMENT.md](./ENVIRONMENT.md)**.

---

## Running alongside `@bymax-one/nest-auth`

If this example runs in the same application as `@bymax-one/nest-auth`:

1. **Keep Redis namespaces distinct.** Set `redisNamespace: 'notification'` for this library and a different
   value (e.g. `'auth'`) for `nest-auth` so their keys never collide.
2. **Use a single mailer.** Implement `nest-auth`'s `IEmailProvider` port by delegating to this example's
   `EmailService.sendTemplate` — one template registry, one audit log. See
   [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md).
3. **Do not duplicate OTP generation.** Auth OTPs (email verification, password reset) belong to
   `nest-auth`. General / transactional OTPs (step-up, magic-link, phone verification) belong to
   `nest-notification`'s `OtpService`.

---

## Branch protection (go-public note)

The `main` branch is configured with:

- PR-only merges (no direct push).
- Required status checks by name: `install`, `lint`, `typecheck`, `unit`, `e2e-api`, `e2e-web`,
  `export-usage-check`, `coverage-report`.
- Signed commits required.
- Linear history (no merge commits).

Security reports go to the email address in `SECURITY.md` — never a public GitHub issue.

---

## Version pins

The example pins exact versions for the core frameworks (NestJS 11, Next.js 16, React 19, Tailwind 4,
Prisma 7, Node 24) as defined in the workspace `package.json` files. Library updates are managed by
Renovate (pinning `@bymax-one/nest-notification` — never auto-merged). See
[docs/RELEASES.md](./RELEASES.md) for the per-branch library version.

---

## See also

- [ENVIRONMENT.md](./ENVIRONMENT.md) — full env-var reference and production guards
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — symptom → cause → fix for common runtime issues
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — `tenantIdResolver`, `maskRecipient`, namespace isolation
- [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) — running alongside `@bymax-one/nest-auth`
- [OVERVIEW.md §18](./OVERVIEW.md#18-deployment-notes) — full deployment section
