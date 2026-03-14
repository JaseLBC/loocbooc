'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ScanStatus, PipelineStageStatus } from '@/types'

interface UsePipelineStatusOptions {
  ugi: string
  enabled?: boolean
  pollIntervalMs?: number
  onComplete?: () => void
}

interface PipelineState {
  status: ScanStatus | null
  isLoading: boolean
  isComplete: boolean
  error: string | null
  // Smoothed progress values (avoid jarring jumps)
  smoothedProgress: Record<string, number>
}

export function usePipelineStatus({
  ugi,
  enabled = true,
  pollIntervalMs = 3000,
  onComplete,
}: UsePipelineStatusOptions) {
  const [state, setState] = useState<PipelineState>({
    status: null,
    isLoading: true,
    isComplete: false,
    error: null,
    smoothedProgress: {},
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const clearPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const poll = useCallback(async () => {
    if (!ugi || !enabled) return

    try {
      const status = await api.garments.getScanStatus(ugi)
      const isComplete = status.status === 'active'

      setState(prev => {
        // Smooth progress: never go backwards, ease toward target
        const smoothedProgress = { ...prev.smoothedProgress }
        for (const stage of status.stages) {
          if (stage.progress !== undefined) {
            const current = smoothedProgress[stage.id] ?? 0
            const target = stage.progress
            // Smooth: move 60% of the way to target
            smoothedProgress[stage.id] = Math.round(current + (target - current) * 0.6)
          }
        }

        return {
          status,
          isLoading: false,
          isComplete,
          error: null,
          smoothedProgress,
        }
      })

      if (isComplete) {
        clearPoll()
        onCompleteRef.current?.()
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to get pipeline status',
      }))
    }
  }, [ugi, enabled, clearPoll])

  useEffect(() => {
    if (!enabled || !ugi) return

    poll() // immediate first poll
    intervalRef.current = setInterval(poll, pollIntervalMs)

    return clearPoll
  }, [ugi, enabled, pollIntervalMs, poll, clearPoll])

  const getStageStatus = (stageId: string): PipelineStageStatus => {
    const stage = state.status?.stages.find(s => s.id === stageId)
    return stage?.status ?? 'pending'
  }

  const getStageProgress = (stageId: string): number => {
    return state.smoothedProgress[stageId] ?? 0
  }

  return {
    ...state,
    getStageStatus,
    getStageProgress,
  }
}
