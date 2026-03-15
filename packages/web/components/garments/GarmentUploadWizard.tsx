'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  ChevronRight,
  ChevronLeft,
  Box,
  Grid3X3,
  Camera,
  Zap,
  FileUp,
  Shirt,
  Loader2,
  CheckCircle2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PhotoDropzone } from '@/components/upload/PhotoDropzone'
import { FabricCompositionInput } from './FabricCompositionInput'
import { useGarmentUpload } from '@/hooks/useGarmentUpload'
import { cn, CATEGORY_LABELS, formatBytes } from '@/lib/utils'
import type { GarmentCategory, GarmentSeason, UploadMethod, GarmentMeasurements, FabricPhysics } from '@/types'

// ---- Category Selector ----

const CATEGORIES: { key: GarmentCategory; emoji: string }[] = [
  { key: 'tops', emoji: '👕' },
  { key: 'bottoms', emoji: '👖' },
  { key: 'dresses', emoji: '👗' },
  { key: 'outerwear', emoji: '🧥' },
  { key: 'suits', emoji: '🤵' },
  { key: 'activewear', emoji: '🏃' },
  { key: 'swimwear', emoji: '👙' },
  { key: 'underwear', emoji: '🩲' },
  { key: 'accessories', emoji: '👜' },
  { key: 'footwear', emoji: '👟' },
  { key: 'other', emoji: '✨' },
]

const SEASONS: { key: GarmentSeason; label: string }[] = [
  { key: 'SS', label: 'SS' },
  { key: 'AW', label: 'AW' },
  { key: 'all-season', label: 'All Season' },
  { key: 'resort', label: 'Resort' },
]

const UPLOAD_METHODS: {
  key: UploadMethod
  icon: React.ReactNode
  title: string
  subtitle: string
  time: string
  badge?: string
}[] = [
  {
    key: 'clo3d',
    icon: <Box className="w-6 h-6" />,
    title: 'CLO3D or Marvelous Designer',
    subtitle: 'Most accurate — no photography needed',
    time: '~2 minutes',
    badge: 'Best quality',
  },
  {
    key: 'pattern',
    icon: <Grid3X3 className="w-6 h-6" />,
    title: 'Pattern files',
    subtitle: 'DXF, AI, AAMA — one file per piece',
    time: '~5 minutes',
  },
  {
    key: 'photos',
    icon: <Camera className="w-6 h-6" />,
    title: 'Upload photos',
    subtitle: '8–12 photos from different angles',
    time: '~10 minutes',
  },
  {
    key: 'measurements',
    icon: <Zap className="w-6 h-6" />,
    title: 'Quick add',
    subtitle: 'Measurements only — no files needed',
    time: '~3 minutes',
  },
]

// ---- Progress Indicator ----

interface WizardProgressProps {
  currentStep: number
  uploadMethod: UploadMethod | null
}

function WizardProgress({ currentStep, uploadMethod }: WizardProgressProps) {
  const steps = ['Basics', 'Method', uploadMethod ? methodLabel(uploadMethod) : 'Upload', 'Fabric', 'Review']

  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isActive = currentStep === stepNum
        const isComplete = currentStep > stepNum

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200',
                isComplete ? 'bg-success text-white' :
                isActive ? 'bg-accent-indigo text-white' :
                'bg-surface-elevated text-text-muted border border-border'
              )}>
                {isComplete ? '✓' : stepNum}
              </div>
              <span className={cn(
                'text-[10px] font-medium hidden sm:block',
                isActive ? 'text-text-primary' : 'text-text-muted'
              )}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                'h-px w-8 sm:w-12 mx-1 mb-4 transition-colors duration-200',
                currentStep > stepNum ? 'bg-success' : 'bg-border'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function methodLabel(method: UploadMethod): string {
  switch (method) {
    case 'clo3d': return 'CLO3D'
    case 'pattern': return 'Patterns'
    case 'photos': return 'Photos'
    case 'measurements': return 'Measurements'
  }
}

// ---- Step 1: Garment Basics ----

interface Step1Props {
  name: string
  category: GarmentCategory | null
  season?: GarmentSeason
  sku?: string
  description?: string
  onChange: (data: Partial<{ name: string; category: GarmentCategory; season: GarmentSeason; sku: string; description: string }>) => void
  onNext: () => void
}

function Step1({ name, category, season, sku, description, onChange, onNext }: Step1Props) {
  const isValid = name.trim().length > 0 && category !== null

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Tell us about the garment</h2>
        <p className="text-sm text-text-muted mt-1">The basics. Quick and easy.</p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Garment name <span className="text-error">*</span></Label>
        <Input
          id="name"
          value={name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="e.g. Oversized Linen Blazer"
          className="text-base"
          autoFocus
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category <span className="text-error">*</span></Label>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => onChange({ category: cat.key })}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150',
                category === cat.key
                  ? 'border-accent-indigo bg-accent-indigo/10 text-text-primary'
                  : 'border-border bg-surface hover:border-border/80 hover:bg-surface-elevated text-text-muted hover:text-text-secondary'
              )}
            >
              <span className="text-xl">{cat.emoji}</span>
              <span className="text-[10px] font-medium leading-tight text-center">{CATEGORY_LABELS[cat.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Season + SKU (optional) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Season <span className="text-text-muted font-normal">(optional)</span></Label>
          <div className="flex gap-2">
            {SEASONS.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => onChange({ season: season === s.key ? undefined : s.key })}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-150',
                  season === s.key
                    ? 'border-accent-indigo bg-accent-indigo/10 text-text-primary'
                    : 'border-border bg-surface text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU / Reference <span className="text-text-muted font-normal">(optional)</span></Label>
          <Input
            id="sku"
            value={sku ?? ''}
            onChange={e => onChange({ sku: e.target.value })}
            placeholder="e.g. BLZ-001"
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Brief description <span className="text-text-muted font-normal">(optional)</span></Label>
        <Textarea
          id="description"
          value={description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Short description for your reference..."
          className="min-h-[70px]"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!isValid} size="lg" className="gap-2">
          Continue
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  )
}

// ---- Step 2: Upload Method ----

interface Step2Props {
  onSelect: (method: UploadMethod) => void
  onBack: () => void
}

function Step2({ onSelect, onBack }: Step2Props) {
  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-text-primary">How would you like to add this garment?</h2>
        <p className="text-sm text-text-muted mt-1">All paths lead to a physics-accurate 3D model.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {UPLOAD_METHODS.map(method => (
          <button
            key={method.key}
            type="button"
            onClick={() => onSelect(method.key)}
            className="group relative flex flex-col gap-3 p-5 rounded-xl border border-border bg-surface hover:border-accent-indigo/50 hover:bg-surface-elevated text-left transition-all duration-150"
          >
            {method.badge && (
              <div className="absolute top-3 right-3">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-indigo/10 border border-accent-indigo/20 text-accent-indigo">
                  {method.badge}
                </span>
              </div>
            )}
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-150',
              'bg-surface-elevated text-text-muted group-hover:bg-accent-indigo/10 group-hover:text-accent-indigo'
            )}>
              {method.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{method.title}</p>
              <p className="text-xs text-text-muted mt-0.5">{method.subtitle}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">{method.time}</span>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-indigo transition-colors" />
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-start">
        <Button variant="ghost" onClick={onBack} size="sm" className="gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </Button>
      </div>
    </motion.div>
  )
}

// ---- Step 3A: CLO3D Upload ----

interface Step3AProps {
  file: File | null
  onFile: (file: File | null) => void
  onNext: () => void
  onBack: () => void
}

function Step3A({ file, onFile, onNext, onBack }: Step3AProps) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) onFile(accepted[0])
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.zprj', '.avt'] },
    maxFiles: 1,
  })

  return (
    <motion.div
      key="step3a"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Upload your CLO3D or Marvelous Designer file</h2>
        <p className="text-sm text-text-muted mt-1">We accept .zprj (CLO3D) and .avt (Marvelous Designer)</p>
      </div>

      {!file ? (
        <div
          {...getRootProps()}
          className={cn(
            'rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer',
            isDragActive
              ? 'border-accent-indigo bg-accent-indigo/5'
              : 'border-border hover:border-border/60 hover:bg-surface-elevated/30'
          )}
        >
          <input {...getInputProps()} />
          <div className="p-16 flex flex-col items-center gap-4 text-center">
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
              isDragActive ? 'bg-accent-indigo/20' : 'bg-surface-elevated'
            )}>
              <Upload className={cn('w-7 h-7', isDragActive ? 'text-accent-indigo' : 'text-text-muted')} />
            </div>
            <div>
              <p className="text-base font-medium text-text-primary">
                {isDragActive ? 'Drop your file here' : 'Drop your file here or click to browse'}
              </p>
              <p className="text-sm text-text-muted mt-1">.zprj or .avt</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-elevated p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-indigo/10 flex items-center justify-center">
            <FileUp className="w-5 h-5 text-accent-indigo" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
            <p className="text-xs text-text-muted">{formatBytes(file.size)}</p>
          </div>
          <button
            onClick={() => onFile(null)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-error hover:bg-error/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} size="sm" className="gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!file} size="lg" className="gap-2">
          Continue
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  )
}

// ---- Step 3B: Pattern Upload ----

interface Step3BProps {
  files: File[]
  onFiles: (files: File[]) => void
  onNext: () => void
  onBack: () => void
}

function Step3B({ files, onFiles, onNext, onBack }: Step3BProps) {
  const onDrop = useCallback((accepted: File[]) => {
    onFiles([...files, ...accepted])
  }, [files, onFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.dxf', '.aama'],
      'application/postscript': ['.ai'],
      'application/illustrator': ['.ai'],
    },
    multiple: true,
  })

  return (
    <motion.div
      key="step3b"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Upload your pattern files</h2>
        <p className="text-sm text-text-muted mt-1">One file per pattern piece is common — upload as many as you have.</p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer',
          isDragActive
            ? 'border-accent-indigo bg-accent-indigo/5'
            : 'border-border hover:border-border/60 hover:bg-surface-elevated/30'
        )}
      >
        <input {...getInputProps()} />
        <div className="p-10 flex flex-col items-center gap-3 text-center">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isDragActive ? 'bg-accent-indigo/20' : 'bg-surface-elevated'
          )}>
            <Upload className={cn('w-6 h-6', isDragActive ? 'text-accent-indigo' : 'text-text-muted')} />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Drop pattern files here</p>
            <p className="text-xs text-text-muted mt-0.5">.dxf, .ai, .aama — multiple files</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2">
              <FileUp className="w-4 h-4 text-text-muted shrink-0" />
              <span className="text-sm text-text-secondary truncate flex-1">{file.name}</span>
              <span className="text-xs text-text-muted">{formatBytes(file.size)}</span>
              <button
                onClick={() => onFiles(files.filter((_, fi) => fi !== i))}
                className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-error transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} size="sm" className="gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <Button onClick={onNext} disabled={files.length === 0} size="lg" className="gap-2">
          Continue
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  )
}

// ---- Step 3C: Photos ----

interface Step3CProps {
  photos: ReturnType<typeof useGarmentUpload>['state']['photos']
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onReorder: (from: number, to: number) => void
  onNext: () => void
  onBack: () => void
}

function Step3C({ photos, onAdd, onRemove, onReorder, onNext, onBack }: Step3CProps) {
  const hasEnough = photos.filter(p => p.quality !== 'unusable').length >= 1

  return (
    <motion.div
      key="step3c"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Upload photos</h2>
        <p className="text-sm text-text-muted mt-1">8 photos minimum, 12 recommended. More angles = better 3D model.</p>
      </div>

      <PhotoDropzone
        photos={photos}
        onAdd={onAdd}
        onRemove={onRemove}
        onReorder={onReorder}
      />

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} size="sm" className="gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!hasEnough} size="lg" className="gap-2">
          Continue
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  )
}

// ---- Step 3D: Measurements ----

interface Step3DProps {
  measurements: GarmentMeasurements
  onChange: (m: GarmentMeasurements) => void
  onNext: () => void
  onBack: () => void
}

const MEASUREMENT_FIELDS = [
  { key: 'chest' as const, label: 'Width at chest', unit: 'cm', placeholder: '92' },
  { key: 'waist' as const, label: 'Width at waist', unit: 'cm', placeholder: '78' },
  { key: 'hem' as const, label: 'Width at hem', unit: 'cm', placeholder: '102' },
  { key: 'sleeveLength' as const, label: 'Sleeve length', unit: 'cm', placeholder: '62' },
  { key: 'totalLength' as const, label: 'Total length', unit: 'cm', placeholder: '70' },
  { key: 'shoulderWidth' as const, label: 'Shoulder width', unit: 'cm', placeholder: '44' },
]

function Step3D({ measurements, onChange, onNext, onBack }: Step3DProps) {
  const hasAny = Object.values(measurements).some(v => v !== undefined && v !== '' && v !== null)

  return (
    <motion.div
      key="step3d"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Enter measurements</h2>
        <p className="text-sm text-text-muted mt-1">Add what you have. All fields are optional.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {MEASUREMENT_FIELDS.map(field => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={field.key}>{field.label}</Label>
            <div className="relative">
              <Input
                id={field.key}
                type="number"
                step="0.1"
                value={measurements[field.key] ?? ''}
                onChange={e => onChange({
                  ...measurements,
                  [field.key]: e.target.value ? parseFloat(e.target.value) : undefined,
                })}
                placeholder={field.placeholder}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">{field.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Additional notes</Label>
        <Textarea
          id="notes"
          value={measurements.notes ?? ''}
          onChange={e => onChange({ ...measurements, notes: e.target.value })}
          placeholder="Stretch factor, construction notes, fit details..."
          className="min-h-[80px]"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} size="sm" className="gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!hasAny} size="lg" className="gap-2">
          Continue
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  )
}

// ---- Step 4: Fabric Composition ----

interface Step4Props {
  composition: string
  physics: FabricPhysics | null
  onChange: (v: string) => void
  onPhysics: (p: FabricPhysics | null) => void
  onNext: () => void
  onBack: () => void
}

function Step4({ composition, physics, onChange, onPhysics, onNext, onBack }: Step4Props) {
  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Fabric composition</h2>
        <p className="text-sm text-text-muted mt-1">This unlocks physics-accurate simulation — how your garment moves, drapes, and stretches.</p>
      </div>

      <FabricCompositionInput
        value={composition}
        onChange={onChange}
        onPhysicsChange={onPhysics}
        physics={physics}
      />

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} size="sm" className="gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onNext} size="sm" className="text-text-muted">
            Skip
          </Button>
          <Button onClick={onNext} size="lg" className="gap-2">
            Continue
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ---- Step 5: Review & Submit ----

interface Step5Props {
  state: ReturnType<typeof useGarmentUpload>['state']
  isSubmitting: boolean
  error: string | null
  onSubmit: () => void
  onBack: () => void
}

function Step5({ state, isSubmitting, error, onSubmit, onBack }: Step5Props) {
  const { step1, uploadMethod, clo3dFile, patternFiles, photos, measurements, fabricComposition } = state

  const methodLabels: Record<string, string> = {
    clo3d: 'CLO3D / Marvelous Designer file',
    pattern: `${patternFiles.length} pattern file${patternFiles.length !== 1 ? 's' : ''}`,
    photos: `${photos.length} photo${photos.length !== 1 ? 's' : ''}`,
    measurements: 'Manual measurements',
  }

  return (
    <motion.div
      key="step5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Ready to create</h2>
        <p className="text-sm text-text-muted mt-1">Review your garment before we process it.</p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border bg-surface divide-y divide-border">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-text-muted">Name</span>
          <span className="text-sm font-medium text-text-primary">{step1.name}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-text-muted">Category</span>
          <span className="text-sm text-text-secondary">{step1.category ? CATEGORY_LABELS[step1.category] : '—'}</span>
        </div>
        {step1.season && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-text-muted">Season</span>
            <span className="text-sm text-text-secondary">{step1.season}</span>
          </div>
        )}
        {step1.sku && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-text-muted">SKU</span>
            <span className="text-sm text-text-secondary font-mono">{step1.sku}</span>
          </div>
        )}
        {uploadMethod && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-text-muted">Upload method</span>
            <span className="text-sm text-text-secondary">{methodLabels[uploadMethod]}</span>
          </div>
        )}
        {fabricComposition && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-text-muted">Fabric</span>
            <span className="text-sm text-text-secondary">{fabricComposition}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} size="sm" className="gap-1.5" disabled={isSubmitting}>
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          size="xl"
          className="gap-2 min-w-[180px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Create Garment
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

// ---- Success State ----

interface SuccessProps {
  ugi: string
  onViewGarment: () => void
  onAddAnother: () => void
}

function SuccessState({ ugi, onViewGarment, onAddAnother }: SuccessProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-center py-8 gap-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center"
      >
        <CheckCircle2 className="w-8 h-8 text-success" />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-text-primary">Garment created</h2>
        <p className="text-sm text-text-muted">Your garment is now processing. We'll build the 3D model shortly.</p>
      </div>

      {/* UGI Display */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-accent-indigo/30 bg-accent-indigo/5 px-6 py-4 space-y-1"
      >
        <p className="text-xs text-text-muted uppercase tracking-widest">Universal Garment Identifier</p>
        <p className="text-2xl font-bold font-mono tracking-widest text-accent-indigo">{ugi}</p>
        <p className="text-xs text-text-muted">This is your garment's permanent digital identity.</p>
      </motion.div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onAddAnother} size="lg">
          Add another
        </Button>
        <Button onClick={onViewGarment} size="lg" className="gap-2">
          <Shirt className="w-4 h-4" />
          View garment
        </Button>
      </div>
    </motion.div>
  )
}

// ---- Main Wizard ----

export function GarmentUploadWizard() {
  const router = useRouter()
  const upload = useGarmentUpload()
  const { state, isSubmitting, submittedUGI, error } = upload

  const handleSubmit = async () => {
    await upload.submit()
  }

  const handleViewGarment = () => {
    if (submittedUGI) {
      router.push(`/dashboard/garments/${submittedUGI}`)
    }
  }

  const handleAddAnother = () => {
    upload.reset()
  }

  // If submitted successfully, show success state
  if (submittedUGI) {
    return (
      <div className="max-w-2xl mx-auto">
        <SuccessState
          ugi={submittedUGI}
          onViewGarment={handleViewGarment}
          onAddAnother={handleAddAnother}
        />
      </div>
    )
  }

  const effectiveStep = state.step
  const isStep3 = effectiveStep === 3

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-8 flex justify-center">
        <WizardProgress currentStep={effectiveStep} uploadMethod={state.uploadMethod} />
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {effectiveStep === 1 && (
            <Step1
              name={state.step1.name}
              category={state.step1.category}
              season={state.step1.season}
              sku={state.step1.sku}
              description={state.step1.description}
              onChange={upload.updateStep1}
              onNext={() => upload.goToStep(2)}
            />
          )}

          {effectiveStep === 2 && (
            <Step2
              onSelect={upload.setUploadMethod}
              onBack={() => upload.goToStep(1)}
            />
          )}

          {isStep3 && state.uploadMethod === 'clo3d' && (
            <Step3A
              file={state.clo3dFile}
              onFile={upload.setClo3dFile}
              onNext={() => upload.goToStep(4)}
              onBack={() => upload.goToStep(2)}
            />
          )}

          {isStep3 && state.uploadMethod === 'pattern' && (
            <Step3B
              files={state.patternFiles}
              onFiles={upload.setPatternFiles}
              onNext={() => upload.goToStep(4)}
              onBack={() => upload.goToStep(2)}
            />
          )}

          {isStep3 && state.uploadMethod === 'photos' && (
            <Step3C
              photos={state.photos}
              onAdd={upload.addPhotos}
              onRemove={upload.removePhoto}
              onReorder={upload.reorderPhotos}
              onNext={() => upload.goToStep(4)}
              onBack={() => upload.goToStep(2)}
            />
          )}

          {isStep3 && state.uploadMethod === 'measurements' && (
            <Step3D
              measurements={state.measurements}
              onChange={upload.setMeasurements}
              onNext={() => upload.goToStep(4)}
              onBack={() => upload.goToStep(2)}
            />
          )}

          {effectiveStep === 4 && (
            <Step4
              composition={state.fabricComposition}
              physics={state.fabricPhysics}
              onChange={upload.setFabricComposition}
              onPhysics={upload.setFabricPhysics}
              onNext={() => upload.goToStep(5)}
              onBack={() => upload.goToStep(state.uploadMethod ? 3 : 2)}
            />
          )}

          {effectiveStep === 5 && (
            <Step5
              state={state}
              isSubmitting={isSubmitting}
              error={error}
              onSubmit={handleSubmit}
              onBack={() => upload.goToStep(4)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
