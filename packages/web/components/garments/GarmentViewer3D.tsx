'use client'

import { useRef, useState, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, Center, Html } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCw, ZoomIn, ExternalLink, Shirt, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { GarmentCategory } from '@/types'

// ---- 3D Model Component ----

interface ModelProps {
  url: string
  onLoad?: () => void
}

function Model({ url, onLoad }: ModelProps) {
  const { scene } = useGLTF(url)

  // Trigger onLoad on first render
  const hasCalledOnLoad = useRef(false)
  if (!hasCalledOnLoad.current) {
    hasCalledOnLoad.current = true
    onLoad?.()
  }

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  )
}

// ---- Hint Overlay ----

function ControlsHint({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-2 rounded-lg bg-background/60 backdrop-blur-sm border border-border pointer-events-none"
        >
          <span className="text-xs text-text-muted flex items-center gap-1.5">
            <RotateCw className="w-3 h-3" />
            Drag to rotate
          </span>
          <span className="w-px h-3 bg-border" />
          <span className="text-xs text-text-muted flex items-center gap-1.5">
            <ZoomIn className="w-3 h-3" />
            Scroll to zoom
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---- Placeholder ----

interface PlaceholderProps {
  category: GarmentCategory
  isProcessing?: boolean
}

function Placeholder3D({ category, isProcessing }: PlaceholderProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-surface-elevated rounded-xl border border-border">
      <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center">
        <Shirt className="w-8 h-8 text-text-muted" />
      </div>
      <div className="text-center space-y-1">
        {isProcessing ? (
          <>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-accent-indigo animate-spin" />
              <p className="text-sm font-medium text-text-secondary">3D model processing...</p>
            </div>
            <p className="text-xs text-text-muted">This takes 3–5 minutes</p>
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">No 3D model available</p>
          </>
        )}
      </div>
    </div>
  )
}

// ---- Loading State ----

function LoadingState() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-accent-indigo animate-spin" />
        <span className="text-xs text-text-muted">Loading 3D model...</span>
      </div>
    </div>
  )
}

// ---- Main Viewer ----

interface GarmentViewer3DProps {
  modelUrl?: string
  usdzUrl?: string
  category: GarmentCategory
  isProcessing?: boolean
  className?: string
}

export function GarmentViewer3D({
  modelUrl,
  usdzUrl,
  category,
  isProcessing,
  className,
}: GarmentViewer3DProps) {
  const [showHints, setShowHints] = useState(true)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  const handleInteraction = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true)
      setShowHints(false)
    }
  }, [hasInteracted])

  const handleModelLoad = useCallback(() => {
    setIsModelLoaded(true)
    // Hide hints after 3s if no interaction
    setTimeout(() => {
      if (!hasInteracted) setShowHints(false)
    }, 3000)
  }, [hasInteracted])

  if (!modelUrl) {
    return (
      <div className={cn('relative', className)}>
        <Placeholder3D category={category} isProcessing={isProcessing} />
      </div>
    )
  }

  return (
    <div className={cn('relative rounded-xl overflow-hidden border border-border bg-surface-elevated', className)}>
      {/* Loading skeleton */}
      {!isModelLoaded && (
        <div className="absolute inset-0 z-10">
          <Skeleton className="w-full h-full rounded-xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingState />
          </div>
        </div>
      )}

      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
        onPointerDown={handleInteraction}
        onWheel={handleInteraction}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 10, 5]} intensity={1.2} />
          <directionalLight position={[-5, -2, -5]} intensity={0.3} />

          <Model url={modelUrl} onLoad={handleModelLoad} />

          <Environment preset="studio" />
          <OrbitControls
            enablePan={false}
            minDistance={1}
            maxDistance={6}
            autoRotate={!hasInteracted}
            autoRotateSpeed={1}
          />
        </Suspense>
      </Canvas>

      {/* Controls hint */}
      <ControlsHint visible={showHints && isModelLoaded} />

      {/* AR Button (iOS USDZ) */}
      {usdzUrl && (
        <div className="absolute top-3 right-3">
          <a
            href={usdzUrl}
            rel="ar"
            aria-label="View in AR"
          >
            <Button variant="secondary" size="sm" className="gap-1.5 text-xs bg-background/80 backdrop-blur-sm border-border">
              <ExternalLink className="w-3.5 h-3.5" />
              AR
            </Button>
          </a>
        </div>
      )}
    </div>
  )
}
