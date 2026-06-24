/**
 * @fileoverview Providers & Templates page — the matrix + email preview.
 *
 * A thin Server Component shell that mounts the `'use client'` provider matrix
 * (live health badges from `/channels` + `/config/status`) and the four-tab email
 * preview proving the html-body-only escape. Marked `force-dynamic` so the
 * URL-driven active tenant is read per request.
 *
 * @module app/providers/page
 */

import { AppShell } from '@/components/layout/app-shell'
import { EmailPreview } from '@/components/providers/email-preview'
import { ProviderMatrix } from '@/components/providers/provider-matrix'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

/**
 * Providers & Templates page.
 *
 * @returns The provider matrix + email preview inside the app shell.
 */
export default function ProvidersPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Providers &amp; Templates</h1>
          <p className="text-sm text-white/55">
            Each external boundary is an interface with a wired adapter. The preview proves the
            renderer escapes the html body only.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Provider matrix</CardTitle>
            <CardDescription>
              Email transport · OTP storage · template rendering · audit sink.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProviderMatrix />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Email preview</CardTitle>
            <CardDescription>
              Inject markup into a variable — the html body is escaped, subject and text stay raw.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailPreview />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
