# Getting started

From a clean clone to a NestJS API delivering a **real email in Mailpit** and a **verified OTP** — in about
five minutes. Zero external credentials required.

This is the front door. Every deep dive lives in a sibling doc, linked inline. If you only read one page,
read this one.

---

## Prerequisites

| Tool             | Version                   | Check                      |
| ---------------- | ------------------------- | -------------------------- |
| Node.js          | `>= 24`                   | `node -v` (`nvm use`)      |
| pnpm             | `11.x`                    | `pnpm -v`                  |
| Docker Compose   | v2                        | `docker compose version`   |
| Sibling lib repo | at `../nest-notification` | `ls ../nest-notification/` |

The repo pins Node 24 in `.nvmrc`, so `nvm use` selects the right runtime.

> **The library is not on npm yet.** `@bymax-one/nest-notification` is consumed through a local
> [`file:`](./OVERVIEW.md#7-library-consumption) to the **sibling** `../nest-notification` checkout (both
> repos live side by side under `…/bymax-one/`). Before installing this repo, build the library once and
> keep its `dist/` fresh:
>
> ```bash
> # one terminal — keep the library's dist/ rebuilding (sibling of this repo)
> cd ../nest-notification
> pnpm install
> pnpm build --watch   # tsup watch — emits the dual ESM/CJS subpath build
> ```
>
> Leave that running. See [OVERVIEW §7](./OVERVIEW.md#7-library-consumption) for the `file:` mechanics and
> what changes once the library publishes.

---

## Quick start

With the library building in the other terminal, from the **repo root**:

```bash
# 1. Install workspace deps (resolves the file: link to ../nest-notification)
pnpm install

# 2. Bring up Postgres + Redis + Mailpit, and wait for every healthcheck
pnpm infra:up

# 3. Create the API env file from the root template
cp .env.example apps/api/.env

# 4. Apply the audit schema migration + seed demo tenants
pnpm --filter @nest-notification-example/api db:migrate
pnpm --filter @nest-notification-example/api db:seed

# 5. Start the API + console together (each in watch mode)
pnpm dev
```

`pnpm infra:up` runs `docker compose up -d --wait`, so it blocks until every backend reports healthy.
`pnpm dev` fans out both apps in parallel.

> **On a RAM-constrained machine,** `pnpm dev` runs two watchers with uncapped Node heaps and can
> swap-thrash the system — see
> [TROUBLESHOOTING.md → `pnpm dev` freezes the machine](./TROUBLESHOOTING.md#pnpm-dev-freezes-the-machine)
> for capped / built-output alternatives.

---

## What you should see

| Surface                     | URL                            | Notes                                                             |
| --------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| **Console** (`apps/web`)    | <http://localhost:3003>        | Overview, Trigger Center, Audit Explorer, OTP, Providers, Roadmap |
| **API health** (`apps/api`) | <http://localhost:3001/health> | Liveness probe                                                    |
| **Mailpit inbox**           | <http://localhost:8025>        | Every email the demo sends lands here — no real SMTP needed       |

---

## Your first email

Fire a raw email send at the API. The email is delivered through the custom Nodemailer→Mailpit provider, so
it lands in the browsable inbox at `http://localhost:8025` within seconds:

```bash
curl -sS -X POST http://localhost:3001/email/send \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{
    "to": "alice@acme.com",
    "subject": "Hello from nest-notification",
    "html": "<p>Your first notification email.</p>",
    "text": "Your first notification email."
  }'
```

Expected response:

```json
{ "messageId": "<…@mailpit.local>" }
```

Open `http://localhost:8025` — the message is there. The delivery row also appears in the Audit Explorer at
`http://localhost:3003/explorer`.

---

## Your first OTP

Generate an OTP (delivered to Mailpit), then verify it:

```bash
# 1. Generate — the code is emailed to alice@acme.com via the otp_code template
curl -sS -X POST http://localhost:3001/otp/generate \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "recipient": "alice@acme.com", "purpose": "email_verification", "deliverVia": "email" }'
```

```json
{ "expiresAt": "2026-06-24T10:05:00.000Z", "cooldownSeconds": 60 }
```

Open Mailpit (`http://localhost:8025`) and copy the 6-digit code from the email. Then verify it:

```bash
# 2. Verify — replace 123456 with the real code from Mailpit
curl -sS -X POST http://localhost:3001/otp/verify \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "recipient": "alice@acme.com", "purpose": "email_verification", "code": "123456" }'
```

A 200 response confirms success. A wrong code returns 401 with `OTP_INVALID_CODE`; exhausted attempts return
429 with `OTP_MAX_ATTEMPTS_EXCEEDED`.

---

## Prefer the console?

You do not need `curl`. Open the **Trigger Center** at `http://localhost:3003/trigger` and use the
Send Email or OTP Generate/Verify cards — they fire the same requests and auto-pivot the Audit Explorer
to the resulting row. The full guided tour is in **[FEATURES.md](./FEATURES.md)**.

---

## Common snags

| Symptom                                             | Most likely cause                                             | Fix                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Email never arrives in Mailpit                      | Mailpit container is not running or `SMTP_URL` is wrong       | [TROUBLESHOOTING → "Email never arrives in Mailpit"](./TROUBLESHOOTING.md#email-never-arrives-in-mailpit)      |
| `Cannot find module '@bymax-one/nest-notification'` | The sibling `file:` link was never built — `dist/` is missing | [TROUBLESHOOTING → "Cannot find module …"](./TROUBLESHOOTING.md#cannot-find-module-bymax-onenest-notification) |
| OTP verify always fails with `OTP_NOT_FOUND`        | The code expired or the wrong purpose/recipient was sent      | [TROUBLESHOOTING → "OTP verify always fails"](./TROUBLESHOOTING.md#otp-verify-always-fails)                    |
| `pnpm dev` freezes the machine                      | Uncapped heaps + file: dependency reloaded in every watcher   | [TROUBLESHOOTING → "`pnpm dev` freezes the machine"](./TROUBLESHOOTING.md#pnpm-dev-freezes-the-machine)        |

---

## Where to next

- **[FEATURES.md](./FEATURES.md)** — every library feature fired and shown working, plus all 13 end-to-end journeys.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the four-stage delivery pipeline and the module boundaries.
- **[ENVIRONMENT.md](./ENVIRONMENT.md)** — every environment variable and what it feeds.
- **[PROVIDERS.md](./PROVIDERS.md)** — writing and wiring a custom `IEmailProvider` or `IOtpStorage`.
- **[DASHBOARD.md](./DASHBOARD.md)** — the full console information architecture.
- **[OVERVIEW.md](./OVERVIEW.md)** — the full product blueprint.
