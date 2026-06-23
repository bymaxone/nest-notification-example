/**
 * @fileoverview TenantRoleSwitcher — tenant + RBAC role selectors.
 *
 * Writes `tenantId` and `role` to the URL. These drive the notification console
 * RBAC demo: `tenantId` scopes every request (sent as `x-tenant-id`); `role`
 * gates which actions are shown and which API paths are allowed.
 *
 * @module components/controls/tenant-role-switcher
 */

'use client'

import { useQueryStates } from 'nuqs'
import { notificationQueryParsers, ROLES, TENANTS } from '@/lib/filters'
import type { RbacRole } from '@/lib/filters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Sentinel option value representing "all tenants" (clears the tenant filter). */
const ALL_TENANTS = '__all__'

/** Human labels for each RBAC role. */
const ROLE_LABEL: Record<RbacRole, string> = {
  viewer: 'Viewer',
  operator: 'Operator',
  admin: 'Admin',
}

/**
 * Tenant + role selectors feeding the notification console RBAC demo.
 *
 * @returns Two compact selects (tenant, role) bound to the URL state.
 */
export function TenantRoleSwitcher() {
  const [{ tenantId, role }, setQuery] = useQueryStates(notificationQueryParsers)

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={tenantId === '' ? ALL_TENANTS : tenantId}
        onValueChange={(value) => void setQuery({ tenantId: value === ALL_TENANTS ? '' : value })}
      >
        <SelectTrigger className="h-8 w-30 font-mono text-xs" aria-label="Tenant">
          <SelectValue placeholder="Tenant" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TENANTS}>All tenants</SelectItem>
          {TENANTS.map((tenant) => (
            <SelectItem key={tenant} value={tenant}>
              {tenant}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={role}
        // The Select lists exactly the `ROLES`, so Radix only ever emits a valid role.
        onValueChange={(value) => void setQuery({ role: value as RbacRole })}
      >
        <SelectTrigger className="h-8 w-26 font-mono text-xs" aria-label="Role">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((value) => (
            <SelectItem key={value} value={value}>
              {ROLE_LABEL[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
