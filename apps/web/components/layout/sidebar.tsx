/**
 * @fileoverview 250px glass nav rail — orange active item, notification destinations.
 *
 * Desktop: sticky below the topbar. Mobile: fixed overlay toggled by
 * the topbar hamburger. Active detection uses `usePathname()` with exact
 * matching for the root route. The active nuqs query string is carried across
 * navigation so tenant/role/live context survives page changes.
 *
 * @module components/layout/sidebar
 */

'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutDashboard, Zap, Search, KeyRound, Boxes, Map, Cog } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEM_BASE_CLASS =
  'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-all duration-150'
const NAV_ITEM_ACTIVE_CLASS = 'border-l-brand-500 bg-brand-500/10 font-semibold text-brand-500'
const NAV_ITEM_INACTIVE_CLASS =
  'border-l-transparent font-normal text-white/55 hover:bg-white/5 hover:text-white/80'
const ICON_BASE_CLASS = 'h-4 w-4 shrink-0'
const ICON_ACTIVE_CLASS = 'text-brand-500'
const ICON_INACTIVE_CLASS = 'text-white/40'
const NAV_BASE_CLASSES = [
  'flex w-[250px] shrink-0 flex-col border-r border-white/8 bg-(--color-sidebar-bg)',
  'z-100 fixed left-0 top-16 h-[calc(100vh-4rem)] overflow-y-auto',
  'lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]',
] as const

interface NavItem {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  exact?: boolean
}

/** The seven notification console destinations. */
const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/', icon: LayoutDashboard, exact: true },
  { label: 'Trigger Center', href: '/trigger', icon: Zap },
  { label: 'Audit Explorer', href: '/explorer', icon: Search },
  { label: 'OTP Verify', href: '/otp', icon: KeyRound },
  { label: 'Providers & Templates', href: '/providers', icon: Boxes },
  { label: 'Roadmap', href: '/roadmap', icon: Map },
  { label: 'Settings', href: '/settings', icon: Cog },
]

interface SidebarProps {
  /** Controls mobile overlay visibility. */
  isOpen: boolean
  /** Closes the mobile overlay on navigation. */
  onNavClick?: () => void
}

/** 250px glass nav rail — orange active item, notification destinations. */
export function Sidebar({ isOpen, onNavClick }: SidebarProps) {
  const pathname = usePathname()
  // Carry the active filter state (the nuqs URL query: tenant, role, live…)
  // across navigation so a destination opens with the same lens.
  const queryString = useSearchParams().toString()
  return (
    <nav
      aria-label="Main navigation"
      className={cn(...NAV_BASE_CLASSES, isOpen ? 'flex' : 'hidden lg:flex')}
    >
      <div className="flex h-full flex-col gap-0 px-4 py-6">
        <div className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={queryString ? `${item.href}?${queryString}` : item.href}
                {...(onNavClick ? { onClick: onNavClick } : {})}
                className={cn(
                  NAV_ITEM_BASE_CLASS,
                  isActive ? NAV_ITEM_ACTIVE_CLASS : NAV_ITEM_INACTIVE_CLASS,
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={cn(
                    ICON_BASE_CLASS,
                    isActive ? ICON_ACTIVE_CLASS : ICON_INACTIVE_CLASS,
                  )}
                />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
