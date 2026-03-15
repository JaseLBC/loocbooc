'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MoqProgressBarProps {
  currentCount: number
  moq: number
  stretchGoalQty?: number | null
  percentComplete: number
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
  animate?: boolean
}

export function MoqProgressBar({
  currentCount,
  moq,
  stretchGoalQty,
  percentComplete,
  size = 'md',
  showLabels = true,
  animate = true,
}: MoqProgressBarProps) {
  const clamped = Math.min(percentComplete, 100)
  const isReached = clamped >= 100

  // If stretch goal exists, show secondary indicator
  const stretchPercent = stretchGoalQty
    ? Math.min((currentCount / stretchGoalQty) * 100, 100)
    : null

  const barHeight = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'

  return (
    <div className="w-full space-y-1.5">
      {showLabels && (
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-text-primary tabular-nums">
              {currentCount}
            </span>
            <span className="text-xs text-text-muted">
              / {moq} backers
            </span>
            {stretchGoalQty && isReached && (
              <span className="text-xs text-text-muted">
                · stretch: {stretchGoalQty}
              </span>
            )}
          </div>
          <span className={cn(
            'text-sm font-semibold tabular-nums',
            isReached ? 'text-success' : 'text-text-primary'
          )}>
            {clamped.toFixed(0)}%
          </span>
        </div>
      )}

      {/* Track */}
      <div className={cn('w-full rounded-full bg-surface-elevated overflow-hidden', barHeight)}>
        {animate ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clamped}%` }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              'h-full rounded-full transition-colors',
              isReached ? 'bg-success' : 'bg-accent-indigo'
            )}
          />
        ) : (
          <div
            style={{ width: `${clamped}%` }}
            className={cn(
              'h-full rounded-full',
              isReached ? 'bg-success' : 'bg-accent-indigo'
            )}
          />
        )}
      </div>

      {/* Stretch goal secondary bar (only shows once MOQ hit) */}
      {stretchGoalQty && isReached && stretchPercent !== null && (
        <div className={cn('w-full rounded-full bg-surface-elevated overflow-hidden', size === 'sm' ? 'h-1' : 'h-1.5')}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stretchPercent}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="h-full rounded-full bg-warning"
          />
        </div>
      )}

      {stretchGoalQty && isReached && (
        <p className="text-[10px] text-text-muted">
          {currentCount >= stretchGoalQty
            ? `Stretch goal of ${stretchGoalQty} reached! 🎉`
            : `${stretchGoalQty - currentCount} more to unlock stretch goal`}
        </p>
      )}
    </div>
  )
}
