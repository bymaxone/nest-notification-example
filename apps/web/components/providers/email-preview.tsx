/**
 * @fileoverview EmailPreview — a four-tab template preview proving the html escape.
 *
 * Renders a demo template (with an editable, markup-bearing variable) across four
 * tabs — Rendered (a sandboxed iframe), HTML (the escaped source), Text (the raw
 * plain-text body), and Metadata. Because the html body is escaped while the
 * subject and text stay raw, injecting `<script>…</script>` shows the escape in
 * action (journey 6). The rendered tab uses a fully sandboxed iframe, so it
 * proves the escape without ever becoming an injection sink.
 *
 * @module components/providers/email-preview
 */

'use client'

import { useMemo, useState } from 'react'

import {
  DEFAULT_EMAIL_PREVIEW_TEMPLATE,
  EMAIL_PREVIEW_TEMPLATES,
  EMAIL_RENDERERS,
  getEmailPreviewTemplate,
  renderEmailPreview,
} from '@/lib/api/providers'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/** The default markup-bearing value that demonstrates the html escape. */
const DEFAULT_VARIABLE = `<script>alert('xss')</script>`

/** A single labelled metadata row. */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-(--glass-border) py-1.5 text-sm">
      <span className="text-white/55">{label}</span>
      <span className="font-mono text-white/80">{value}</span>
    </div>
  )
}

/**
 * The four-tab email template preview.
 *
 * @returns The preview controls + Rendered/HTML/Text/Metadata tabs.
 */
export function EmailPreview() {
  const [template, setTemplate] = useState(DEFAULT_EMAIL_PREVIEW_TEMPLATE)
  const [renderer, setRenderer] = useState<string>('Default')
  const [variable, setVariable] = useState(DEFAULT_VARIABLE)

  const rendered = useMemo(
    () =>
      renderEmailPreview({
        template,
        data: { name: variable, appName: 'Bymax', location: 'Berlin, DE' },
        locale: 'en',
        renderer,
      }),
    [template, variable, renderer],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preview-template">Template</Label>
          <Select
            value={template.id}
            onValueChange={(id) => setTemplate(getEmailPreviewTemplate(id))}
          >
            <SelectTrigger id="preview-template" className="w-48" aria-label="Template">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_PREVIEW_TEMPLATES.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preview-renderer">Renderer</Label>
          <Select value={renderer} onValueChange={setRenderer}>
            <SelectTrigger id="preview-renderer" className="w-44" aria-label="Renderer">
              <SelectValue placeholder="Renderer" />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_RENDERERS.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="preview-variable">Variable (try HTML)</Label>
          <Input
            id="preview-variable"
            value={variable}
            onChange={(event) => setVariable(event.target.value)}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <Tabs defaultValue="rendered">
        <TabsList>
          <TabsTrigger value="rendered">Rendered</TabsTrigger>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>
        <TabsContent value="rendered">
          <iframe
            title="Rendered email preview"
            sandbox=""
            srcDoc={rendered.html}
            className="h-48 w-full rounded-lg border border-(--glass-border) bg-white"
          />
        </TabsContent>
        <TabsContent value="html">
          <pre
            data-testid="preview-html"
            className="overflow-auto rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 text-xs text-white/80"
          >
            {rendered.html}
          </pre>
        </TabsContent>
        <TabsContent value="text">
          <pre
            data-testid="preview-text"
            className="overflow-auto rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 text-xs text-white/80"
          >
            {rendered.text}
          </pre>
        </TabsContent>
        <TabsContent value="metadata">
          <div className="rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3">
            <MetaRow label="Subject" value={rendered.metadata.subject} />
            <MetaRow label="Locale" value={rendered.metadata.locale} />
            <MetaRow label="Template" value={rendered.metadata.templateId} />
            <MetaRow label="Renderer" value={rendered.metadata.renderer} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
