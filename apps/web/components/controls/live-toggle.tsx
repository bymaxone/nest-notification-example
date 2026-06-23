/**
 * @fileoverview LiveToggle — switch enabling the SSE audit live tail.
 *
 * Writes the global `live` boolean to the URL; the Audit Explorer's stream
 * subscribes when it is on. Unlike a time-range-gated log tail, the audit
 * stream is always available when enabled.
 *
 * @module components/controls/live-toggle
 */

'use client'

import { RefreshCw } from 'lucide-react'
import { useNotificationQuery } from '@/lib/filters'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Icon toggle that turns the SSE audit live tail on/off.
 *
 * @returns The live-tail toggle button.
 */
export function LiveToggle() {
  const { setQuery, live } = useNotificationQuery()

  return (
    <Button
      type="button"
      variant={live ? 'default' : 'outline'}
      size="sm"
      aria-pressed={live}
      title="Toggle live audit tail"
      onClick={() => void setQuery({ live: !live })}
    >
      <RefreshCw className={cn('h-3.5 w-3.5', live && 'animate-spin')} />
      {live ? 'Live' : 'Live off'}
    </Button>
  )
}
