/**
 * Prisma CLI configuration for `apps/api`.
 *
 * Provides the schema path and the datasource connection URL to every Prisma
 * CLI command (`generate`, `migrate`, etc.). Prisma 7 no longer accepts the
 * `url` property inside the `datasource` block of `schema.prisma`, so the
 * connection string is supplied here instead. At runtime the `PrismaClient`
 * receives the connection through the `@prisma/adapter-pg` driver adapter —
 * see `src/prisma/prisma.service.ts`.
 */
import { defineConfig } from 'prisma/config'

/**
 * Non-secret stub connection string used only when `DATABASE_URL` is unset — e.g.
 * a fresh `pnpm install` runs `prisma generate` before a contributor has created a
 * `.env`. `prisma generate` never opens a connection, so any well-formed URL lets
 * the client generate. This fallback is scoped to the Prisma CLI ONLY; the
 * application's runtime Zod env validation still requires a real `DATABASE_URL` to
 * boot — see `src/config/env.schema.ts`.
 */
const STUB_DATABASE_URL = 'postgresql://localhost:5432/stub'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env['DATABASE_URL'] ?? STUB_DATABASE_URL,
  },
})
