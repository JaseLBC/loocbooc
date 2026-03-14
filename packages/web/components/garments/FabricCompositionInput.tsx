'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { getFabricPhysicsLabels } from '@/lib/utils'
import type { FabricPhysics } from '@/types'

const COMMON_COMPOSITIONS = [
  '100% Cotton',
  '100% Linen',
  '100% Silk',
  '100% Wool',
  '100% Polyester',
  '80% Wool, 20% Cashmere',
  '85% Polyester, 15% Elastane',
  '95% Cotton, 5% Elastane',
  '70% Viscose, 30% Linen',
  '60% Cotton, 40% Polyester',
  '90% Nylon, 10% Elastane',
  '50% Wool, 50% Polyester',
]

interface FabricCompositionInputProps {
  value: string
  onChange: (value: string) => void
  onPhysicsChange: (physics: FabricPhysics | null) => void
  physics: FabricPhysics | null
}

function PhysicsBar({ label, value, sublabel }: { label: string; value: number; sublabel: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="text-xs text-text-muted">{sublabel}</span>
      </div>
      <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent-indigo rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
    </div>
  )
}

export function FabricCompositionInput({
  value,
  onChange,
  onPhysicsChange,
  physics,
}: FabricCompositionInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoadingPhysics, setIsLoadingPhysics] = useState(false)
  const [isScanningLabel, setIsScanningLabel] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filter suggestions
  useEffect(() => {
    if (!value || value.length < 2) {
      setSuggestions([])
      return
    }
    const filtered = COMMON_COMPOSITIONS.filter(c =>
      c.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 5)
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }, [value])

  // Debounced physics lookup
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value || value.length < 5) {
      onPhysicsChange(null)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoadingPhysics(true)
      try {
        const p = await api.fabrics.getPhysics(value)
        onPhysicsChange(p)
      } catch {
        // silent fail
      } finally {
        setIsLoadingPhysics(false)
      }
    }, 800)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, onPhysicsChange])

  const handleScanLabel = async (file: File) => {
    setIsScanningLabel(true)
    try {
      const composition = await api.scan.label(file)
      onChange(composition)
    } catch {
      // silent
    } finally {
      setIsScanningLabel(false)
    }
  }

  const physicsLabels = physics ? getFabricPhysicsLabels(physics) : null

  return (
    <div className="space-y-4">
      {/* Composition Input */}
      <div className="relative">
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. 85% Polyester, 15% Elastane"
          className="min-h-[80px] text-sm resize-none pr-4"
          onFocus={() => setShowSuggestions(suggestions.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />

        {/* Suggestions */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border border-border bg-surface-elevated overflow-hidden"
            >
              {suggestions.map(s => (
                <button
                  key={s}
                  onMouseDown={() => {
                    onChange(s)
                    setShowSuggestions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scan Label Button */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanningLabel}
          className="gap-2"
        >
          {isScanningLabel ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Scan className="w-3.5 h-3.5" />
          )}
          {isScanningLabel ? 'Reading label...' : 'Scan care label'}
        </Button>
        <span className="text-xs text-text-muted">
          Photo your care label — we'll read it automatically
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleScanLabel(file)
        }}
      />

      {/* Physics Reveal */}
      <AnimatePresence>
        {(physics || isLoadingPhysics) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-surface-elevated p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-indigo" />
                <span className="text-sm font-medium text-text-primary">Fabric physics derived</span>
                {isLoadingPhysics && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted ml-auto" />
                )}
              </div>

              {physics && physicsLabels && (
                <div className="space-y-3">
                  <PhysicsBar label="Drape" value={physics.drape} sublabel={physicsLabels.drape} />
                  <PhysicsBar label="Stretch" value={physics.stretch} sublabel={physicsLabels.stretch} />
                  <PhysicsBar label="Weight" value={physics.weight} sublabel={physicsLabels.weight} />
                </div>
              )}

              {isLoadingPhysics && !physics && (
                <div className="space-y-3">
                  {['Drape', 'Stretch', 'Weight'].map(label => (
                    <div key={label} className="space-y-1.5">
                      <div className="h-3 w-16 bg-border rounded animate-pulse" />
                      <div className="h-1.5 bg-border rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-text-muted">
                These parameters control how your garment moves and drapes in 3D simulation.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
