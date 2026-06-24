/**
 * @fileoverview FrozenOptions — read-only display of the boot-frozen OTP options.
 *
 * Renders `consumeOnVerify` and `swallowErrors` as read-only badges with an
 * explanatory note. These options are resolved ONCE at boot, so this surface
 * SHOWS the configured value and deliberately wires NO mutation control —
 * flipping them is demonstrated by booting a second module variant, not at
 * runtime. Shares the Settings query key so it adds no extra network call.
 *
 * @module components/settings/frozen-options
 */

'use client'

import { useQuery } from '@tanstack/react-query'

import { getSettingsStatus } from '@/lib/api/settings'
import { useNotificationQuery } from '@/lib/filters'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

/** A single read-only boot-frozen flag row. */
function FrozenRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-(--glass-border) py-2">
      <span className="text-sm text-white/80">{label}</span>
      <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? 'on' : 'off'}</Badge>
    </div>
  )
}

/**
 * The read-only boot-frozen options display (no mutation control).
 *
 * @returns The frozen-options panel, or a loading/error placeholder.
 */
export function FrozenOptions() {
  const { tenantId } = useNotificationQuery()
  const query = useQuery({
    queryKey: ['settings-status', tenantId],
    queryFn: () => getSettingsStatus(tenantId),
  })

  if (query.isError) {
    return <p className="text-sm text-amber-400">Could not load the frozen options.</p>
  }
  if (!query.isSuccess) {
    return <Skeleton className="h-24 w-full" />
  }

  const status = query.data
  return (
    <div className="flex flex-col gap-2">
      <FrozenRow label="consumeOnVerify" enabled={status.consumeOnVerify} />
      <FrozenRow label="swallowErrors" enabled={status.swallowErrors} />
      <p className="pt-1 text-xs text-white/55">
        Resolved once at boot. Flipping these is demonstrated by booting a second module variant,
        not by a live toggle.
      </p>
    </div>
  )
}
