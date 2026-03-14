'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useGarment } from '@/hooks/useGarments'
import { Skeleton } from '@/components/ui/skeleton'

interface EditGarmentPageProps {
  params: Promise<{ ugi: string }>
}

export default function EditGarmentPage({ params }: EditGarmentPageProps) {
  const { ugi } = use(params)
  const { data: garment, isLoading } = useGarment(ugi)

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/dashboard/garments/${ugi}`}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {garment?.name ?? 'garment'}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Edit garment</h1>
        <p className="text-sm text-text-muted mt-1">
          Editing <span className="font-mono text-text-secondary">{ugi}</span>
        </p>
      </div>

      {/* Edit form — full implementation in V2 */}
      <div className="rounded-xl border border-border bg-surface p-6 text-center space-y-2">
        <p className="text-sm text-text-secondary">Full edit form coming in the next sprint.</p>
        <p className="text-xs text-text-muted">
          Garment details, fabric composition, and file replacement will be editable here.
        </p>
      </div>
    </div>
  )
}
