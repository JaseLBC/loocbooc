'use client'

import type { BodyType } from '@/types/avatar'

interface BodyDiagramProps {
  bodyType?: BodyType | null
  highlightZone?: string | null
  className?: string
  showLabels?: boolean
}

const BODY_TYPE_DESCRIPTIONS: Record<BodyType, string> = {
  hourglass: 'Shoulders and hips roughly equal, defined waist',
  pear: 'Hips wider than shoulders, defined waist',
  apple: 'Fuller midsection, narrower hips',
  rectangle: 'Shoulders, waist and hips roughly equal',
  inverted_triangle: 'Shoulders wider than hips',
}

// Simple SVG body silhouette that morphs per body type
export function BodyDiagram({
  bodyType,
  highlightZone,
  className = '',
  showLabels = true,
}: BodyDiagramProps) {
  // Silhouette path varies slightly per body type
  const getSilhouettePath = () => {
    switch (bodyType) {
      case 'hourglass':
        return 'M 50 10 C 70 10, 80 20, 78 35 C 76 50, 60 55, 62 65 C 64 75, 80 80, 78 95 C 76 110, 65 115, 50 115 C 35 115, 24 110, 22 95 C 20 80, 36 75, 38 65 C 40 55, 24 50, 22 35 C 20 20, 30 10, 50 10Z'
      case 'pear':
        return 'M 50 10 C 66 10, 72 20, 70 35 C 68 50, 55 55, 58 65 C 62 75, 82 80, 80 95 C 78 110, 65 116, 50 116 C 35 116, 22 110, 20 95 C 18 80, 38 75, 42 65 C 45 55, 32 50, 30 35 C 28 20, 34 10, 50 10Z'
      case 'apple':
        return 'M 50 10 C 68 10, 75 20, 74 35 C 73 50, 68 57, 70 65 C 72 75, 78 80, 76 95 C 74 110, 63 115, 50 115 C 37 115, 26 110, 24 95 C 22 80, 28 75, 30 65 C 32 57, 27 50, 26 35 C 25 20, 32 10, 50 10Z'
      case 'inverted_triangle':
        return 'M 50 10 C 72 10, 82 20, 80 35 C 78 50, 62 55, 60 65 C 58 75, 72 80, 70 95 C 68 110, 62 115, 50 115 C 38 115, 32 110, 30 95 C 28 80, 42 75, 40 65 C 38 55, 22 50, 20 35 C 18 20, 28 10, 50 10Z'
      default: // rectangle
        return 'M 50 10 C 68 10, 76 20, 74 35 C 72 50, 60 55, 60 65 C 60 75, 74 80, 72 95 C 70 110, 63 115, 50 115 C 37 115, 30 110, 28 95 C 26 80, 40 75, 40 65 C 40 55, 28 50, 26 35 C 24 20, 32 10, 50 10Z'
    }
  }

  const getZoneHighlight = () => {
    if (!highlightZone) return null
    const zoneRects: Record<string, { y: number; height: number; label: string }> = {
      chest:    { y: 12, height: 26, label: 'Bust / Chest' },
      waist:    { y: 50, height: 18, label: 'Waist' },
      hips:     { y: 68, height: 28, label: 'Hips' },
      shoulder: { y: 8,  height: 16, label: 'Shoulder Width' },
      inseam:   { y: 82, height: 33, label: 'Inseam' },
      arm:      { y: 20, height: 55, label: 'Arm Length' },
    }
    return zoneRects[highlightZone] || null
  }

  const highlight = getZoneHighlight()

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <svg
        viewBox="0 0 100 130"
        className="w-32 h-40"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body silhouette */}
        <path
          d={getSilhouettePath()}
          fill="#374151"
          stroke="#6B7280"
          strokeWidth="1"
          opacity={0.85}
        />

        {/* Zone highlight overlay */}
        {highlight && (
          <rect
            x="15"
            y={highlight.y}
            width="70"
            height={highlight.height}
            fill="#6366F1"
            opacity="0.35"
            rx="2"
          />
        )}

        {/* Measurement lines if labels shown */}
        {showLabels && !highlightZone && (
          <>
            {/* Shoulder line */}
            <line x1="20" y1="20" x2="80" y2="20" stroke="#6366F1" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6"/>
            {/* Chest line */}
            <line x1="18" y1="30" x2="82" y2="30" stroke="#6366F1" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6"/>
            {/* Waist line */}
            <line x1="22" y1="58" x2="78" y2="58" stroke="#6366F1" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6"/>
            {/* Hip line */}
            <line x1="18" y1="78" x2="82" y2="78" stroke="#6366F1" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6"/>
          </>
        )}
      </svg>

      {bodyType && (
        <div className="text-center">
          <div className="text-xs font-medium text-text-primary capitalize">
            {bodyType.replace('_', ' ')}
          </div>
          <div className="text-xs text-text-muted mt-0.5 max-w-[140px]">
            {BODY_TYPE_DESCRIPTIONS[bodyType]}
          </div>
        </div>
      )}
    </div>
  )
}

// Measurement guide diagram — shows where to measure each zone
export function MeasurementGuide({ activeField }: { activeField?: string }) {
  const guides: Record<string, { description: string; tips: string[] }> = {
    chest_cm: {
      description: 'Measure around the fullest part of your chest/bust.',
      tips: ['Keep the tape parallel to the ground', 'Breathe normally — don\'t hold your breath'],
    },
    waist_cm: {
      description: 'Measure around your natural waist — narrowest point.',
      tips: ['Usually 2–3cm above your belly button', 'Don\'t hold the tape too tight'],
    },
    hips_cm: {
      description: 'Measure around the fullest part of your hips and seat.',
      tips: ['Usually 20cm below your natural waist', 'Stand with feet together'],
    },
    shoulder_width_cm: {
      description: 'Measure across your back from shoulder point to shoulder point.',
      tips: ['Measure across the back, not the front', 'From the end of one shoulder to the other'],
    },
    inseam_cm: {
      description: 'Measure from your crotch to the floor along the inner leg.',
      tips: ['Stand straight with feet slightly apart', 'Best measured by someone else'],
    },
    height_cm: {
      description: 'Your full height without shoes.',
      tips: ['Stand against a wall, heels touching the wall', 'Look straight ahead'],
    },
  }

  const guide = activeField ? guides[activeField] : null

  if (!guide) return null

  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3 text-sm">
      <p className="text-text-primary font-medium">{guide.description}</p>
      <ul className="mt-1.5 space-y-1">
        {guide.tips.map((tip, i) => (
          <li key={i} className="text-text-muted flex items-start gap-1.5">
            <span className="text-accent-indigo mt-0.5">•</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  )
}
