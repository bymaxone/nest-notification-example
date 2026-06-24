/**
 * @fileoverview ConfigStatus — channel/provider config + RBAC roles + mask demo.
 *
 * Reads the resolved-config snapshot (`getSettingsStatus`) and renders the enabled
 * channels, the wired provider/storage/renderer, the default locale, the RBAC role
 * list (highlighting the active role from the global switcher), and a masked-vs-raw
 * recipient comparison reflecting the active `maskRecipient` mode. Read-only.
 *
 * @module components/settings/config-status
 */

'use client'

import { useQuery } from '@tanstack/react-query'

import { getSettingsStatus } from '@/lib/api/settings'
import { ROLES, useNotificationQuery, type RbacRole } from '@/lib/filters'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

/** Human labels for the RBAC roles. */
const ROLE_LABELS: Record<RbacRole, string> = {
  viewer: 'Viewer',
  operator: 'Operator',
  admin: 'Admin',
}

/** A labelled config row. */
function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-(--glass-border) py-1.5 text-sm">
      <span className="text-white/55">{label}</span>
      <span className="font-mono text-white/80">{value}</span>
    </div>
  )
}

/** The RBAC role list, highlighting the active role. */
function RoleList({ active }: { active: RbacRole }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((role) => (
        <Badge key={role} variant={role === active ? 'default' : 'outline'}>
          {ROLE_LABELS[role]}
        </Badge>
      ))}
    </div>
  )
}

/**
 * The channel/provider config status + RBAC roles + recipient-mask comparison.
 *
 * @returns The config-status panel, or a loading/error placeholder.
 */
export function ConfigStatus() {
  const { tenantId, role } = useNotificationQuery()
  const query = useQuery({
    queryKey: ['settings-status', tenantId],
    queryFn: () => getSettingsStatus(tenantId),
  })

  if (query.isError) {
    return <p className="text-sm text-amber-400">Could not load the config status.</p>
  }
  if (!query.isSuccess) {
    return <Skeleton className="h-48 w-full" />
  }

  const status = query.data
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-white/55">Channels</h3>
        <div className="flex flex-wrap gap-2">
          {status.channels.map((channel) => (
            <Badge key={channel} variant="default">
              {channel}
            </Badge>
          ))}
        </div>
      </div>
      <div>
        <ConfigRow label="Email provider" value={status.provider} />
        <ConfigRow label="OTP storage" value={status.storage} />
        <ConfigRow label="Template renderer" value={status.renderer} />
        <ConfigRow label="Default locale" value={status.defaultLocale} />
      </div>
      <div>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-white/55">RBAC roles</h3>
        <RoleList active={role} />
      </div>
      <div>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-white/55">
          Recipient masking — {status.maskRecipientMode}
        </h3>
        <ConfigRow label="Raw" value="jane@acme.com" />
        <ConfigRow
          label="Stored (masked)"
          value={status.maskRecipientMode === 'masked' ? 'j***@acme.com' : 'jane@acme.com'}
        />
      </div>
    </div>
  )
}
