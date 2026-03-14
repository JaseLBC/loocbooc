'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { GarmentCard } from './GarmentCard'
import type { Garment } from '@/types'

interface GarmentGridProps {
  garments: Garment[]
  isLoading?: boolean
  emptyMessage?: string
}

export function GarmentGrid({ garments, isLoading, emptyMessage = 'No garments found.' }: GarmentGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[4/5] rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (garments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-text-muted text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
      {garments.map(garment => (
        <GarmentCard key={garment.ugi} garment={garment} />
      ))}
    </div>
  )
}
