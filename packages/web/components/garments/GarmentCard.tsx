'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Box, Shirt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS, formatRelative } from '@/lib/utils'
import type { Garment } from '@/types'

interface GarmentCardProps {
  garment: Garment
}

export function GarmentCard({ garment }: GarmentCardProps) {
  const statusVariant = (() => {
    switch (garment.status) {
      case 'active': return 'success'
      case 'processing': return 'warning'
      case 'error': return 'error'
      default: return 'secondary'
    }
  })() as 'success' | 'warning' | 'error' | 'secondary'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/dashboard/garments/${garment.ugi}`}>
        <div className="group rounded-xl border border-border bg-surface hover:border-border/80 hover:bg-surface-elevated transition-all duration-150 overflow-hidden cursor-pointer">
          {/* Thumbnail */}
          <div className="aspect-[4/5] bg-surface-elevated relative overflow-hidden">
            {garment.thumbnailUrl ? (
              <img
                src={garment.thumbnailUrl}
                alt={garment.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <Shirt className="w-10 h-10 text-text-muted" />
                <span className="text-xs text-text-muted">{CATEGORY_LABELS[garment.category]}</span>
              </div>
            )}

            {/* 3D badge */}
            {garment.hasModel3D && (
              <div className="absolute top-2 right-2">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm border border-border">
                  <Box className="w-3 h-3 text-accent-indigo" />
                  <span className="text-[10px] font-medium text-text-secondary">3D</span>
                </div>
              </div>
            )}

            {/* Processing overlay */}
            {garment.status === 'processing' && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse delay-75" />
                  <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse delay-150" />
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-text-primary leading-tight line-clamp-1 group-hover:text-white transition-colors">
                {garment.name}
              </h3>
              <Badge variant={statusVariant} className="shrink-0 text-[10px] px-1.5 py-0">
                {STATUS_LABELS[garment.status]}
              </Badge>
            </div>

            <p className="text-xs text-text-muted font-mono tracking-wider">{garment.ugi}</p>

            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">{CATEGORY_LABELS[garment.category]}</span>
              <span className="text-xs text-text-muted">{formatRelative(garment.createdAt)}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
