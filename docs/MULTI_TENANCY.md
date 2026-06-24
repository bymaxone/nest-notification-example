# Multi-tenancy

How `@bymax-one/nest-notification` isolates tenants and protects recipient privacy — the `sha256` storage
keys, the `tenantIdResolver` anti-spoofing model, `maskRecipient`, and the never-log-codes invariant with
its regression-test proof.

For the deploy-time configuration, see **[DEPLOYMENT.md](./DEPLOYMENT.md)**. For the full blueprint, see
**[OVERVIEW.md §13](./OVERVIEW.md#13-multi-tenant-security--recipient-privacy)**.

---

## SHA-256 storage keys

OTP entries and cooldown records are keyed by `sha256(tenantId:recipient)` — never the plaintext recipient.
The 64-hex key makes two guarantees:

1. **An operator with Redis access cannot enumerate which email addresses have a pending OTP.** The key is a
   one-way hash; it cannot be reversed to recover the address.
2. **Two tenants sharing the same recipient email never collide.** `sha256("acme:alice@acme.com")` is
   completely different from `sha256("globex:alice@acme.com")`.

The library computes the key before calling any `IOtpStorage` method. Storage implementations never see the
plaintext recipient.

### Proof in the console

`GET /debug/key?tenantId=acme&recipient=alice@acme.com` returns the raw 64-hex key. The **Inspect OTP**
panel in the OTP view calls this endpoint and displays the opaque key alongside the OTP status, showing that
an operator cannot learn PII from Redis monitoring.

```bash
curl -sS 'http://localhost:3001/debug/key?tenantId=acme&recipient=alice%40acme.com'
# → { "key": "3e2dc4…" }
```

---

## `tenantIdResolver` anti-spoofing model

The library's `tenantIdResolver` is consulted by the **`NotificationAuditInterceptor`** when it writes the
audit row. The resolver's return value is the authoritative `tenantId` for the audit entry — a `tenantId`
forged in the request body is silently overridden.

### On the `/dispatch` route (intercepted)

```
POST /dispatch
  body: { channel:'email', payload:{ tenantId:'evil-corp', … } }   ← forged
  header: x-tenant-id: acme                                         ← trusted

  NotificationAuditInterceptor calls tenantIdResolver(req)
  → tenantIdResolver reads req.headers['x-tenant-id'] → 'acme'
  → audit row: { tenantId: 'acme' }                                ← resolver wins
```

### On the direct routes (`/otp/*`, `/email/*`)

The `NotificationAuditInterceptor` is not applied to direct service routes. The controller itself is
responsible for deriving the trusted `tenantId` before calling the service method:

```typescript
// OtpController.generate (shape)
@Post('generate')
async generate(@Headers('x-tenant-id') tenantId: string, @Body() dto: GenerateDto) {
  // tenantId comes from the trusted header, never from the DTO body
  return this.otpService.generate({ tenantId, … })
}
```

### The spoof-tenant demo

The **Spoof tenant** toggle in the Trigger Center (`/trigger`) posts a forged `payload.tenantId` to
`/dispatch` alongside a real `x-tenant-id: acme` header. The Explorer shows the resulting audit row with
`tenantId: acme` — the body value is discarded. This is the proof that wiring the resolver correctly makes
the audit trust an authoritative source, not user-controlled input.

---

## Recipient masking

`audit.maskRecipient` minimizes the recipient before it is passed to `INotificationLogRepository.create`.
The masking function in `notification.config.ts`:

```typescript
maskRecipient: (recipient: string) => {
  const [local, domain] = recipient.split('@')
  return `${local[0]}***@${domain}`
}
// jane@acme.com → j***@acme.com
```

The masking runs **inside the library**, before the repository call. `PrismaNotificationLogRepository`
receives the already-masked string and stores it as-is in the `recipient` column — it never sees the
plaintext address. Toggle `AUDIT_MASK_RECIPIENT=false` and restart to compare plain vs masked rows in the
Explorer.

> **Production invariant:** always keep `AUDIT_MASK_RECIPIENT=true` (the default). Storing plain addresses
> in the audit log means anyone with Postgres access can enumerate all recipients of all notifications.

---

## The never-log-codes invariant

An OTP code **must never appear** in:

- An audit row (`NotificationLog` — no `code` column exists in the schema by design).
- A logger call (the controller, service, and provider all avoid logging the code).
- An `errorMessage` (the library records the message only, never a stack trace or payload).
- A response body (the `getStatus` endpoint returns status only, never the code).

### The regression test

`apps/api/test/` includes a regression test that asserts the invariant for every OTP generate + audit write:

```typescript
// apps/api/test/never-log-codes.e2e-spec.ts (shape)
it('audit entry never contains the OTP code', async () => {
  const { code } = await forceGenerateWithKnownCode()  // internal test helper
  const entries = await prisma.notificationLog.findMany()
  for (const entry of entries) {
    expect(JSON.stringify(entry).includes(code)).toBe(false)
  }
})
```

### The Explorer proof

Every detail drawer in the Audit Explorer has a **"Never-contains-code"** tab that performs the same check
client-side: it takes the code the user submitted in the OTP panel's verification attempt, serializes the
fetched audit entry to JSON, and asserts the code is absent — rendering a green check (`✅ OTP code not
found in audit entry`) or a red alert if the invariant is broken.

---

## Redis namespace isolation (multi-library)

The `redisNamespace` option (default `notification`) prefixes every key the library writes:
`notification:otp:<sha256key>`, `notification:otp_cd:<sha256key>`. When running alongside
`@bymax-one/nest-auth`, set distinct namespaces:

```typescript
global: { redisNamespace: 'notification' }  // this library
// nest-auth uses: auth: (its own config)
```

The two keyspaces never overlap — there is no cross-read or collision risk on a shared Redis instance.
See [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) for the full boundary.

---

## See also

- [DATABASE.md](./DATABASE.md) — the `NotificationLog` schema (no `code` column, masked `recipient`)
- [DEPLOYMENT.md](./DEPLOYMENT.md) — production guards for `tenantIdResolver` and `maskRecipient`
- [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) — Redis namespace boundary with `nest-auth`
- [OVERVIEW.md §13](./OVERVIEW.md#13-multi-tenant-security--recipient-privacy) — full security section
