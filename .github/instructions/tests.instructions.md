---
applyTo: '**/*.spec.ts,**/*.spec.tsx,**/*.e2e-spec.ts'
---

# Testing standards

## Gates

- **Coverage 100%** (statements/branches/functions/lines): Jest for `apps/api` (ESM via `NODE_OPTIONS=--experimental-vm-modules` + `ts-jest`, `tsconfig.test.json`), Vitest for `apps/web`. `maxWorkers: '50%'` is baked in — run suites sequentially, never fan out parallel test agents (the locally linked library is duplicated across workers).
- **Mutation: Stryker `break: 95`** (driven toward 100). Write mutation-aware assertions now.

## Structure & naming

```
describe('ClassName')
  describe('#method()')              // '.' for a static method
    it('should <outcome> when <condition>')
```

Every `it` states the behaviour — never `it('works')`. Add a block comment to each test: the scenario + the rule it protects. Test through the public/exported API only.

## Mutation-aware patterns (kill Stryker mutants)

1. Assert the **value**, not existence: `expect(r.status).toBe('sent')`, not `toBeDefined()`.
2. Cover **both sides** of every `||` / `&&`.
3. Assert the error **path AND code** independently for validation failures (assert the `NOTIFICATION_ERROR_CODES` key, not just a 4xx).
4. Cover the **acceptance** path of every predicate, not only rejection.

## NestJS (apps/api)

- `Test.createTestingModule(...)`; override only external I/O — the email transport (Mailpit/Resend/SMTP), Redis, and Prisma when needed. Keep DI wiring real.
- E2E (`*.e2e-spec.ts`): real `NestFactory.create` + `supertest`. Assert the exception-filter mapping (`NotificationException` → HTTP status + error code), the masked recipient in audit rows, and that **no OTP code** appears in any response or log.

## OTP / email / multi-tenant assertions

- Assert OTP codes are **never** present in responses, logs, or audit rows; assert `maskRecipient` output, not the raw address.
- Test the atomic OTP transitions (generate → verify → consume; resend cooldown / `Retry-After`) — both the valid and the invalid/expired paths.
- Test tenant isolation: a request for tenant A never reads tenant B's OTP entries or audit rows.

## Frontend (apps/web, Vitest)

- Render leaf components; assert loading / empty / error states. Mock the API client; assert the localized copy for each error code. Restore all mocks in `afterEach` — never leak module-level mocks across files.
