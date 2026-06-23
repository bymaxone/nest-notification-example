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
import { defineConfig, env } from 'prisma/config'

/** Minimal environment shape consumed by the Prisma CLI configuration. */
type PrismaCliEnv = { DATABASE_URL: string }

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env<PrismaCliEnv>('DATABASE_URL'),
  },
})
