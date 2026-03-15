'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ManufacturerFilters as Filters } from '@/types/manufacturer'

interface ManufacturerFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
  onClear: () => void
  className?: string
}

const COUNTRY_OPTIONS = [
  { value: 'CN', label: 'China' },
  { value: 'IN', label: 'India' },
  { value: 'BD', label: 'Bangladesh' },
  { value: 'VN', label: 'Vietnam' },
  { value: 'TR', label: 'Turkey' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'PT', label: 'Portugal' },
  { value: 'IT', label: 'Italy' },
  { value: 'AU', label: 'Australia' },
  { value: 'US', label: 'United States' },
]

const SPECIALISATION_OPTIONS = [
  'Woven', 'Knitwear', 'Denim', 'Leather', 'Activewear',
  'Swimwear', 'Lingerie', 'Outerwear', 'Suits', 'Accessories',
]

const PRICE_TIER_OPTIONS = [
  { value: 'mass', label: 'Budget', desc: 'Low cost, high volume' },
  { value: 'mid', label: 'Mid-Range', desc: 'Balanced cost/quality' },
  { value: 'premium', label: 'Premium', desc: 'Quality-first' },
  { value: 'luxury', label: 'Luxury', desc: 'Top tier, artisan' },
]

const CERTIFICATION_OPTIONS = [
  'GOTS', 'OEKO-TEX', 'Fair Trade', 'BSCI', 'ISO 9001', 'Bluesign', 'SA8000',
]

const MOQ_OPTIONS = [
  { value: '0', label: 'Any MOQ' },
  { value: '50', label: 'Under 50' },
  { value: '100', label: 'Under 100' },
  { value: '500', label: 'Under 500' },
  { value: '1000', label: 'Under 1,000' },
]

export function ManufacturerFilters({ filters, onChange, onClear, className }: ManufacturerFiltersProps) {
  const hasActiveFilters =
    (filters.country?.length ?? 0) > 0 ||
    (filters.specialisations?.length ?? 0) > 0 ||
    (filters.priceTiers?.length ?? 0) > 0 ||
    (filters.certifications?.length ?? 0) > 0 ||
    filters.maxMoq !== undefined ||
    filters.verifiedOnly

  const toggleArrayFilter = <K extends keyof Filters>(
    key: K,
    value: string
  ) => {
    const arr = (filters[key] as string[] | undefined) ?? []
    const next = arr.includes(value)
      ? arr.filter(v => v !== value)
      : [...arr, value]
    onChange({ ...filters, [key]: next.length > 0 ? next : undefined })
  }

  const isActive = (key: keyof Filters, value: string): boolean => {
    const arr = filters[key] as string[] | undefined
    return arr?.includes(value) ?? false
  }

  return (
    <div className={cn('space-y-5', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Filters</h3>
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-error transition-colors"
            >
              <X className="w-3 h-3" />
              Clear all
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Verified only */}
      <div>
        <button
          onClick={() => onChange({ ...filters, verifiedOnly: !filters.verifiedOnly })}
          className={cn(
            'flex items-center gap-2 w-full text-sm px-3 py-2 rounded-lg border transition-all duration-150',
            filters.verifiedOnly
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-border text-text-muted hover:border-border/60 hover:text-text-secondary'
          )}
        >
          <div className={cn(
            'w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors',
            filters.verifiedOnly ? 'border-success bg-success' : 'border-text-muted'
          )}>
            {filters.verifiedOnly && (
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          Verified only
        </button>
      </div>

      {/* Price Tier */}
      <div>
        <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Price Tier</p>
        <div className="space-y-1">
          {PRICE_TIER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggleArrayFilter('priceTiers', opt.value)}
              className={cn(
                'flex items-center justify-between w-full text-left px-3 py-2 rounded-lg border text-sm transition-all duration-150',
                isActive('priceTiers', opt.value)
                  ? 'border-accent-indigo/50 bg-accent-indigo/10 text-text-primary'
                  : 'border-transparent text-text-muted hover:border-border hover:text-text-secondary'
              )}
            >
              <span>{opt.label}</span>
              <span className="text-xs text-text-muted">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Country */}
      <div>
        <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Country</p>
        <div className="flex flex-wrap gap-1.5">
          {COUNTRY_OPTIONS.map(c => (
            <button
              key={c.value}
              onClick={() => toggleArrayFilter('country', c.value)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border transition-all duration-150',
                isActive('country', c.value)
                  ? 'border-accent-indigo/50 bg-accent-indigo/10 text-text-primary'
                  : 'border-border text-text-muted hover:border-border/60 hover:text-text-secondary'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Specialisations */}
      <div>
        <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Specialisation</p>
        <div className="flex flex-wrap gap-1.5">
          {SPECIALISATION_OPTIONS.map(spec => (
            <button
              key={spec}
              onClick={() => toggleArrayFilter('specialisations', spec)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border transition-all duration-150',
                isActive('specialisations', spec)
                  ? 'border-accent-indigo/50 bg-accent-indigo/10 text-text-primary'
                  : 'border-border text-text-muted hover:border-border/60 hover:text-text-secondary'
              )}
            >
              {spec}
            </button>
          ))}
        </div>
      </div>

      {/* Max MOQ */}
      <div>
        <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Max MOQ</p>
        <div className="space-y-1">
          {MOQ_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange({
                ...filters,
                maxMoq: opt.value === '0' ? undefined : parseInt(opt.value),
              })}
              className={cn(
                'flex items-center justify-between w-full text-left px-3 py-2 rounded-lg border text-sm transition-all duration-150',
                (opt.value === '0' && !filters.maxMoq) || filters.maxMoq === parseInt(opt.value)
                  ? 'border-accent-indigo/50 bg-accent-indigo/10 text-text-primary'
                  : 'border-transparent text-text-muted hover:border-border hover:text-text-secondary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Certifications */}
      <div>
        <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Certifications</p>
        <div className="flex flex-wrap gap-1.5">
          {CERTIFICATION_OPTIONS.map(cert => (
            <button
              key={cert}
              onClick={() => toggleArrayFilter('certifications', cert)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border transition-all duration-150',
                isActive('certifications', cert)
                  ? 'border-success/50 bg-success/10 text-success'
                  : 'border-border text-text-muted hover:border-border/60 hover:text-text-secondary'
              )}
            >
              {cert}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
