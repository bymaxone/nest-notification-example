/**
 * Demo seed script for `apps/api`.
 *
 * Creates the two demo tenants (`acme`, `globex`) the example uses to show
 * multi-tenant isolation. Idempotent by construction — every tenant is written
 * with `upsert`, so the script is safe to re-run and always converges on the same
 * dataset. The `NotificationLog` audit rows are produced organically by the
 * running pipeline, so the masked, never-coded guarantee is exercised end-to-end
 * rather than seeded.
 *
 * Connection uses the `@prisma/adapter-pg` driver adapter (Prisma 7), matching the
 * runtime `PrismaService`. Any thrown error is redacted of its connection string
 * before logging, and `process.exitCode` (not `process.exit`) is set on failure so
 * the `.finally` disconnect can still run before the process terminates.
 *
 * @module
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const url = process.env['DATABASE_URL']
if (!url) {
  throw new Error('DATABASE_URL is required to run the seed script')
}

const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

/** The demo tenants seeded for the multi-tenant isolation walkthrough. */
const TENANTS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'acme', name: 'Acme, Inc.' },
  { id: 'globex', name: 'Globex Corporation' },
]

/**
 * Upsert every demo tenant so the seed converges idempotently on re-runs.
 *
 * @returns A promise that resolves once all tenants are written.
 */
async function main(): Promise<void> {
  for (const tenant of TENANTS) {
    await prisma.tenant.upsert({
      where: { id: tenant.id },
      update: { name: tenant.name },
      create: { id: tenant.id, name: tenant.name },
    })
  }
  console.log(`Seeded ${TENANTS.length} demo tenants: ${TENANTS.map((t) => t.id).join(', ')}.`)
}

main()
  .catch((err: unknown) => {
    // Redact any connection string from the error before printing so credentials
    // never reach the logs.
    const raw = err instanceof Error ? err.message : String(err)
    const sanitized = raw.replace(/postgr(?:es(?:ql)?):\/\/[^\s"']*/gi, '[redacted]')
    console.error('Seed failed:', sanitized)
    // Set exitCode rather than calling process.exit(1) so the .finally() cleanup
    // (prisma.$disconnect) completes before the process terminates.
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
