'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { ImagePlus, X, CheckCircle2, AlertCircle, XCircle, GripVertical } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import type { UploadedPhoto } from '@/types'

interface PhotoDropzoneProps {
  photos: UploadedPhoto[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

const MIN_PHOTOS = 8
const RECOMMENDED_PHOTOS = 12

function QualityIcon({ quality }: { quality: UploadedPhoto['quality'] }) {
  switch (quality) {
    case 'good':
      return <CheckCircle2 className="w-4 h-4 text-success" />
    case 'warning':
      return <AlertCircle className="w-4 h-4 text-warning" />
    case 'unusable':
      return <XCircle className="w-4 h-4 text-error" />
  }
}

export function PhotoDropzone({ photos, onAdd, onRemove, onReorder }: PhotoDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onAdd(acceptedFiles)
  }, [onAdd])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    multiple: true,
  })

  const goodCount = photos.filter(p => p.quality === 'good').length
  const warningCount = photos.filter(p => p.quality === 'warning').length
  const unusableCount = photos.filter(p => p.quality === 'unusable').length
  const totalCount = photos.length

  const countColor = totalCount === 0
    ? 'text-text-muted'
    : totalCount < MIN_PHOTOS
      ? 'text-error'
      : totalCount < RECOMMENDED_PHOTOS
        ? 'text-warning'
        : 'text-success'

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer',
          isDragActive
            ? 'border-accent-indigo bg-accent-indigo/5'
            : 'border-border hover:border-border/80 hover:bg-surface-elevated/30'
        )}
      >
        <input {...getInputProps()} />
        <div className="p-10 flex flex-col items-center gap-3 text-center">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
            isDragActive ? 'bg-accent-indigo/20' : 'bg-surface-elevated'
          )}>
            <ImagePlus className={cn('w-6 h-6', isDragActive ? 'text-accent-indigo' : 'text-text-muted')} />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              {isDragActive ? 'Drop photos here' : 'Drop photos or click to browse'}
            </p>
            <p className="text-xs text-text-muted mt-1">JPEG, PNG, WebP — multiple files</p>
          </div>
        </div>
      </div>

      {/* Photo count indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-text-muted">
          {MIN_PHOTOS} minimum · {RECOMMENDED_PHOTOS} recommended
        </span>
        <span className="text-border">·</span>
        <span className={cn('font-medium', countColor)}>
          You have: {totalCount}
          {totalCount >= MIN_PHOTOS && ' ✓'}
        </span>
        {warningCount > 0 && (
          <>
            <span className="text-border">·</span>
            <span className="text-warning">{warningCount} low res</span>
          </>
        )}
        {unusableCount > 0 && (
          <>
            <span className="text-border">·</span>
            <span className="text-error">{unusableCount} unusable</span>
          </>
        )}
      </div>

      {/* Photo List */}
      <AnimatePresence>
        {photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2"
          >
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="relative group aspect-square rounded-lg overflow-hidden bg-surface-elevated border border-border"
              >
                {/* Photo preview */}
                <img
                  src={photo.previewUrl}
                  alt={`Photo ${index + 1}`}
                  className={cn(
                    'w-full h-full object-cover',
                    photo.quality === 'unusable' && 'opacity-40'
                  )}
                />

                {/* Upload progress overlay */}
                {!photo.uploaded && (
                  <div className="absolute inset-0 bg-background/60 flex items-end">
                    <div className="w-full h-1 bg-surface-elevated">
                      <motion.div
                        className="h-full bg-accent-indigo"
                        animate={{ width: `${photo.uploadProgress}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  </div>
                )}

                {/* Quality indicator */}
                <div className="absolute top-1 left-1">
                  <div className="w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <QualityIcon quality={photo.quality} />
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => onRemove(photo.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/80"
                  aria-label="Remove photo"
                >
                  <X className="w-3 h-3 text-white" />
                </button>

                {/* Quality reason tooltip */}
                {photo.qualityReason && (
                  <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[9px] text-text-secondary leading-tight">{photo.qualityReason}</p>
                  </div>
                )}

                {/* Drag handle */}
                <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-3 h-3 text-text-muted" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Angle Guide */}
      {photos.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-secondary mb-3">Recommended angles</p>
          <div className="grid grid-cols-4 gap-2">
            {['Front', 'Back', 'Left side', 'Right side', 'Detail 1', 'Detail 2', '¾ front', '¾ back'].map((angle, i) => (
              <div
                key={angle}
                className={cn(
                  'rounded-md p-2 text-center',
                  i < photos.length
                    ? 'bg-success/10 border border-success/20'
                    : 'bg-surface-elevated border border-border'
                )}
              >
                <span className={cn('text-[10px]', i < photos.length ? 'text-success' : 'text-text-muted')}>
                  {i < photos.length ? '✓' : '○'} {angle}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
