'use client'

import Link from 'next/link'
import { Edit3, ShoppingBag, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BodyDiagram } from './BodyDiagram'
import type { Avatar } from '@/types/avatar'

interface AvatarCardProps {
  avatar: Avatar
  compact?: boolean
}

const BODY_TYPE_LABELS: Record<string, string> = {
  hourglass: 'Hourglass',
  pear: 'Pear',
  apple: 'Apple',
  rectangle: 'Rectangle',
  inverted_triangle: 'Inv. Triangle',
}

const FIT_PREF_LABELS: Record<string, string> = {
  fitted: 'Fitted',
  regular: 'Regular',
  relaxed: 'Relaxed',
  oversized: 'Oversized',
}

function MeasurementRow({ label, value, unit = 'cm' }: { label: string; value: number | null; unit?: string }) {
  if (value == null) return null
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-text-muted text-xs">{label}</span>
      <span className="text-text-primary text-xs font-medium tabular-nums">
        {value} {unit}
      </span>
    </div>
  )
}

export function AvatarCard({ avatar, compact = false }: AvatarCardProps) {
  const current = avatar.measurements.find(m => m.is_current) ?? avatar.measurements[0]

  if (compact) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 flex items-center gap-4">
        <div className="shrink-0">
          <BodyDiagram bodyType={avatar.body_type} showLabels={false} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary truncate">{avatar.name}</p>
          {avatar.body_type && (
            <p className="text-xs text-text-muted">{BODY_TYPE_LABELS[avatar.body_type]}</p>
          )}
          {current?.height_cm && (
            <p className="text-xs text-text-muted">{current.height_cm}cm</p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/avatar?edit=${avatar.id}`}>
              <Edit3 className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </Link>
          </Button>
          <Button size="sm" variant="indigo" asChild>
            <Link href="/dashboard/garments">
              <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
              Try on
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex gap-6">
        {/* Silhouette */}
        <div className="shrink-0 flex flex-col items-center gap-2">
          <BodyDiagram bodyType={avatar.body_type} showLabels={false} className="w-32" />
          {avatar.body_type && (
            <Badge variant="secondary" className="text-xs capitalize">
              {BODY_TYPE_LABELS[avatar.body_type] || avatar.body_type}
            </Badge>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{avatar.name}</h3>
              <p className="text-sm text-text-muted mt-0.5">
                {avatar.fit_preference?.preference
                  ? `${FIT_PREF_LABELS[avatar.fit_preference.preference] || avatar.fit_preference.preference} fit`
                  : 'Regular fit'
                }
                {avatar.fit_preference?.occasions?.length > 0 && (
                  <span> · {avatar.fit_preference.occasions.join(', ')}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/avatar?edit=${avatar.id}`}>
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  Edit
                </Link>
              </Button>
            </div>
          </div>

          {/* Measurements */}
          {current && (
            <div className="mt-4 grid grid-cols-2 gap-x-6 divide-y divide-border/50">
              <MeasurementRow label="Height" value={current.height_cm} />
              <MeasurementRow label="Chest" value={current.chest_cm} />
              <MeasurementRow label="Waist" value={current.waist_cm} />
              <MeasurementRow label="Hips" value={current.hips_cm} />
              <MeasurementRow label="Shoulder" value={current.shoulder_width_cm} />
              <MeasurementRow label="Inseam" value={current.inseam_cm} />
            </div>
          )}

          {/* Source badge */}
          {current?.measurement_source && (
            <div className="mt-3">
              <Badge variant="outline" className="text-xs capitalize">
                {current.measurement_source === 'photo_scan'
                  ? 'Photo scan'
                  : current.measurement_source === 'manual'
                  ? 'Manual entry'
                  : current.measurement_source}
              </Badge>
              {current.confidence_score != null && (
                <span className="ml-2 text-xs text-text-muted">
                  {Math.round(current.confidence_score * 100)}% confidence
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Try on garments to see personalised fit scores
        </p>
        <Button variant="indigo" size="sm" asChild>
          <Link href="/dashboard/garments">
            <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
            Try on garments →
          </Link>
        </Button>
      </div>
    </div>
  )
}
