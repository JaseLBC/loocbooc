'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Box, Shirt, MousePointerClick, Clock, ArrowRight, Zap, Users, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GarmentCard } from '@/components/garments/GarmentCard'
import { CampaignCard } from '@/components/back-it/CampaignCard'
import { useBrandStats, useGarments } from '@/hooks/useGarments'
import { useCampaigns } from '@/hooks/useCampaigns'
import { formatRelative, cn } from '@/lib/utils'

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  isLoading?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
          )}
        </div>
        <div className="w-9 h-9 rounded-lg bg-surface-elevated flex items-center justify-center">
          <Icon className="w-4 h-4 text-text-muted" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useBrandStats()
  const { data: garmentsData, isLoading: garmentsLoading } = useGarments({ limit: 8 })
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns()

  const recentGarments = (garmentsData?.items ?? (garmentsData as any)?.garments ?? []).slice(0, 8)
  const activeCampaigns = (campaignsData?.campaigns ?? []).filter(
    c => ['active', 'moq_reached'].includes(c.status)
  ).slice(0, 3)

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <h1 className="text-2xl font-bold text-text-primary">Good morning</h1>
        <p className="text-sm text-text-muted mt-1">Your garment catalogue at a glance.</p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          label="Total garments"
          value={stats?.totalGarments ?? 0}
          icon={Shirt}
          isLoading={statsLoading}
        />
        <StatCard
          label="3D models"
          value={stats?.garmentsWith3D ?? 0}
          icon={Box}
          isLoading={statsLoading}
        />
        <StatCard
          label="Total try-ons"
          value={stats?.totalTryOns?.toLocaleString() ?? 0}
          icon={MousePointerClick}
          isLoading={statsLoading}
        />
        <StatCard
          label="Last activity"
          value={stats?.lastActivityAt ? formatRelative(stats.lastActivityAt) : '—'}
          icon={Clock}
          isLoading={statsLoading}
        />
      </motion.div>

      {/* Back It summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className="rounded-xl border border-border bg-surface p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Back It</h2>
          </div>
          <Link href="/dashboard/back-it" className="text-xs text-text-muted hover:text-text-secondary flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <p className="text-lg font-bold text-success tabular-nums">
              {campaignsLoading ? '—' : campaignsData?.stats.totalActive ?? 0}
            </p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Live</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary tabular-nums">
              {campaignsLoading ? '—' : (campaignsData?.stats.totalBackers ?? 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Backers</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary tabular-nums">
              {campaignsLoading ? '—' :
                campaignsData?.stats.totalRevenueCents
                  ? `$${Math.round(campaignsData.stats.totalRevenueCents / 100).toLocaleString()}`
                  : '$0'}
            </p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Collected</p>
          </div>
        </div>
        {activeCampaigns.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {activeCampaigns.map((c, i) => (
              <CampaignCard key={c.id} campaign={c} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-surface-elevated border border-dashed border-border p-4">
            <p className="text-sm text-text-muted">No live campaigns.</p>
            <Link href="/dashboard/back-it/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                New campaign
              </Button>
            </Link>
          </div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
        className="flex flex-wrap items-center gap-3"
      >
        <Link href="/dashboard/garments/new">
          <Button size="lg" className="gap-2">
            <Plus className="w-4 h-4" />
            Add garment
          </Button>
        </Link>
        <Link href="/dashboard/back-it/new">
          <Button variant="outline" size="lg" className="gap-2">
            <Zap className="w-4 h-4" />
            New Back It campaign
          </Button>
        </Link>
        <Link href="/dashboard/garments">
          <Button variant="outline" size="lg" className="gap-2">
            View full catalogue
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
        <Button variant="ghost" size="lg" className="gap-2 text-text-muted cursor-not-allowed" disabled>
          <Box className="w-4 h-4" />
          Import from CLO3D
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text-muted">Soon</span>
        </Button>
      </motion.div>

      {/* Recent Garments */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Recent garments</h2>
          <Link
            href="/dashboard/garments"
            className="text-xs text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {garmentsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[4/5] rounded-xl" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : recentGarments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center">
              <Shirt className="w-6 h-6 text-text-muted" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary">No garments yet</p>
              <p className="text-xs text-text-muted mt-1">Add your first garment to get started.</p>
            </div>
            <Link href="/dashboard/garments/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add garment
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {recentGarments.map(garment => (
              <GarmentCard key={garment.ugi} garment={garment} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
