# Troubleshooting

A symptom → cause → fix reference for `@bymax-one/nest-notification` in this repo. Search by the exact
error code or the symptom string you are seeing.

> **Security issues?** Report them to the email address in [SECURITY.md](../SECURITY.md) — never a public
> GitHub issue.

---

## Email never arrives in Mailpit

**Symptom.** `POST /email/send` returns `{ "messageId": "…" }` but the Mailpit inbox at
`http://localhost:8025` is empty.

**Cause — Mailpit not running.** The most common cause: the `pnpm infra:up` step was skipped or the
container exited.

**Fix.**

1. Run `docker compose ps` and check that `mailpit` is `healthy`.
2. If not: `pnpm infra:up` (or `docker compose up -d mailpit --wait`).
3. If `pnpm infra:up` hangs, check `pnpm infra:logs` for Mailpit's startup error (port conflict at `:1025`
   or `:8025` is common).

**Cause — wrong `SMTP_URL`.** If Mailpit is running but mail does not arrive, `SMTP_URL` may be misconfigured.

**Fix.**

1. Confirm `apps/api/.env` has `SMTP_URL=smtp://localhost:1025`.
2. Restart the API after any `.env` change.

**Cause — `RESEND_API_KEY` is set.** If `RESEND_API_KEY` is in the env, the email provider switches to
Resend and Mailpit receives nothing.

**Fix.** Unset or comment out `RESEND_API_KEY` in `apps/api/.env` to restore the Nodemailer→Mailpit path.

**See also.** [PROVIDERS.md → email provider selection](./PROVIDERS.md#iemailprovider--writing-and-wiring-a-custom-provider),
[ENVIRONMENT.md](./ENVIRONMENT.md).

---

## Cannot find module `@bymax-one/nest-notification`

**Symptom.** The API or the web app fails at boot or build with:

```
Error: Cannot find module '@bymax-one/nest-notification'
```

**Cause.** The sibling `../nest-notification` checkout was never built — its `dist/` is missing. The local
`file:` link points at the source tree, which only works when the library's build output exists.

**Fix.**

1. In a separate terminal, navigate to `../nest-notification` and run:
   ```bash
   pnpm install
   pnpm build --watch   # or: pnpm build (one-shot)
   ```
2. Wait for the build to complete (`dist/{server,shared,react}/index.d.ts` appear).
3. Re-run `pnpm install` in this repo root to resolve the updated link.
4. Restart the API / web app.

**See also.** [GETTING_STARTED.md → Prerequisites](./GETTING_STARTED.md#prerequisites),
[OVERVIEW.md §7](./OVERVIEW.md#7-library-consumption).

---

## OTP verify always fails

**Symptom.** `POST /otp/verify` returns 404 `OTP_NOT_FOUND` even with the correct code.

**Cause — code expired.** The default TTL is 600 seconds (10 minutes). If you waited too long between
generate and verify, the code expired. The library reports expiry as `not_found` (indistinguishable from
"never existed") — this is by design.

**Fix.** Generate a new code and verify promptly, or set a longer `OTP_DEFAULT_TTL_SECONDS` in
`apps/api/.env`.

**Cause — wrong purpose.** The storage key includes the `purpose` field (`sha256(tenantId:recipient)` is
the same, but the entry is purpose-scoped). A `generate` call with `purpose: 'email_verification'` followed
by a `verify` call with `purpose: 'password_reset'` will not find the entry.

**Fix.** Confirm the `purpose` field matches between `generate` and `verify`.

**Cause — wrong `x-tenant-id`.** The storage key is `sha256(tenantId:recipient)`. Generating under `acme`
and verifying under `globex` look up different keys.

**Fix.** Use the same `x-tenant-id` header in both requests.

**Cause — InMemoryOtpStorage lost state on restart.** If the API restarted between `generate` and `verify`
and `REDIS_URL` is not set, the in-memory store was cleared.

**Fix.** Set `REDIS_URL` (or generate a new code after the restart).

**See also.** [MULTI_TENANCY.md](./MULTI_TENANCY.md), [ENVIRONMENT.md](./ENVIRONMENT.md).

---

## `pnpm dev` freezes the machine

**Symptom.** Running `pnpm dev` causes the OS to thrash swap and become unresponsive. The machine may freeze
for 30+ seconds or require a forced reboot.

**Cause.** `pnpm dev` fans out two Node watchers (`nest start --watch` for the API, `next dev` for the web
app) with uncapped heaps. On a RAM-constrained machine, the combined heap pressure (especially on the initial
compilation) can exhaust physical RAM and push the OS into swap.

The hazard is amplified if the library is reloaded into multiple Jest workers simultaneously — see below.

**Fix — cap the heaps.**

Start each watcher with an explicit heap cap — `--max-old-space-size=2048` for the API and
`--max-old-space-size=4096` for the web app — so neither process can grow into swap:

```bash
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @nest-notification-example/api dev
NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter web dev
```

**Fix — start one service at a time.**

```bash
# Terminal 1 — API only
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @nest-notification-example/api start:dev

# Terminal 2 — Web only
NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter web dev
```

**Fix — prefer built output over watch mode.**

```bash
pnpm build             # one-shot build for both apps
node apps/api/dist/main.js   # run the API without a watcher
pnpm --filter web start      # run Next.js in production mode
```

**See also.** [OVERVIEW.md §8](./OVERVIEW.md#8-local-stack--memory-safe-run) — the full memory-safe run recipe.

---

## `OTP_COOLDOWN_ACTIVE` — 429 on generate

**Symptom.** `POST /otp/generate` returns HTTP 429:

```json
{ "error": { "code": "OTP_COOLDOWN_ACTIVE", "details": { "remainingSeconds": 58 } } }
```

**Cause.** The resend cooldown window is active. `OTP_RESEND_COOLDOWN_SECONDS` (default 60s) prevents spam
generate requests.

**Fix.** Wait for the cooldown to expire (`remainingSeconds` in the response), then retry. The `Retry-After`
response header carries the same value for clients that parse standard HTTP headers. The OTP panel's
**Resend** button is automatically disabled until the cooldown clears.

---

## `OTP_MAX_ATTEMPTS_EXCEEDED` — 429 on verify

**Symptom.** `POST /otp/verify` returns HTTP 429 after several wrong guesses:

```json
{ "error": { "code": "OTP_MAX_ATTEMPTS_EXCEEDED" } }
```

**Cause.** `defaultMaxAttempts` (default: configured per-purpose) wrong attempts were consumed. The atomic
`consumeAttempt` counter reached zero.

**Fix.** Generate a new code (the old entry is exhausted). The counter is not resettable — this is the
brute-force protection behavior.

---

## `EMAIL_SEND_FAILED` — 502 on send

**Symptom.** `POST /email/send` or `POST /otp/generate` (with `deliverVia: 'email'`) returns HTTP 502:

```json
{ "error": { "code": "EMAIL_SEND_FAILED" } }
```

**Cause.** The active `IEmailProvider.send` threw. Common root causes:

1. Mailpit is down — `docker compose ps` shows `mailpit` as unhealthy.
2. Resend API key is invalid or expired.
3. `SMTP_URL` is malformed or points at an unreachable host.

**Fix.** Verify the relevant service is running and the corresponding env variable is correct. Check
`pnpm infra:logs` for Mailpit startup errors.

---

## CORS error in the browser console

**Symptom.** The browser shows `Access-Control-Allow-Origin` errors when the console (`http://localhost:3003`)
calls the API.

**Cause.** `WEB_ORIGIN` in `apps/api/.env` does not match the actual origin the browser requests from.

**Fix.** Ensure `WEB_ORIGIN=http://localhost:3003` in `apps/api/.env` and restart the API.

---

## `TEMPLATE_NOT_FOUND` — 404 on send-template

**Symptom.** `POST /email/send-template` returns HTTP 404:

```json
{ "error": { "code": "TEMPLATE_NOT_FOUND" } }
```

**Cause.** The requested template name is not registered in `apps/api/src/notification/templates.ts` (or
the locale fallback chain also failed — neither `locale` nor `en` is registered).

**Fix.** Add the template to `templates.ts` under the `${name}::en` key (or the specific locale required).
See [TEMPLATING.md](./TEMPLATING.md) for the registration format.

---

## See also

- [GETTING_STARTED.md](./GETTING_STARTED.md) — initial setup steps and common-snag quick links
- [ENVIRONMENT.md](./ENVIRONMENT.md) — env variable reference
- [PROVIDERS.md](./PROVIDERS.md) — email provider selection
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — tenant / recipient key details
- [DEPLOYMENT.md](./DEPLOYMENT.md) — production configuration checklist
