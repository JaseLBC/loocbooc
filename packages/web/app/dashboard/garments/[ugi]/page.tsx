'use client'

import { use } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Edit, Box, Tag, Calendar, Ruler } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GarmentViewer3D } from '@/components/garments/GarmentViewer3D'
import { ProcessingStatus } from '@/components/garments/ProcessingStatus'
import { useGarment } from '@/hooks/useGarments'
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS, SEASON_LABELS, formatDate, getFabricPhysicsLabels, cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

interface GarmentDetailPageProps {
  params: Promise<{ ugi: string }>
}

export default function GarmentDetailPage({ params }: GarmentDetailPageProps) {
  const { ugi } = use(params)
  const queryClient = useQueryClient()
  const { data: garment, isLoading, error } = useGarment(ugi)

  const handleProcessingComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['garment', ugi] })
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !garment) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-text-muted">Garment not found.</p>
        <Link href="/dashboard/garments">
          <Button variant="outline" size="sm">Back to catalogue</Button>
        </Link>
      </div>
    )
  }

  const statusVariant = (() => {
    switch (garment.status) {
      case 'active': return 'success'
      case 'processing': return 'warning'
      case 'error': return 'error'
      default: return 'secondary'
    }
  })() as 'success' | 'warning' | 'error' | 'secondary'

  const physicsLabels = garment.fabricPhysics ? getFabricPhysicsLabels(garment.fabricPhysics) : null

  return (
    <div className="max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/garments"
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Garments
        </Link>
        <Link href={`/dashboard/garments/${ugi}/edit`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Edit className="w-3.5 h-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6"
      >
        {/* 3D Viewer */}
        <div className="space-y-4">
          <GarmentViewer3D
            modelUrl={garment.modelUrl}
            usdzUrl={garment.usdzUrl}
            category={garment.category}
            isProcessing={garment.status === 'processing'}
            className="aspect-square"
          />

          {/* Processing status */}
          {garment.status === 'processing' && (
            <ProcessingStatus
              ugi={garment.ugi}
              onComplete={handleProcessingComplete}
            />
          )}
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusVariant}>{STATUS_LABELS[garment.status]}</Badge>
              {garment.hasModel3D && (
                <Badge variant="secondary" className="gap-1">
                  <Box className="w-3 h-3" />
                  3D
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-text-primary leading-tight">{garment.name}</h1>
            <p className="text-xs font-mono text-text-muted tracking-widest">{garment.ugi}</p>
          </div>

          {/* Details */}
          <div className="rounded-xl border border-border bg-surface divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <Tag className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs text-text-muted flex-1">Category</span>
              <span className="text-sm text-text-secondary">{CATEGORY_LABELS[garment.category]}</span>
            </div>
            {garment.season && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Calendar className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs text-text-muted flex-1">Season</span>
                <span className="text-sm text-text-secondary">{SEASON_LABELS[garment.season]}</span>
              </div>
            )}
            {garment.sku && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Ruler className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs text-text-muted flex-1">SKU</span>
                <span className="text-sm font-mono text-text-secondary">{garment.sku}</span>
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-3">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs text-text-muted flex-1">Created</span>
              <span className="text-sm text-text-secondary">{formatDate(garment.createdAt)}</span>
            </div>
          </div>

          {/* Fabric Composition */}
          {garment.fabricComposition && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Fabric</h3>
              <p className="text-sm text-text-secondary">{garment.fabricComposition}</p>

              {garment.fabricPhysics && physicsLabels && (
                <div className="space-y-2.5">
                  {[
                    { label: 'Drape', value: garment.fabricPhysics.drape, sublabel: physicsLabels.drape },
                    { label: 'Stretch', value: garment.fabricPhysics.stretch, sublabel: physicsLabels.stretch },
                    { label: 'Weight', value: garment.fabricPhysics.weight, sublabel: physicsLabels.weight },
                  ].map(({ label, value, sublabel }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-muted">{label}</span>
                        <span className="text-text-secondary">{sublabel}</span>
                      </div>
                      <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-accent-indigo rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${value}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {garment.description && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">Description</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{garment.description}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
