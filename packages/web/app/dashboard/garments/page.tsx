'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, Filter, LayoutGrid, List, Plus, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GarmentGrid } from '@/components/garments/GarmentGrid'
import { Badge } from '@/components/ui/badge'
import { useGarments } from '@/hooks/useGarments'
import { cn } from '@/lib/utils'
import type { GarmentCategory, GarmentStatus, GarmentSeason } from '@/types'

const CATEGORY_FILTERS: { label: string; value: GarmentCategory }[] = [
  { label: 'Top', value: 'top' },
  { label: 'Bottom', value: 'bottom' },
  { label: 'Dress', value: 'dress' },
  { label: 'Outerwear', value: 'outerwear' },
  { label: 'Activewear', value: 'activewear' },
  { label: 'Swimwear', value: 'swimwear' },
]

const STATUS_FILTERS: { label: string; value: GarmentStatus }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Processing', value: 'processing' },
  { label: 'Draft', value: 'draft' },
]

type ViewMode = 'grid' | 'list'

export default function GarmentsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<GarmentCategory | undefined>()
  const [statusFilter, setStatusFilter] = useState<GarmentStatus | undefined>()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading } = useGarments({
    search: search || undefined,
    category: categoryFilter,
    status: statusFilter,
  })

  const garments = data?.garments ?? []
  const total = data?.total ?? 0

  const activeFilterCount = [categoryFilter, statusFilter].filter(Boolean).length

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Garments</h1>
          {!isLoading && (
            <p className="text-sm text-text-muted mt-1">
              {total} garment{total !== 1 ? 's' : ''} in your catalogue
            </p>
          )}
        </div>
        <Link href="/dashboard/garments/new">
          <Button size="lg" className="gap-2">
            <Plus className="w-4 h-4" />
            Add garment
          </Button>
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, UGI, or category..."
              className="pl-9"
            />
          </div>

          {/* Filter toggle */}
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowFilters(!showFilters)}
            className={cn('gap-2', showFilters && 'border-accent-indigo/50 bg-accent-indigo/5')}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-accent-indigo text-white">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {/* View toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'grid' ? 'bg-surface-elevated text-text-primary' : 'text-text-muted hover:text-text-secondary'
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'list' ? 'bg-surface-elevated text-text-primary' : 'text-text-muted hover:text-text-secondary'
              )}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-muted">Category:</span>
              {CATEGORY_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setCategoryFilter(categoryFilter === f.value ? undefined : f.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150',
                    categoryFilter === f.value
                      ? 'border-accent-indigo bg-accent-indigo/10 text-text-primary'
                      : 'border-border bg-surface text-text-muted hover:border-border/60 hover:text-text-secondary'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-muted">Status:</span>
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(statusFilter === f.value ? undefined : f.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150',
                    statusFilter === f.value
                      ? 'border-accent-indigo bg-accent-indigo/10 text-text-primary'
                      : 'border-border bg-surface text-text-muted hover:border-border/60 hover:text-text-secondary'
                  )}
                >
                  {f.label}
                </button>
              ))}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setCategoryFilter(undefined); setStatusFilter(undefined) }}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-error/20 text-error hover:bg-error/10 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Bulk actions bar (future — disabled for now) */}
      <div className="flex items-center gap-2 opacity-30 pointer-events-none">
        <input type="checkbox" className="w-4 h-4 accent-accent-indigo" disabled />
        <span className="text-xs text-text-muted">Select all</span>
        <span className="text-border">|</span>
        <button className="text-xs text-text-muted" disabled>Archive</button>
        <button className="text-xs text-text-muted" disabled>Export</button>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text-muted ml-1">
          Coming soon
        </span>
      </div>

      {/* Garment Grid */}
      <GarmentGrid
        garments={garments}
        isLoading={isLoading}
        emptyMessage={
          search || activeFilterCount > 0
            ? 'No garments match your search or filters.'
            : 'Your catalogue is empty. Add your first garment.'
        }
      />
    </div>
  )
}
