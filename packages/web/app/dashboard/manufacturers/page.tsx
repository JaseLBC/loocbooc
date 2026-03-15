'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, Factory, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ManufacturerCard } from '@/components/manufacturers/ManufacturerCard'
import { ManufacturerFilters } from '@/components/manufacturers/ManufacturerFilters'
import { useManufacturers } from '@/hooks/useManufacturers'
import { cn } from '@/lib/utils'
import type { ManufacturerFilters as Filters } from '@/types/manufacturer'

const EMPTY_FILTERS: Filters = {}

function ManufacturerCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="h-40 bg-surface-elevated animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-surface-elevated rounded animate-pulse w-3/4" />
        <div className="h-3 bg-surface-elevated rounded animate-pulse w-1/2" />
        <div className="h-3 bg-surface-elevated rounded animate-pulse w-1/3" />
        <div className="flex gap-1">
          <div className="h-5 w-16 bg-surface-elevated rounded animate-pulse" />
          <div className="h-5 w-14 bg-surface-elevated rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default function ManufacturersPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  const activeFilters: Filters = {
    ...filters,
    search: search || undefined,
    page,
    limit: 12,
  }

  const { data, isLoading } = useManufacturers(activeFilters)

  const manufacturers = data?.manufacturers ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 12)

  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters)
    setPage(1)
  }, [])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setSearch('')
    setPage(1)
  }, [])

  const activeFilterCount = [
    ...(filters.country ?? []),
    ...(filters.specialisations ?? []),
    ...(filters.priceTiers ?? []),
    ...(filters.certifications ?? []),
  ].length + (filters.maxMoq !== undefined ? 1 : 0) + (filters.verifiedOnly ? 1 : 0)

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Manufacturers</h1>
          {!isLoading && (
            <p className="text-sm text-text-muted mt-1">
              {total} manufacturer{total !== 1 ? 's' : ''} on the platform
            </p>
          )}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name, country, or specialisation..."
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'gap-2 shrink-0',
            showFilters && 'border-accent-indigo/50 bg-accent-indigo/5'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0 h-4 min-w-[16px] rounded-full bg-accent-indigo text-white text-[10px] font-medium flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Main layout */}
      <div className="flex gap-6">
        {/* Filter sidebar */}
        <AnimatePresence>
          {showFilters && (
            <motion.aside
              initial={{ opacity: 0, width: 0, x: -10 }}
              animate={{ opacity: 1, width: 240, x: 0 }}
              exit={{ opacity: 0, width: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 overflow-hidden"
            >
              <div className="w-60 bg-surface border border-border rounded-xl p-4">
                <ManufacturerFilters
                  filters={filters}
                  onChange={handleFiltersChange}
                  onClear={handleClearFilters}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className={cn(
              'grid gap-4',
              showFilters
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            )}>
              {Array.from({ length: 8 }).map((_, i) => (
                <ManufacturerCardSkeleton key={i} />
              ))}
            </div>
          ) : manufacturers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
                <Factory className="w-8 h-8 text-text-muted" />
              </div>
              <h3 className="text-base font-medium text-text-primary">No manufacturers found</h3>
              <p className="text-sm text-text-muted mt-1 max-w-sm">
                {search || activeFilterCount > 0
                  ? 'Try adjusting your search or filters.'
                  : 'No manufacturers are listed on the platform yet.'}
              </p>
              {(search || activeFilterCount > 0) && (
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="mt-4"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className={cn(
                'grid gap-4',
                showFilters
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
              )}>
                {manufacturers.map((mfr, i) => (
                  <ManufacturerCard key={mfr.id} manufacturer={mfr} index={i} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                  <p className="text-sm text-text-muted">
                    Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={cn(
                            'w-8 h-8 rounded-md text-sm font-medium transition-colors',
                            page === pageNum
                              ? 'bg-surface-elevated text-text-primary'
                              : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated/50'
                          )}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
