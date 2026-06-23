/**
 * @fileoverview 404 not-found boundary for the notification console.
 *
 * Rendered when a route segment calls `notFound()` or no matching route exists.
 *
 * @module app/not-found
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Console 404 page.
 *
 * @returns A not-found panel rendered under the design system.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 p-12">
      <h2 className="font-mono text-lg font-bold text-muted-foreground">Page not found</h2>
      <p className="text-sm text-muted-foreground">
        The page you are looking for does not exist in the notification console.
      </p>
      <Button asChild>
        <Link href="/">Return to Overview</Link>
      </Button>
    </div>
  )
}
