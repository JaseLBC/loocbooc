'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MapPin, Clock, Package, CheckCircle2, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RatingStars } from './RatingStars'
import { cn } from '@/lib/utils'
import type { ManufacturerListItem } from '@/types/manufacturer'

interface ManufacturerCardProps {
  manufacturer: ManufacturerListItem
  index?: number
}

const PRICE_TIER_LABELS: Record<string, string> = {
  mass: 'Budget',
  mid: 'Mid-Range',
  premium: 'Premium',
  luxury: 'Luxury',
}

const PRICE_TIER_COLORS: Record<string, string> = {
  mass: 'text-text-muted border-border',
  mid: 'text-text-secondary border-border',
  premium: 'text-accent-indigo border-accent-indigo/40',
  luxury: 'text-warning border-warning/40',
}

export function ManufacturerCard({ manufacturer, index = 0 }: ManufacturerCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <Link href={`/dashboard/manufacturers/${manufacturer.slug}`}>
        <div className="group rounded-xl border border-border bg-surface hover:border-accent-indigo/30 hover:bg-surface-elevated transition-all duration-150 overflow-hidden cursor-pointer">
          {/* Hero image */}
          <div className="h-40 bg-surface-elevated relative overflow-hidden">
            {manufacturer.heroImageUrl ? (
              <img
                src={manufacturer.heroImageUrl}
                alt={manufacturer.displayName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-elevated to-background">
                <Package className="w-12 h-12 text-text-muted" />
              </div>
            )}

            {/* Overlay badges */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
              {manufacturer.isVerified && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm border border-success/30">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                  <span className="text-[10px] font-medium text-success">Verified</span>
                </div>
              )}
              {manufacturer.isFeatured && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-indigo/90 backdrop-blur-sm">
                  <span className="text-[10px] font-medium text-white">Featured</span>
                </div>
              )}
            </div>

            {/* Price tier */}
            {manufacturer.priceTier && (
              <div className="absolute top-2 right-2">
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium border bg-background/80 backdrop-blur-sm',
                  PRICE_TIER_COLORS[manufacturer.priceTier] || 'text-text-muted border-border'
                )}>
                  {PRICE_TIER_LABELS[manufacturer.priceTier] || manufacturer.priceTier}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Name + Location */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-text-primary line-clamp-1 group-hover:text-white transition-colors">
                  {manufacturer.displayName}
                </h3>
                <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-text-muted" />
                <span className="text-xs text-text-muted">
                  {manufacturer.city ? `${manufacturer.city}, ` : ''}{manufacturer.country}
                </span>
              </div>
            </div>

            {/* Rating */}
            {manufacturer.ratingAvg !== null && manufacturer.ratingAvg > 0 ? (
              <RatingStars
                rating={manufacturer.ratingAvg}
                count={manufacturer.ratingCount}
                size="sm"
              />
            ) : (
              <span className="text-xs text-text-muted">No reviews yet</span>
            )}

            {/* MOQ + Lead time */}
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <div className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                <span>MOQ {manufacturer.moqMin?.toLocaleString() ?? '—'}</span>
              </div>
              {manufacturer.bulkLeadTimeDays && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{manufacturer.bulkLeadTimeDays}d lead</span>
                </div>
              )}
            </div>

            {/* Specialisations */}
            {manufacturer.specialisations.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {manufacturer.specialisations.slice(0, 3).map(spec => (
                  <span
                    key={spec}
                    className="px-1.5 py-0.5 rounded text-[10px] border border-border text-text-muted"
                  >
                    {spec}
                  </span>
                ))}
                {manufacturer.specialisations.length > 3 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] text-text-muted">
                    +{manufacturer.specialisations.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
