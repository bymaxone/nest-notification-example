---
applyTo: 'apps/**/*.ts,apps/**/*.tsx'
---

# Source code standards (apps/api · apps/web)

## TypeScript flags — practical impact (`tsconfig.base.json`)

- **`noUncheckedIndexedAccess`**: `arr[i]` / `record[k]` is `T | undefined`. Guard every index access.
- **`exactOptionalPropertyTypes`**: build objects with **conditional spreads** (`...(v ? { x: v } : {})`); never assign explicit `undefined` to an optional prop.
- **`verbatimModuleSyntax`**: type-only imports MUST use `import type`; type re-exports use `export type`.
- **`noImplicitOverride` / `noImplicitReturns` / `noFallthroughCasesInSwitch`**: `override` on Nest lifecycle hooks; every path returns; no switch fall-through.

## ESLint (flat, `recommendedTypeChecked`) — errors

`no-explicit-any`, `no-floating-promises` (mark fire-and-forget with `void`), `no-misused-promises`, `no-unsafe-*`. No suppression comments in `apps/`. Only test files relax `no-unsafe-*` / `no-explicit-any`.

## Backend (NestJS — apps/api)

- DI only; inject via the constructor. Validate query/body with a Zod schema through `ZodValidationPipe`. Layered: controller → service → provider/repository; no cross-feature imports.
- Wire the library through `BymaxNotificationModule.forRootAsync({ useFactory })` reading `ConfigService`. The library ships no controllers/DTOs — the demo controllers map onto `EmailService` / `OtpService` / `NotificationService`. Map `verify` in the controller, not in the library.
- **Never log or return an OTP code.** Hash recipient keys (`hashTenantRecipient`); mask recipients (`maskRecipient`) in audit rows and responses.
- Resolve the tenant from a trusted source (`x-tenant-id` header / JWT claim, never the body) and thread it into every audit query. DB via `PrismaService`; raw SQL uses `Prisma.sql` tagged templates — never interpolate user input.
- `enableShutdownHooks()`; keep `audit.swallowErrors: true` so an audit outage can't break delivery.

## Frontend (Next.js 16 App Router — apps/web)

- `'use client'` only on leaf components — never in `layout.tsx`. URL-state pages set `export const dynamic = 'force-dynamic'`.
- Import library types/codes from `@bymax-one/nest-notification/shared` and hooks from `/react` — **never** the `.` root.
- Filter state is **nuqs URL state** (single source of truth); server state via **TanStack Query**.
- Localize every `NOTIFICATION_ERROR_CODES` key (the `audit:error-codes` gate). Status = colour **+** icon **+** text, never colour alone.
- The shared design-system files are **byte-identical** to `nest-logger-example` — never re-styled.
- Live tail uses `EventSource` through the same-origin proxy route; the buffer is bounded + `requestAnimationFrame`-flushed.

## Security & PII

- The tenant/role come from trusted headers; never log secrets/tokens/OTP codes/recipient PII. CORS is an explicit allow-list (`WEB_ORIGIN`); expose `Retry-After`. Comments are timeless — no plan-stage references in code.
