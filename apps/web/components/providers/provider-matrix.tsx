/**
 * @fileoverview ProviderMatrix — the four-boundary provider/storage/renderer matrix.
 *
 * Renders the §12 boundaries (email transport · OTP storage · template rendering ·
 * audit sink) with each contract, its bundled reference, the adapter THIS example
 * wires, and a live health badge derived from `GET /channels` AND
 * `GET /config/status`. Read-only — it never mutates the wiring.
 *
 * @module components/providers/provider-matrix
 */

'use client'

import { useQuery } from '@tanstack/react-query'

import { getChannels, getConfigStatus, type NotificationConfigStatus } from '@/lib/api/providers'
import { useNotificationQuery } from '@/lib/filters'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** One external boundary row of the showcase. */
interface BoundaryRow {
  /** The boundary name. */
  boundary: string
  /** The contract interface. */
  contract: string
  /** The library's bundled reference adapters. */
  bundled: string
  /** Resolve the adapter this example wires from the config snapshot. */
  wired: (config: NotificationConfigStatus) => string
  /** The channel gating the active badge, or `null` when always active. */
  channel: string | null
}

/** The four §12 boundaries, in pipeline order. */
const BOUNDARIES: readonly BoundaryRow[] = [
  {
    boundary: 'Email transport',
    contract: 'IEmailProvider',
    bundled: 'ResendEmailProvider · NoOpEmailProvider',
    wired: (config) => config.provider,
    channel: 'email',
  },
  {
    boundary: 'OTP storage',
    contract: 'IOtpStorage',
    bundled: 'RedisOtpStorage · InMemoryOtpStorage',
    wired: (config) => config.storage,
    channel: 'otp',
  },
  {
    boundary: 'Template rendering',
    contract: 'IEmailTemplateRenderer',
    bundled: 'DefaultTemplateRenderer',
    wired: (config) => config.renderer,
    channel: null,
  },
  {
    boundary: 'Audit sink',
    contract: 'INotificationLogRepository',
    bundled: 'NoOpNotificationLogRepository',
    wired: () => 'Prisma / Postgres',
    channel: null,
  },
]

/** The combined channels + config snapshot the matrix renders. */
interface MatrixData {
  channels: string[]
  config: NotificationConfigStatus
}

/**
 * The provider/storage/renderer matrix with live health badges.
 *
 * @returns The boundary table, or a loading/error placeholder.
 */
export function ProviderMatrix() {
  const { tenantId } = useNotificationQuery()
  const query = useQuery<MatrixData>({
    queryKey: ['provider-matrix', tenantId],
    // The two reads are independent, so fetch them concurrently; a rejection in
    // either still propagates to the query's error state.
    queryFn: async () => {
      const [channels, config] = await Promise.all([
        getChannels(tenantId),
        getConfigStatus(tenantId),
      ])
      return { channels, config }
    },
  })

  if (query.isError) {
    return <p className="text-sm text-amber-400">Could not load the provider matrix.</p>
  }
  if (!query.isSuccess) {
    return <Skeleton className="h-40 w-full" />
  }

  const { channels, config } = query.data
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Boundary</TableHead>
          <TableHead>Contract</TableHead>
          <TableHead>Bundled reference</TableHead>
          <TableHead>This example wires</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {BOUNDARIES.map((row) => {
          const active = row.channel === null || channels.includes(row.channel)
          return (
            <TableRow key={row.boundary}>
              <TableCell className="font-medium text-foreground">{row.boundary}</TableCell>
              <TableCell className="font-mono text-xs text-white/70">{row.contract}</TableCell>
              <TableCell className="text-xs text-white/55">{row.bundled}</TableCell>
              <TableCell className="text-xs text-white/70">{row.wired(config)}</TableCell>
              <TableCell>
                <Badge variant={active ? 'default' : 'outline'}>
                  {active ? 'Active' : 'Disabled'}
                </Badge>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
