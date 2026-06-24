/**
 * @fileoverview Settings page — config status + boot-frozen options.
 *
 * A thin Server Component shell that mounts the `'use client'` config-status panel
 * (channels/provider config + RBAC roles + recipient-mask demo) and the read-only
 * frozen-options display. Marked `force-dynamic` to match the other routes.
 *
 * @module app/settings/page
 */

import { AppShell } from '@/components/layout/app-shell'
import { ConfigStatus } from '@/components/settings/config-status'
import { FrozenOptions } from '@/components/settings/frozen-options'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

/**
 * Settings page.
 *
 * @returns The config status + frozen options inside the app shell.
 */
export default function SettingsPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-white/55">
            Channel/provider config status and the RBAC roles. The OTP policy options are
            boot-frozen — shown read-only here.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Config status</CardTitle>
            <CardDescription>Resolved adapters, RBAC roles, and recipient masking.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigStatus />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Boot-frozen options</CardTitle>
            <CardDescription>Resolved once at boot — read-only.</CardDescription>
          </CardHeader>
          <CardContent>
            <FrozenOptions />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
