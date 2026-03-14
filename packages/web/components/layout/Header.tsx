'use client'

import { usePathname } from 'next/navigation'
import { Bell, Search } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/garments': 'Garments',
  '/dashboard/garments/new': 'Add Garment',
  '/dashboard/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.match(/\/dashboard\/garments\/[^/]+\/edit$/)) return 'Edit Garment'
  if (pathname.match(/\/dashboard\/garments\/[^/]+$/)) return 'Garment Detail'
  return 'Loocbooc'
}

export function Header() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-30">
      <h1 className="text-sm font-semibold text-text-primary tracking-tight">{title}</h1>

      <div className="flex items-center gap-2">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors duration-150"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors duration-150 relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
