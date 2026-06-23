/**
 * @fileoverview SSE proxy for the audit live tail — injects RBAC headers.
 *
 * A browser `EventSource` cannot attach custom headers, so the console cannot
 * send `x-role` / `x-tenant-id` directly to the API's `GET /audit/stream`. This
 * same-origin route reads `role` / `tenantId` from the query string, injects
 * them as RBAC headers (plus `Last-Event-ID` for resume), and pipes the upstream
 * `text/event-stream` straight through with anti-buffering headers.
 *
 * @module app/api/audit/stream/route
 */

import type { NextRequest } from 'next/server'

/** Always run dynamically — this is a long-lived streaming connection. */
export const dynamic = 'force-dynamic'

/** Node runtime so the upstream `fetch` body can be streamed unbuffered. */
export const runtime = 'nodejs'

/** Upstream API base (the `apps/api` notification service). */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/** Recognized RBAC roles; an unknown value falls back to least privilege. */
const VALID_ROLES = new Set(['viewer', 'operator', 'admin'])

/**
 * Maximum allowed length for a tenant identifier passed via the query string.
 * Constraining the length prevents oversized header injection.
 */
const MAX_TENANT_ID_LENGTH = 128

/**
 * Strip ASCII control characters and truncate a caller-supplied tenant ID to
 * the maximum allowed length before forwarding it as an HTTP header.
 *
 * Control characters (code points ≤ 0x1F and 0x7F) can break HTTP header
 * framing; filtering them with a character-code comparison avoids regex that
 * triggers ESLint's `no-control-regex` rule.
 *
 * @param raw - The raw query-string value for `tenantId`.
 * @returns A sanitised string safe for use as an HTTP header value.
 */
function sanitiseTenantId(raw: string): string {
  return [...raw]
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 0x1f && code !== 0x7f
    })
    .join('')
    .slice(0, MAX_TENANT_ID_LENGTH)
}

/**
 * Proxy the API's SSE audit stream, injecting RBAC headers from query params.
 *
 * @param req - The incoming streaming request.
 * @returns A `text/event-stream` response piping the upstream stream.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const incoming = new URL(req.url)

  // Translate `role` / `tenantId` query params into RBAC headers; the API
  // resolves both from headers, so strip them from the upstream query. An
  // absent or unrecognized role falls back to least-privileged `viewer`.
  const rawRole = incoming.searchParams.get('role') ?? 'viewer'
  const role = VALID_ROLES.has(rawRole) ? rawRole : 'viewer'
  const tenantId = sanitiseTenantId(incoming.searchParams.get('tenantId') ?? '')
  const upstreamParams = new URLSearchParams(incoming.searchParams)
  upstreamParams.delete('role')
  upstreamParams.delete('tenantId')

  const headers: Record<string, string> = { Accept: 'text/event-stream', 'x-role': role }
  if (tenantId !== '') headers['x-tenant-id'] = tenantId
  const lastEventId = req.headers.get('last-event-id')
  if (lastEventId !== null) headers['last-event-id'] = lastEventId

  const upstream = await fetch(`${API_BASE}/audit/stream?${upstreamParams.toString()}`, {
    headers,
    signal: req.signal,
  })

  if (upstream.body === null) {
    return new Response('upstream stream unavailable', { status: 502 })
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
