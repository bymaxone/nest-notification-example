/**
 * @fileoverview Playwright configuration for the notification console end-to-end journeys.
 *
 * The shell smoke test exercises only the Next.js app (no backend required),
 * so the `webServer` entry starts `next dev` against port 3003. `reuseExistingServer`
 * reattaches to a running dev server in local development; CI always starts fresh.
 *
 * @module playwright.config
 */
import { defineConfig, devices } from '@playwright/test'

/** Notification console URL. */
const WEB_URL = 'http://localhost:3003'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  // Start the Next.js dev server before running tests. The shell renders
  // without a live backend, so no API stack is required for these journeys.
  webServer: {
    command: 'pnpm dev',
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
