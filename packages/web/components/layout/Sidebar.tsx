'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Shirt,
  Settings,
  LogOut,
  Plus,
  Sparkles,
  Factory,
  Plug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { clearStoredAuth, getStoredAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/dashboard/garments', icon: Shirt, label: 'Garments' },
  { href: '/dashboard/manufacturers', icon: Factory, label: 'Manufacturers' },
  { href: '/dashboard/manufacturers/connections', icon: Plug, label: 'Connections' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const auth = getStoredAuth()

  const handleLogout = () => {
    clearStoredAuth()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-16 lg:w-56 bg-surface border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-accent-indigo flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="hidden lg:block font-bold text-text-primary tracking-tight text-lg">
            loocbooc
          </span>
        </Link>
      </div>

      {/* Add Garment CTA */}
      <div className="px-3 pt-4 pb-2 hidden lg:block">
        <Link
          href="/dashboard/garments/new"
          className="flex items-center gap-2 w-full h-9 px-3 rounded-md bg-white text-[#0A0A0A] text-sm font-medium hover:bg-white/90 transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
          Add garment
        </Link>
      </div>

      {/* Mobile add button */}
      <div className="px-3 pt-4 pb-2 lg:hidden">
        <Link
          href="/dashboard/garments/new"
          className="flex items-center justify-center w-10 h-10 rounded-md bg-white text-[#0A0A0A] hover:bg-white/90 transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map(item => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 h-9 px-3 rounded-md text-sm transition-colors duration-150 group relative',
                isActive
                  ? 'bg-surface-elevated text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated/50'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md bg-surface-elevated"
                  transition={{ duration: 0.15 }}
                />
              )}
              <item.icon className={cn('w-4 h-4 relative z-10 shrink-0', isActive && 'text-text-primary')} />
              <span className="hidden lg:block relative z-10 font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User / Logout */}
      <div className="px-3 py-3 border-t border-border">
        {auth && (
          <div className="hidden lg:block mb-2 px-3 py-2">
            <p className="text-xs font-medium text-text-primary truncate">{auth.brandName}</p>
            <p className="text-xs text-text-muted truncate">{auth.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 h-9 px-3 rounded-md text-sm text-text-muted hover:text-error hover:bg-error/10 transition-colors duration-150 w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden lg:block font-medium">Log out</span>
        </button>
      </div>
    </aside>
  )
}
