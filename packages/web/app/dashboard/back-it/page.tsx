'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Zap, CheckCircle2, Clock, TrendingUp, Users, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CampaignCard } from '@/components/back-it/CampaignCard'
import { useCampaigns } from '@/hooks/useCampaigns'
import { cn } from '@/lib/utils'
import type { CampaignStatus } from '@/types/back-it'

type FilterTab = 'all' | 'active' | 'draft' | 'completed'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Live' },
  { key: 'draft', label: 'Draft' },
  { key: 'completed', label: 'Completed' },
]

const ACTIVE_STATUSES: CampaignStatus[] = ['active', 'moq_reached', 'funded', 'in_production', 'shipped']
const DRAFT_STATUSES: CampaignStatus[] = ['draft', 'scheduled']
const COMPLETED_STATUSES: CampaignStatus[] = ['completed', 'cancelled', 'expired']

function formatCurrency(cents: number) {
  if (cents >= 100_000_00) {
    return `$${(cents / 100_000_00).toFixed(1)}M`
  }
  if (cents >= 100_00) {
    return `$${(cents / 100_00).toFixed(0)}K`
  }
  return `$${(cents / 100).toFixed(0)}`
}

function StatTile({
  icon: Icon,
  label,
  value,
  isLoading,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  isLoading?: boolean
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
          {isLoading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className={cn('text-xl font-bold tabular-nums', accent ?? 'text-text-primary')}>{value}</p>
          )}
        </div>
        <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center">
          <Icon className="w-4 h-4 text-text-muted" />
        </div>
      </div>
    </div>
  )
}

export default function BackItPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  const statusFilter =
    activeTab === 'active' ? 'active' :
    activeTab === 'draft' ? 'draft' :
    activeTab === 'completed' ? 'completed' :
    'all'

  const { data, isLoading } = useCampaigns(
    search || statusFilter !== 'all'
      ? { status: statusFilter as CampaignStatus | 'all', search: search || undefined }
      : undefined
  )

  const campaigns = data?.campaigns ?? []
  const stats = data?.stats

  // Client-side tab filtering (mock data returns all)
  const filtered = campaigns.filter(c => {
    if (activeTab === 'active') return ACTIVE_STATUSES.includes(c.status)
    if (activeTab === 'draft') return DRAFT_STATUSES.includes(c.status)
    if (activeTab === 'completed') return COMPLETED_STATUSES.includes(c.status)
    return true
  })

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Back It Campaigns</h1>
          <p className="text-sm text-text-muted mt-1">
            Demand-first production. Hit MOQ, go to production.
          </p>
        </div>
        <Link href="/dashboard/back-it/new">
          <Button className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            New campaign
          </Button>
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <StatTile
          icon={Zap}
          label="Live campaigns"
          value={stats?.totalActive ?? 0}
          isLoading={isLoading}
          accent="text-success"
        />
        <StatTile
          icon={Clock}
          label="Drafts"
          value={stats?.totalDraft ?? 0}
          isLoading={isLoading}
        />
        <StatTile
          icon={Users}
          label="Total backers"
          value={(stats?.totalBackers ?? 0).toLocaleString()}
          isLoading={isLoading}
        />
        <StatTile
          icon={TrendingUp}
          label="Revenue collected"
          value={stats ? formatCurrency(stats.totalRevenueCents) : '—'}
          isLoading={isLoading}
          accent="text-text-primary"
        />
      </motion.div>

      {/* Tabs + Search */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-3 flex-wrap"
      >
        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-1">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
                activeTab === tab.key
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="pl-8 h-9 w-52 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Campaign grid */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-border">
            <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-secondary">
              {search ? 'No campaigns match your search' :
               activeTab === 'active' ? 'No live campaigns' :
               activeTab === 'draft' ? 'No drafts' :
               activeTab === 'completed' ? 'No completed campaigns' :
               'No campaigns yet'}
            </p>
            <p className="text-xs text-text-muted mt-1 max-w-xs">
              {search || activeTab !== 'all'
                ? 'Try a different filter or search term.'
                : 'Create your first Back It campaign to start demand-first production.'}
            </p>
            {!search && activeTab === 'all' && (
              <Link href="/dashboard/back-it/new" className="mt-4">
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Create campaign
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((campaign, i) => (
              <CampaignCard key={campaign.id} campaign={campaign} index={i} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
