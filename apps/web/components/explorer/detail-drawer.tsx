/**
 * @fileoverview DetailDrawer — three-tab row inspector (Overview / Raw / Proof).
 *
 * Opens on row click. **Overview** lists each scalar field with a "filter for"
 * pivot (sets the `nuqs` query); `verb`/`channel` carry their severity colour +
 * icon + label, and a recognised `errorMessage` shows its localized `./shared`
 * label. **Raw entry** renders the full, already-masked `NotificationLog` JSON —
 * there is no unmask and no `code` field to reveal. **Proof** renders the
 * never-contains-code green check: the serialized row carries no OTP code (the
 * code lives only in the TTL-bound store, never in the audit log — `OVERVIEW.md
 * §13`/§15), with the recipient shown masked.
 *
 * @module components/explorer/detail-drawer
 */

'use client'

import { CheckCircle2, Filter, type LucideIcon } from 'lucide-react'

import { VERB_SERIES } from '@/lib/chart-series'
import { sourceOf } from '@/lib/audit-facets'
import { ERROR_CODE_MESSAGES } from '@/lib/error-codes'
import { useAuditQuery } from '@/lib/filters'
import { CHANNEL_SEVERITY } from '@/lib/severity'
import type { AuditQuery, NotificationLog } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/** Error-code → localized message, widened to a string lookup (no per-key cast). */
const ERROR_MESSAGES_BY_CODE: Record<string, string> = ERROR_CODE_MESSAGES

/** Localize an `errorMessage` when it is a recognised `notification.*` code, else `null`. */
function localizedError(message: string | null): string | null {
  if (message === null || message === '') return null
  return ERROR_MESSAGES_BY_CODE[message] ?? null
}

/** Proof that the serialized row carries no OTP code (structurally code-free). */
function rowHasNoCode(row: NotificationLog): boolean {
  return !('code' in row) && !/"code"\s*:/.test(JSON.stringify(row))
}

interface PivotRowProps {
  /** Field label. */
  label: string
  /** The display node (text or a severity span). */
  children: React.ReactNode
  /** When set, renders a "filter for" button applying this partial query. */
  pivot?: Partial<AuditQuery>
  /** Apply a pivot and close the drawer. */
  onPivot: (partial: Partial<AuditQuery>) => void
}

/** One Overview field row with an optional "filter for" pivot. */
function PivotRow({ label, children, pivot, onPivot }: PivotRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wide text-white/40">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-xs text-white/80">{children}</span>
        {pivot !== undefined && (
          <button
            type="button"
            title={`Filter for ${label}`}
            onClick={() => onPivot(pivot)}
            className="shrink-0 text-white/30 hover:text-brand-500"
          >
            <Filter className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </span>
    </div>
  )
}

/** A verb/channel severity span (colour + icon + label). */
function SeverityValue({
  color,
  icon: Icon,
  label,
}: {
  color: string
  icon: LucideIcon
  label: string
}) {
  return (
    <span className="flex items-center gap-1.5 font-mono" style={{ color }}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  )
}

interface TabProps {
  /** The selected audit row. */
  row: NotificationLog
  /** Apply a partial-query pivot (and close the drawer). */
  onPivot: (partial: Partial<AuditQuery>) => void
}

/** The Overview tab: each scalar field with a "filter for" pivot. */
function OverviewTab({ row, onPivot }: TabProps) {
  const verb = VERB_SERIES[row.verb]
  const channel = CHANNEL_SEVERITY[row.channel]
  const errorLabel = localizedError(row.errorMessage)
  return (
    <TabsContent value="overview" className="mt-3">
      <PivotRow label="Channel" pivot={{ channel: row.channel }} onPivot={onPivot}>
        <SeverityValue color={channel.color} icon={channel.icon} label={channel.label} />
      </PivotRow>
      <PivotRow label="Verb" pivot={{ verb: row.verb }} onPivot={onPivot}>
        <SeverityValue color={verb.color} icon={verb.icon} label={verb.label} />
      </PivotRow>
      <PivotRow label="Recipient" pivot={{ recipient: row.recipient }} onPivot={onPivot}>
        {row.recipient}
      </PivotRow>
      {row.purpose !== null && (
        <PivotRow label="Purpose" pivot={{ purpose: row.purpose }} onPivot={onPivot}>
          {row.purpose}
        </PivotRow>
      )}
      <PivotRow label="Provider" pivot={{ provider: row.providerName }} onPivot={onPivot}>
        {row.providerName}
      </PivotRow>
      <PivotRow label="Source" pivot={{ source: sourceOf(row.providerName) }} onPivot={onPivot}>
        {sourceOf(row.providerName)}
      </PivotRow>
      {errorLabel !== null && (
        <PivotRow label="Error" onPivot={onPivot}>
          <span className="text-destructive">{errorLabel}</span>
        </PivotRow>
      )}
    </TabsContent>
  )
}

/** The Proof tab: the never-contains-code green check (or the unexpected warning). */
function ProofTab({ row }: { row: NotificationLog }) {
  return (
    <TabsContent value="proof" className="mt-3">
      {rowHasNoCode(row) ? (
        <div className="flex items-start gap-3 rounded-lg border border-(--color-success)/30 bg-(--color-success)/5 p-4">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-(--color-success)"
            aria-hidden="true"
          />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-(--color-success)">No OTP code present</p>
            <p className="text-white/55">
              The serialized audit row carries no <code className="font-mono">code</code> field — a
              generated code lives only in the TTL-bound store, never in the audit log.
            </p>
            <p className="text-white/40">
              Recipient is shown masked: <span className="font-mono">{row.recipient}</span>
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-destructive/40 p-4 text-xs text-destructive">
          Unexpected: the serialized row appears to contain a code field. This must never happen —
          the write seam strips it.
        </p>
      )}
    </TabsContent>
  )
}

interface DetailDrawerProps {
  /** The selected row, or `null` when nothing is selected. */
  row: NotificationLog | null
  /** Whether the drawer is open. */
  open: boolean
  /** Called when the drawer requests an open-state change. */
  onOpenChange: (open: boolean) => void
}

/**
 * The row detail drawer (Overview / Raw entry / Proof).
 *
 * @param props - {@link DetailDrawerProps}.
 * @returns The drawer dialog, or `null` when no row is selected.
 */
export function DetailDrawer({ row, open, onOpenChange }: DetailDrawerProps) {
  const { setQuery } = useAuditQuery()
  if (row === null) return null

  const pivot = (partial: Partial<AuditQuery>): void => {
    void setQuery(partial)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Audit row · {row.id}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="raw">Raw entry</TabsTrigger>
            <TabsTrigger value="proof">Proof</TabsTrigger>
          </TabsList>

          <OverviewTab row={row} onPivot={pivot} />

          <TabsContent value="raw" className="mt-3">
            <pre className="max-h-80 overflow-auto rounded-lg border border-(--glass-border) bg-black/40 p-3 font-mono text-[11px] text-white/70">
              {JSON.stringify(row, null, 2)}
            </pre>
            <p className="mt-2 text-[11px] text-white/35">
              The row is already masked at the write seam — there is no unmask and no code field to
              reveal.
            </p>
          </TabsContent>

          <ProofTab row={row} />
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
