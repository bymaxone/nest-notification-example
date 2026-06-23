/**
 * @fileoverview QueryBar — recipient/purpose free-text search + clear-all.
 *
 * Two free-text inputs (masked recipient, OTP purpose) plus a clear-all, all
 * written to the URL via `nuqs` so a brushed range / a Trigger auto-pivot / a
 * facet click all coexist with the search. Filter state lives only in the URL —
 * the single source of truth (`OVERVIEW.md §15`).
 *
 * @module components/explorer/query-bar
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'

import { useAuditQuery } from '@/lib/filters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** All Explorer filter fields a clear-all resets to their empty value. */
const CLEARED = {
  recipient: '',
  purpose: '',
  channel: '',
  verb: '',
  provider: '',
  source: '',
  q: '',
} as const

/**
 * The Explorer's recipient/purpose free-text search bar.
 *
 * @returns The query bar.
 */
export function QueryBar() {
  const { query, setQuery } = useAuditQuery()
  const [recipient, setRecipient] = useState(query.recipient ?? '')
  const [purpose, setPurpose] = useState(query.purpose ?? '')
  const focused = useRef(false)

  // Keep the inputs in sync when the URL changes elsewhere (facet clicks,
  // clear-all) — but never overwrite what the user is actively typing.
  const urlRecipient = query.recipient ?? ''
  const urlPurpose = query.purpose ?? ''
  useEffect(() => {
    if (!focused.current) {
      setRecipient(urlRecipient)
      setPurpose(urlPurpose)
    }
  }, [urlRecipient, urlPurpose])

  const submit = (): void => {
    void setQuery({ recipient, purpose })
  }

  const clearAll = (): void => {
    setRecipient('')
    setPurpose('')
    void setQuery({ ...CLEARED })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          onFocus={() => {
            focused.current = true
          }}
          onBlur={() => {
            focused.current = false
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="recipient (e.g. j***@acme.com)"
          className="pl-9 font-mono text-xs"
          aria-label="Recipient search"
        />
      </div>
      <Input
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder="purpose (e.g. login)"
        className="min-w-40 flex-1 font-mono text-xs"
        aria-label="Purpose search"
      />
      <Button type="button" size="sm" onClick={submit}>
        Search
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={clearAll}>
        Clear all
      </Button>
    </div>
  )
}
