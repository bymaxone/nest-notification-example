/**
 * @fileoverview Vitest configuration for the notification console web app.
 *
 * jsdom environment for component tests, the `@` path alias mirrored from
 * `tsconfig.json`, and v8 coverage scoped to hand-written `lib/` and
 * `components/` source. Vendored shadcn UI primitives (`components/ui/*`) are
 * excluded from coverage — they are authored upstream. Tests live next to their
 * subject as `*.test.ts(x)`. Workers are capped at 50% of available CPUs to
 * prevent OOM when the `file:` workspace dependency is loaded per worker.
 *
 * @module vitest.config
 */
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror tsconfig `paths`: "@/*" → "./*".
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['{app,components,hooks,lib}/**/*.{test,spec}.{ts,tsx}'],
    // Cap parallel workers to prevent OOM from the workspace `file:` dependency
    // being loaded independently by each worker process.
    maxWorkers: '50%',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      include: [
        'lib/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'app/api/**/*.{ts,tsx}',
      ],
      // Vendored shadcn primitives are excluded (authored upstream, not here);
      // hand-written `lib/`, `hooks/`, `components/`, and the same-origin API route
      // handlers are gated at 100% on all metrics. Page shells (`app/**/page.tsx`)
      // stay out of scope — they are thin Server Components proven by the build.
      exclude: ['components/ui/**', 'app/**/page.tsx', '**/*.{test,spec}.{ts,tsx}'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
})
