'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, Circle, AlertCircle } from 'lucide-react'
import { usePipelineStatus } from '@/hooks/usePipelineStatus'
import { formatEstimatedTime, cn } from '@/lib/utils'
import type { PipelineStageStatus } from '@/types'

interface ProcessingStatusProps {
  ugi: string
  onComplete?: () => void
}

function StageIcon({ status }: { status: PipelineStageStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
    case 'running':
      return <Loader2 className="w-4 h-4 text-accent-indigo shrink-0 animate-spin" />
    case 'error':
      return <AlertCircle className="w-4 h-4 text-error shrink-0" />
    default:
      return <Circle className="w-4 h-4 text-text-muted shrink-0" />
  }
}

export function ProcessingStatus({ ugi, onComplete }: ProcessingStatusProps) {
  const { status, isLoading, isComplete, error, getStageProgress } = usePipelineStatus({
    ugi,
    enabled: true,
    onComplete,
  })

  if (isLoading && !status) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <div className="h-5 w-40 bg-surface-elevated rounded animate-pulse" />
        <div className="h-px bg-border" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-surface-elevated animate-pulse" />
            <div className="h-3 bg-surface-elevated rounded animate-pulse flex-1 max-w-[200px]" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error/20 bg-error/5 p-6">
        <p className="text-sm text-error">Failed to get processing status: {error}</p>
      </div>
    )
  }

  if (!status) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-surface overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          {isComplete ? 'Processing complete' : 'Processing your garment'}
        </h3>
        {!isComplete && status.estimatedSecondsRemaining && (
          <span className="text-xs text-text-muted">
            {formatEstimatedTime(status.estimatedSecondsRemaining)} remaining
          </span>
        )}
      </div>

      {/* Stages */}
      <div className="px-5 py-4 space-y-3">
        {status.stages.map(stage => {
          const isRunning = stage.status === 'running'
          const progress = isRunning ? getStageProgress(stage.id) : (stage.status === 'complete' ? 100 : 0)

          return (
            <div key={stage.id} className="space-y-1.5">
              <div className="flex items-center gap-3">
                <StageIcon status={stage.status} />
                <span className={cn(
                  'text-sm',
                  stage.status === 'complete' ? 'text-text-secondary' :
                  stage.status === 'running' ? 'text-text-primary font-medium' :
                  'text-text-muted'
                )}>
                  {stage.label}
                </span>
                {stage.detail && (
                  <span className="text-xs text-text-muted ml-auto">{stage.detail}</span>
                )}
                {isRunning && progress > 0 && (
                  <span className="text-xs text-text-muted ml-auto tabular-nums">{progress}%</span>
                )}
              </div>

              {/* Progress bar for running stage */}
              <AnimatePresence>
                {isRunning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="ml-7 overflow-hidden"
                  >
                    <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-accent-indigo rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Complete state */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-5 pb-4"
        >
          <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3">
            <p className="text-sm text-success font-medium">Your 3D garment is ready</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
