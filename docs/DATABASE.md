# Database

The audit store behind `INotificationLogRepository` — the `NotificationLog` schema, the `@prisma/adapter-pg`
client, the keyset-pagination and aggregate query shapes the read-API uses, and how recipient masking is
persisted.

For the delivery pipeline that writes to this store, see **[ARCHITECTURE.md](./ARCHITECTURE.md)**. For the
console that reads it, see **[DASHBOARD.md](./DASHBOARD.md)**.

---

## The `@prisma/adapter-pg` driver adapter

Prisma 7 is ESM-first. The example uses the `@prisma/adapter-pg` driver adapter rather than the legacy
connection string wired directly into the Prisma schema. The connection URL never appears in `schema.prisma`;
it is resolved at runtime by `PrismaService` (via `ConfigService`) and passed to the adapter:

```typescript
// apps/api/src/prisma/prisma.service.ts (shape)
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: config.get('DATABASE_URL') })
const prisma = new PrismaClient({ adapter })
```

The `prisma.config.ts` file in `apps/api` reads `DATABASE_URL` from `process.env` so the Prisma CLI
(`db:migrate`, `db:seed`, `db:generate`) can run without booting the NestJS app.

> **Why the adapter approach?** Prisma 7 removed the `url` field from the `datasource` block; the driver
> adapter is the canonical way to pass connection configuration. It also makes the connection object injectable
> through NestJS DI rather than an implicit module-level side effect.

---

## Schema

```prisma
/// One delivery-audit entry — mirrors the library's NotificationLogEntry.
/// Indexed for tenant-scoped keyset pagination and channel/verb filtering.
model NotificationLog {
  id           String   @id @default(uuid())
  timestamp    DateTime @default(now())
  tenantId     String
  channel      String   // 'email' | 'otp'
  verb         String   // 'generated' | 'sent' | 'verified' | 'failed' | 'cooldown_blocked' | 'max_attempts_exceeded'
  recipient    String   // already-masked when maskRecipient is on (j***@acme.com)
  purpose      String?  // OTP purpose ('email_verification', 'password_reset', …)
  providerName String   // 'nodemailer' | 'resend' | 'no-op' | '__interceptor__'
  messageId    String?  // returned by IEmailProvider.send — absent for OTP rows
  errorMessage String?  @db.Text  // message only, NEVER a stack trace
  userId       String?
  metadata     Json?

  // Tenant-scoped recent-activity feed (newest first).
  @@index([tenantId, timestamp(sort: Desc)])
  // Tenant-scoped channel + verb filter.
  @@index([tenantId, channel, verb])
  // Per-user activity timeline (newest first).
  @@index([userId, timestamp(sort: Desc)])
  // Global keyset pagination cursor (timestamp DESC, id DESC).
  @@index([timestamp(sort: Desc), id(sort: Desc)])
  @@map("notification_logs")
}

/// Demo tenants seeded by prisma/seed.ts (acme, globex) — visible in the tenant switcher.
model Tenant {
  id        String   @id     // human-readable slug: 'acme', 'globex'
  name      String
  createdAt DateTime @default(now())
  @@map("tenants")
}
```

> **No `code` column.** A generated OTP code must never be persisted. The schema enforces this by simply not
> having a `code` field. The library's `NotificationLogEntry` type does not carry a code either.

> **No `PendingUser` model.** The Prisma schema in this example contains only `NotificationLog` and `Tenant`.
> A `PendingUser` demo model is referenced in `OVERVIEW §10` as a possible extension but was not implemented —
> it is not needed to demonstrate the library.

---

## Migrations and seeding

```bash
# Apply the latest migration (safe to run against an existing database)
pnpm --filter @nest-notification-example/api db:migrate

# Seed demo tenants (acme + globex) and the sample template registry
pnpm --filter @nest-notification-example/api db:seed
```

`db:migrate` runs `prisma migrate deploy`, which applies any pending migrations non-interactively. It is safe
to call in CI and on a fresh production database. `db:seed` runs `tsx prisma/seed.ts`.

---

## Masked-recipient persistence

When `audit.maskRecipient` is configured, `PrismaNotificationLogRepository.create(entry)` receives an entry
whose `recipient` field is **already masked** — the masking runs inside the library before the repository
is called, not inside the repository itself. The value stored in Postgres is `j***@acme.com`, never
`jane@acme.com`. A Settings toggle in the console (`/settings`) compares masked vs unmasked rows by
toggling the `AUDIT_MASK_RECIPIENT` env variable and restarting.

The masking function ships with `@bymax-one/nest-notification` and is wired in `notification.config.ts`:

```typescript
maskRecipient: (recipient) => {
  const [local, domain] = recipient.split('@')
  return `${local[0]}***@${domain}`
}
```

---

## The keyset read-API

### `GET /audit/logs` — paginated list

The audit read service uses **keyset pagination** — cursor = the last row's `(timestamp, id)` — so pages
never drift when new rows arrive. A stale or foreign cursor returns 410.

**Query shape:**

```
GET /audit/logs?tenantId=acme&channel=otp&verb=generated&limit=20&cursor=2026-06-24T10:00:00.000Z_uuid
```

**Response shape:**

```json
{
  "data": [{ "id": "…", "tenantId": "acme", "verb": "generated", "recipient": "a***@acme.com", … }],
  "nextCursor": "2026-06-24T09:59:00.000Z_uuid",
  "hasMore": true
}
```

Supported filters: `tenantId`, `channel`, `verb`, `recipient` (partial match), `purpose`.

### `GET /audit/stream` — SSE live tail

`@Sse` endpoint backed by `rxjs Observable<MessageEvent>`. Each event's `id` is the row's keyset cursor
(`timestamp_uuid`) so a reconnect can resume from `Last-Event-ID` without re-sending rows the client already
has. The Explorer's **live tail** toggle engages follow-mode (pinned-to-bottom auto-scroll; scrolling up
pauses with an "N new — jump to latest" pill).

### `GET /audit/aggregate` — delivery-health charts

```
GET /audit/aggregate?from=2026-06-23T00:00:00Z&to=2026-06-24T00:00:00Z&tenantId=acme
```

Returns time-bucketed counts by `verb`/`channel`/`provider` used by the Overview panel's send/verify/failure
rate and provider-mix charts.

---

## Schema indexes rationale

| Index                                   | Query it serves                                                          |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `[tenantId, timestamp DESC]`            | Tenant-scoped recent-activity feed (Explorer default sort)               |
| `[tenantId, channel, verb]`             | Faceted filter bar (e.g. all failed OTP sends for tenant)                |
| `[userId, timestamp DESC]`              | Per-user activity timeline (future consumer feature)                     |
| `[timestamp DESC, id DESC]`             | Global keyset cursor — the stable, monotonic page boundary               |

---

## See also

- [ARCHITECTURE.md](./ARCHITECTURE.md) — the delivery pipeline that writes to this store
- [DASHBOARD.md](./DASHBOARD.md) — the Audit Explorer that reads it
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — the recipient masking and sha256 key guarantees
- [ENVIRONMENT.md](./ENVIRONMENT.md) — `DATABASE_URL` and production Postgres configuration
