#!/usr/bin/env node
/**
 * @fileoverview Error-code localization audit for `apps/web`.
 *
 * Asserts that every entry of `NOTIFICATION_ERROR_CODES` (imported LIVE from
 * `@bymax-one/nest-notification/shared`, never re-declared) is referenced
 * somewhere under `apps/web` — by its constant name (`OTP_EXPIRED`) or its wire
 * value (`notification.otp_expired`) — so the console can render a localized
 * message for each failure the API can return.
 *
 * Dependency-free beyond the audited library: `node:fs` / `node:path` plus a
 * dynamic import of the library's `/shared` subpath. When `apps/web` has no
 * source files yet, the audit is a no-op and exits 0.
 *
 * Exit codes: 0 = every code referenced (or no apps/web corpus yet);
 * 1 = unreferenced code(s); 2 = infrastructure error (the library is not linked,
 * or the export is absent, while a corpus exists).
 *
 * @module scripts/audit-error-codes
 */
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import process from 'node:process'

/** The console is the only surface that localizes error codes. */
const WEB_ROOT = 'apps/web'

/** Directories never walked (build output / deps). */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', 'reports', '.stryker-tmp'])

/** Source extensions considered part of the searchable corpus. */
const SRC_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs'])

/**
 * Recursively collect readable source files under a root.
 *
 * @param {string} root - Directory to walk.
 * @returns {string[]} Paths of source files.
 */
function collectSources(root) {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue
      const full = join(dir, entry)
      const stat = lstatSync(full)
      if (stat.isSymbolicLink()) continue // never follow symlinks (guards circular links)
      if (stat.isDirectory()) walk(full)
      else if (SRC_EXT.has(extname(entry)) && !/\.d\.[mc]?ts$/.test(full)) files.push(full)
    }
  }
  if (existsSync(root)) walk(root)
  return files
}

const sources = collectSources(WEB_ROOT)

// Foundation state: the console does not exist yet, so there is nothing to audit.
if (sources.length === 0) {
  console.log('• no apps/web source files yet — error-code audit is a no-op (exit 0)')
  process.exit(0)
}

let codes
try {
  const shared = await import('@bymax-one/nest-notification/shared')
  codes = shared.NOTIFICATION_ERROR_CODES
} catch (err) {
  console.error(`✗ could not import @bymax-one/nest-notification/shared: ${err.message}`)
  process.exit(2)
}

if (codes === null || typeof codes !== 'object') {
  console.error('✗ NOTIFICATION_ERROR_CODES is not exported by the linked library')
  process.exit(2)
}

const corpus = sources.map((f) => readFileSync(f, 'utf8'))

/**
 * Test whether a literal (a code name or its wire value) is referenced anywhere
 * in the console corpus.
 *
 * @param {string} literal - The string to look for.
 * @returns {boolean} True when at least one file contains it.
 */
const isReferenced = (literal) => corpus.some((text) => text.includes(literal))

let missing = 0
for (const [name, value] of Object.entries(codes).sort(([a], [b]) => a.localeCompare(b))) {
  if (isReferenced(name) || isReferenced(String(value))) console.log(`  ✓ localized  ${name}`)
  else {
    console.log(`  ✗ MISSING    ${name} (${String(value)})`)
    missing++
  }
}

console.log(
  `\n${missing === 0 ? '✓ all error codes localized in apps/web' : `✗ ${missing} unlocalized code(s)`}`,
)
process.exit(missing === 0 ? 0 : 1)
