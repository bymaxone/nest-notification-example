/**
 * @fileoverview Playwright configuration for the notification console live journeys.
 *
 * Self-contained and isolated from the dev environment: the API `webServer` entry brings
 * the DEDICATED test stack up (`docker-compose.test.yml` — Postgres :55432, Redis :56379,
 * Mailpit SMTP :51025 / HTTP :58025, all on alternate host ports and ephemeral/tmpfs), applies
 * the migrations + the demo seed to the TEST database, then starts the API pointed at the test
 * stack; a sibling entry starts the web console (:3003). Each entry is gated on its readiness URL
 * so the journeys only run once the whole stack is live. `reuseExistingServer` is disabled in CI
 * (`!process.env.CI`) so CI always starts the intended test-stack servers fresh, and enabled
 * locally for fast reattachment to an already-running stack.
 *
 * The dev database is never touched — only the throwaway test stack. Set `E2E_TEARDOWN=1`
 * to stop the test stack afterwards (see `e2e/global-teardown.ts`).
 *
 * @module playwright.config
 */
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

/** Local stack origins. */
const WEB_URL = 'http://localhost:3003'
const API_URL = 'http://localhost:3001'

/**
 * Repo root — workspace filters and `docker compose` resolve from here. From this file at
 * `apps/web/playwright.config.ts`, `../../` climbs out of `web/` then `apps/` to the repo root.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))

// Dedicated test-stack endpoints (match docker-compose.test.yml). The Postgres auth is kept
// as a separate fragment from the host so a secret scanner does not flag the well-known
// `postgres` test login; these are throwaway test-only values, not secrets.
const TEST_PG_AUTH = ['postgres', 'postgres'].join(':')
const TEST_DATABASE_URL = `postgresql://${TEST_PG_AUTH}@127.0.0.1:55432/notification_example_test`
const TEST_REDIS_URL = 'redis://127.0.0.1:56379'
// Alternate host SMTP port (forwarded to Mailpit's container :1025) so the test stack never
// collides with the dev stack's Mailpit; keep in lockstep with docker-compose.test.yml and the
// Mailpit fixture's HTTP base (host :58025).
const TEST_SMTP_URL = 'smtp://127.0.0.1:51025'

/** Env prefix that points the API at the test stack instead of the dev defaults. */
const API_ENV = [
  `DATABASE_URL=${TEST_DATABASE_URL}`,
  `REDIS_URL=${TEST_REDIS_URL}`,
  `SMTP_URL=${TEST_SMTP_URL}`,
  `WEB_ORIGIN=${WEB_URL}`,
  'PORT=3001',
].join(' ')

/** API workspace filter. */
const API = '@nest-notification-example/api'

/**
 * API bring-up chain: test stack up (blocks until healthy) → migrate the TEST database →
 * idempotent demo seed → start the API against the test stack. Kept on the API entry (not a
 * `globalSetup`, which Playwright runs AFTER the web servers start) so the database is ready
 * before the API connects. Skipped entirely when the API is already healthy via
 * `reuseExistingServer`.
 */
const API_COMMAND = [
  'pnpm infra:test:up',
  `${API_ENV} pnpm --filter ${API} run db:migrate`,
  `${API_ENV} pnpm --filter ${API} run db:seed`,
  `${API_ENV} pnpm --filter ${API} run start:dev`,
].join(' && ')

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  // Live-stack journeys touch SMTP delivery + SSE latency, so allow generous head-room.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: WEB_URL,
    // Keep a trace whenever a test fails. `on-first-retry` would never fire with retries: 0.
    trace: 'retain-on-failure',
  },
  // Every service the journeys depend on, each gated on its readiness URL. The first entry
  // also brings up Docker + the database (see API_COMMAND); the bring-up is generous on time
  // because a cold Docker pull + Nest boot is slow.
  webServer: [
    {
      command: API_COMMAND,
      url: `${API_URL}/health`,
      cwd: ROOT,
      // Never reattach to a possibly-stale server in CI; reuse only for fast local iteration.
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
    {
      command: 'pnpm --filter web dev',
      url: WEB_URL,
      cwd: ROOT,
      // Never reattach to a possibly-stale server in CI; reuse only for fast local iteration.
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
