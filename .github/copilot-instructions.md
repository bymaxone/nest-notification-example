# nest-notification-example — Repository Instructions

`nest-notification-example` is the **reference/demo app** for `@bymax-one/nest-notification` (consumed via a local `file:`/`link:`, never modified here). A `pnpm` monorepo: a NestJS API that hosts the library and a Next.js console that fires every feature and reads the delivery audit log. Runtime: Node `>=24`. Package manager: `pnpm@11.x` (`--frozen-lockfile`).

## Apps

- **`apps/api`** — NestJS 11 + Express 5 + Prisma 7 (PostgreSQL audit) + ioredis (OTP). Wires `BymaxNotificationModule.forRootAsync({ useFactory })`; hosts the demo controllers (`/otp/*`, `/email/*`, `/dispatch`, `/channels`, `/audit/*`, `/admin/*`, `/health`) — the library ships no controllers.
- **`apps/web`** — Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn + TanStack Query/Table/Virtual + nuqs + Recharts; the Notification Console. Reads the API; imports only the isomorphic `/shared` + `/react` subpaths.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm typecheck             # tsc --noEmit across every package
pnpm lint                  # eslint . --max-warnings 0 (flat, recommendedTypeChecked)
pnpm format:check          # prettier --check .
pnpm test:cov              # Jest (apps/api) + Vitest (apps/web), 100%
pnpm audit:exports         # every public export referenced in apps/**
pnpm audit:error-codes     # every NOTIFICATION_ERROR_CODES key localized in apps/web
pnpm infra:up / infra:down # docker compose (Postgres / Redis / Mailpit)
```

## Non-negotiable rules

1. **TypeScript 5.9 strict** + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`. **Zero `any`, zero suppression comments** (`@ts-ignore`, `@ts-expect-error`, `eslint-disable*`).
2. **Never import the `@bymax-one/nest-notification` `.` (server) root in `apps/web`** — it pulls in Nest/Node and breaks the browser bundle. Use `/shared` (types, `NOTIFICATION_ERROR_CODES`, purpose/channel unions) and `/react` (`useOtpInput`, `useOtpCountdown`).
3. **Never log or return an OTP code.** Hash recipient keys (`hashTenantRecipient`, sha256); mask recipients (`maskRecipient`) in audit rows and responses.
4. **Multi-tenant.** Resolve the tenant from a trusted source — the `x-tenant-id` header / a JWT claim, never the request body — via the library `tenantIdResolver`, and thread it into every audit read.
5. **Map `verify` in the controller, not in the library.** The library exposes the atomic OTP contract; the demo controller composes it.
6. **Production-shaped wiring.** `forRootAsync({ useFactory })` from `ConfigService`; real `IEmailProvider` (Nodemailer→Mailpit / Resend), `IOtpStorage` (Redis / in-memory), `INotificationLogRepository` (Prisma). Validate DTOs with Zod via `ZodValidationPipe`; env via the Zod schema (fail-fast).
7. **Quality bar.** 100% coverage (statements/branches/functions/lines), Stryker `break: 95`, every export referenced (`audit:exports`), every error code localized (`audit:error-codes`).
8. **Conventional Commits**; English-only, timeless comments (no plan-stage references); JSDoc on file headers + every export; boolean naming `is`/`has`/`should`/`can`; secrets only via env, never logged.

## Design system

The shared design files (`globals.css` / `tailwind.config.ts` / `components.json` / `components/ui/*`) are copied **byte-identical** from `nest-logger-example`. Never re-style them or run a design tool over them.
