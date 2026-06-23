/**
 * @fileoverview FacetRail — the Explorer's faceted left rail with live counts.
 *
 * Shows `channel` / `verb` / `provider` / `purpose` / **`source`** value-counts
 * derived from the loaded page (`useFacets`). Clicking a value adds a positive
 * filter via the URL; ⌥/Alt-click clears that field. The source facet
 * (`service` vs `__interceptor__`) is what separates "what the service did" from
 * "what the HTTP boundary saw" (`OVERVIEW.md §15`).
 *
 * @module components/explorer/facet-rail
 */

'use client'

import { useFacets } from '@/hooks/use-facets'
import { FACET_FIELDS, FACET_LABELS } from '@/lib/audit-facets'
import { useAuditQuery } from '@/lib/filters'
import type { AuditQuery, FacetField } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

/** The currently-active positive value for a field (for highlighting). */
function activeValue(query: AuditQuery, field: FacetField): string {
  return query[field] ?? ''
}

/**
 * Faceted left rail with derived value-counts and click-to-filter.
 *
 * @returns The facet rail.
 */
export function FacetRail() {
  const { query, setQuery } = useAuditQuery()
  const { facets, isLoading, isError } = useFacets(query)

  /** Apply (or, when `clear` is true, remove) a positive filter for a field. */
  const apply = (field: FacetField, value: string, clear: boolean): void => {
    const next = clear ? '' : value
    switch (field) {
      case 'channel':
        void setQuery({ channel: next })
        return
      case 'verb':
        void setQuery({ verb: next })
        return
      case 'provider':
        void setQuery({ provider: next })
        return
      case 'purpose':
        void setQuery({ purpose: next })
        return
      case 'source':
        void setQuery({ source: next })
        return
    }
  }

  return (
    <aside className="w-full">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-white/40">Facets</h2>
      {isError && <p className="mb-2 text-[11px] text-destructive">Failed to load facet counts.</p>}
      <ScrollArea className="h-[calc(100vh-12rem)] pr-2">
        <div className="space-y-5">
          {FACET_FIELDS.map((field) => {
            const values = facets[field]
            const active = activeValue(query, field)
            return (
              <div key={field}>
                <h3 className="mb-1.5 font-mono text-[11px] font-semibold text-white/55">
                  {FACET_LABELS[field]}
                </h3>
                {isLoading ? (
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-2/3" />
                  </div>
                ) : values.length === 0 ? (
                  <p className="text-[11px] text-white/30">No values</p>
                ) : (
                  <ul className="space-y-0.5">
                    {values.map((facet) => {
                      const isActive = active === facet.value
                      return (
                        <li key={facet.value}>
                          <button
                            type="button"
                            title={
                              isActive
                                ? 'Alt-click to clear this filter'
                                : `Filter ${FACET_LABELS[field]} = ${facet.value}`
                            }
                            onClick={(e) => apply(field, facet.value, e.altKey && isActive)}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors',
                              isActive
                                ? 'bg-brand-500/15 text-brand-500'
                                : 'text-white/65 hover:bg-white/5 hover:text-white/90',
                            )}
                          >
                            <span className="truncate font-mono">{facet.value}</span>
                            <span className="shrink-0 tabular-nums text-white/40">
                              {facet.count}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </aside>
  )
}
