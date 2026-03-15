'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RatingStarsProps {
  rating: number // 0-5
  count?: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
  className?: string
}

const STAR_SIZES = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

export function RatingStars({
  rating,
  count,
  size = 'md',
  showCount = true,
  className,
}: RatingStarsProps) {
  const fullStars = Math.floor(rating)
  const halfStar = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0)
  const starSize = STAR_SIZES[size]

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star
            key={`full-${i}`}
            className={cn(starSize, 'fill-warning text-warning')}
          />
        ))}
        {halfStar && (
          <div className="relative">
            <Star className={cn(starSize, 'text-border')} />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className={cn(starSize, 'fill-warning text-warning')} />
            </div>
          </div>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star
            key={`empty-${i}`}
            className={cn(starSize, 'text-border')}
          />
        ))}
      </div>
      {showCount && count !== undefined && (
        <span className="text-xs text-text-muted">({count})</span>
      )}
    </div>
  )
}
