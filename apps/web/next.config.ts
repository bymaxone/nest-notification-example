/**
 * @fileoverview Next.js configuration for apps/web.
 *
 * The library is transpiled so the browser bundle gets a single React instance
 * (prevents the "invalid hook call" from hooks in the library's React subpath).
 * Security headers are applied globally. The CSP `connect-src` allows the
 * upstream API origin for direct fetch calls (audit logs/aggregate/channels) and
 * `'self'` covers the same-origin SSE proxy at `/api/audit/stream`.
 *
 * @module next.config
 */

import path from 'node:path'
import process from 'node:process'

const isProduction = process.env['NODE_ENV'] === 'production'

/** The console fetches the audit API directly from the browser, so its origin
 * must be in `connect-src`. The SSE live tail is proxied same-origin
 * (`/api/audit/stream`) and is covered by `'self'`. */
const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const apiOrigin = (() => {
  try {
    return new URL(apiBase).origin
  } catch {
    return ''
  }
})()
const connectSrc = ["'self'", apiOrigin].filter(Boolean).join(' ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the pre-publish library so the bundler resolves the `./react` and
  // `./shared` subpaths from the workspace `file:` symlink — and ensures a single
  // React instance (no duplicate-React / "invalid hook call" at runtime).
  transpilePackages: ['@bymax-one/nest-notification'],
  // Drop the `X-Powered-By: Next.js` response header.
  poweredByHeader: false,
  logging: {
    // Suppress browser-console relay to the dev-server terminal — avoids
    // noisy "[browser]" lines (e.g. CSP eval warnings) during `next dev`.
    browserToTerminal: false,
  },
  // Emit a self-contained server bundle for production container images.
  // `outputFileTracingRoot` at the monorepo root ensures pnpm workspace deps
  // are traced correctly into the standalone output.
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              `connect-src ${connectSrc}`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
          ...(isProduction
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ]
  },
}

export default nextConfig
