'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  Loader2,
  Upload,
  ShoppingBag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BodyDiagram, MeasurementGuide } from './BodyDiagram'
import { AvatarCard } from './AvatarCard'
import { createAvatarFromMeasurements, scanPhotos } from '@/hooks/useAvatar'
import type {
  AvatarBuilderState,
  AvatarMeasurements,
  BodyType,
  FitPreference,
  MeasurementMethod,
} from '@/types/avatar'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types / constants
// ---------------------------------------------------------------------------

const STEPS = [
  { n: 1, label: 'Method' },
  { n: 2, label: 'Measurements' },
  { n: 3, label: 'Body Type' },
  { n: 4, label: 'Preferences' },
  { n: 5, label: 'Done' },
]

const FIT_OPTIONS: { value: FitPreference; label: string; desc: string }[] = [
  { value: 'fitted',   label: 'Fitted',   desc: 'Close to the body, minimal ease' },
  { value: 'regular',  label: 'Regular',  desc: 'True to size, comfortable movement' },
  { value: 'relaxed',  label: 'Relaxed',  desc: 'Comfortable with extra room' },
  { value: 'oversized',label: 'Oversized',desc: 'Intentionally loose, contemporary' },
]

const OCCASION_OPTIONS = [
  { value: 'work',      label: 'Work' },
  { value: 'casual',    label: 'Casual' },
  { value: 'going_out', label: 'Going out' },
  { value: 'all',       label: 'Everything' },
]

const BODY_TYPE_LABELS: Record<BodyType, string> = {
  hourglass:         'Hourglass',
  pear:              'Pear',
  apple:             'Apple',
  rectangle:         'Rectangle',
  inverted_triangle: 'Inverted Triangle',
}

// ---------------------------------------------------------------------------
// AU standard size reference
// ---------------------------------------------------------------------------

const AU_SIZE_CHART: Record<string, { chest: number; waist: number; hips: number }> = {
  '6':  { chest: 80,  waist: 62,  hips: 86  },
  '8':  { chest: 84,  waist: 66,  hips: 90  },
  '10': { chest: 88,  waist: 70,  hips: 94  },
  '12': { chest: 92,  waist: 74,  hips: 98  },
  '14': { chest: 96,  waist: 78,  hips: 102 },
  '16': { chest: 100, waist: 82,  hips: 106 },
  '18': { chest: 104, waist: 86,  hips: 110 },
  '20': { chest: 108, waist: 90,  hips: 114 },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.n} className="flex items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
              current > step.n
                ? 'bg-accent-indigo text-white'
                : current === step.n
                ? 'bg-white text-[#0A0A0A] ring-2 ring-accent-indigo'
                : 'bg-surface-elevated text-text-muted'
            )}
          >
            {current > step.n ? <Check className="w-3.5 h-3.5" /> : step.n}
          </div>
          <span
            className={cn(
              'text-xs hidden sm:block',
              current === step.n ? 'text-text-primary font-medium' : 'text-text-muted'
            )}
          >
            {step.label}
          </span>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'h-px w-6 transition-colors',
                current > step.n ? 'bg-accent-indigo' : 'bg-border'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function MeasurementField({
  id,
  label,
  value,
  onChange,
  onFocus,
  required = false,
  placeholder,
}: {
  id: keyof AvatarMeasurements
  label: string
  value: string
  onChange: (val: string) => void
  onFocus?: () => void
  required?: boolean
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
        <span className="ml-1 text-text-muted font-normal">cm</span>
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        step="0.5"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder || '—'}
        className="font-mono"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

interface AvatarBuilderWizardProps {
  onComplete?: (avatarId: string) => void
}

export function AvatarBuilderWizard({ onComplete }: AvatarBuilderWizardProps) {
  const [state, setState] = useState<AvatarBuilderState>({
    step: 1,
    method: null,
    measurements: {},
    bodyType: null,
    fitPreference: 'regular',
    occasions: [],
    photoConfidence: null,
    photoWarnings: [],
    avatarName: 'My Avatar',
    savedAvatar: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeField, setActiveField] = useState<string | undefined>()
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null)
  const [sidePhoto, setSidePhoto] = useState<File | null>(null)
  const [photoHeight, setPhotoHeight] = useState('')
  const [tempAvatarId, setTempAvatarId] = useState<string | null>(null)

  const update = (partial: Partial<AvatarBuilderState>) =>
    setState(s => ({ ...s, ...partial }))

  // Measurement fields helper
  const mVal = (key: keyof AvatarMeasurements) => {
    const v = state.measurements[key]
    return v != null ? String(v) : ''
  }
  const setM = (key: keyof AvatarMeasurements, val: string) => {
    const n = parseFloat(val)
    update({
      measurements: {
        ...state.measurements,
        [key]: val === '' || isNaN(n) ? undefined : n,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------

  const handlePhotoScan = async () => {
    if (!frontPhoto || !sidePhoto || !photoHeight) return
    const hcm = parseFloat(photoHeight)
    if (isNaN(hcm) || hcm < 50 || hcm > 300) {
      setError('Please enter a valid height (cm)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create a temporary avatar to attach the scan to
      const tempAvatar = await createAvatarFromMeasurements({
        name: state.avatarName,
        measurements: { height_cm: hcm, measurement_source: 'photo_scan' },
        fitPreference: state.fitPreference,
        occasions: state.occasions,
      })
      setTempAvatarId(tempAvatar.id)

      // Run photo scan
      const scanResult = await scanPhotos({
        avatarId: tempAvatar.id,
        frontPhoto,
        sidePhoto,
        heightCm: hcm,
      })

      if (scanResult.fallback_required) {
        setError(scanResult.error || 'Photo scan not available. Please enter measurements manually.')
        update({ method: 'manual', step: 2 })
        return
      }

      // Populate measurements from scan
      const scannedM: Partial<AvatarMeasurements> = {
        ...scanResult.measurements,
        height_cm: hcm,
        measurement_source: 'photo_scan',
        confidence_score: scanResult.overall_confidence,
      } as Partial<AvatarMeasurements>

      update({
        measurements: scannedM,
        bodyType: scanResult.body_type,
        photoConfidence: scanResult.overall_confidence,
        photoWarnings: scanResult.warnings,
        step: 3,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo scan failed')
    } finally {
      setLoading(false)
    }
  }

  const handleManualNext = () => {
    const m = state.measurements
    if (!m.height_cm) {
      setError('Height is required')
      return
    }
    setError(null)

    // Classify body type from measurements
    let bodyType: BodyType | null = null
    if (m.chest_cm && m.waist_cm && m.hips_cm) {
      const waistToChest = m.waist_cm / m.chest_cm
      const waistToHips = m.waist_cm / m.hips_cm
      const hipToChest = m.hips_cm / m.chest_cm

      if (waistToChest < 0.75 && waistToHips < 0.75 && Math.abs(hipToChest - 1.0) < 0.08) {
        bodyType = 'hourglass'
      } else if (hipToChest > 1.10 && waistToHips < 0.85) {
        bodyType = 'pear'
      } else if (waistToChest > 0.88 && waistToHips > 0.88) {
        bodyType = 'apple'
      } else if (hipToChest < 0.90) {
        bodyType = 'inverted_triangle'
      } else {
        bodyType = 'rectangle'
      }
    }

    update({ bodyType, step: 3 })
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    try {
      const avatar = await createAvatarFromMeasurements({
        name: state.avatarName,
        measurements: {
          ...state.measurements,
          measurement_source: state.method === 'photos' ? 'photo_scan' : 'manual',
        } as Partial<AvatarMeasurements> as AvatarMeasurements,
        fitPreference: state.fitPreference,
        occasions: state.occasions,
      })

      update({ savedAvatar: avatar, step: 5 })
      onComplete?.(avatar.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save avatar')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Step renders
  // ---------------------------------------------------------------------------

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return <Step1ChooseMethod state={state} update={update} />
      case 2:
        return state.method === 'manual' ? (
          <Step2aManual
            state={state}
            mVal={mVal}
            setM={setM}
            activeField={activeField}
            setActiveField={setActiveField}
            error={error}
            onNext={handleManualNext}
            onBack={() => update({ step: 1 })}
          />
        ) : (
          <Step2bPhotos
            state={state}
            frontPhoto={frontPhoto}
            sidePhoto={sidePhoto}
            photoHeight={photoHeight}
            loading={loading}
            error={error}
            setFrontPhoto={setFrontPhoto}
            setSidePhoto={setSidePhoto}
            setPhotoHeight={setPhotoHeight}
            onScan={handlePhotoScan}
            onBack={() => update({ step: 1 })}
          />
        )
      case 3:
        return (
          <Step3BodyType
            state={state}
            update={update}
            mVal={mVal}
            setM={setM}
            onNext={() => update({ step: 4 })}
            onBack={() => update({ step: 2 })}
          />
        )
      case 4:
        return (
          <Step4Preferences
            state={state}
            update={update}
            loading={loading}
            error={error}
            onSave={handleSave}
            onBack={() => update({ step: 3 })}
          />
        )
      case 5:
        return state.savedAvatar ? (
          <Step5Done avatar={state.savedAvatar} />
        ) : null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator current={state.step} />
      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Choose method
// ---------------------------------------------------------------------------

function Step1ChooseMethod({
  state,
  update,
}: {
  state: AvatarBuilderState
  update: (p: Partial<AvatarBuilderState>) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">Create your avatar</h2>
        <p className="text-text-muted mt-1">
          How would you like to capture your measurements?
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => update({ method: 'manual', step: 2 })}
          className="group rounded-xl border border-border bg-surface p-6 text-left hover:border-accent-indigo transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center mb-4 group-hover:bg-accent-indigo/10 transition-colors">
            <ClipboardList className="w-5 h-5 text-text-secondary group-hover:text-accent-indigo" />
          </div>
          <h3 className="font-semibold text-text-primary">Enter measurements</h3>
          <p className="text-sm text-text-muted mt-1">
            Type in your measurements with a tape measure. Most accurate method.
          </p>
          <div className="mt-3 flex items-center text-xs text-accent-indigo font-medium">
            Start measuring <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </button>

        <button
          onClick={() => update({ method: 'photos', step: 2 })}
          className="group rounded-xl border border-border bg-surface p-6 text-left hover:border-accent-indigo transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center mb-4 group-hover:bg-accent-indigo/10 transition-colors">
            <Camera className="w-5 h-5 text-text-secondary group-hover:text-accent-indigo" />
          </div>
          <h3 className="font-semibold text-text-primary">Upload photos</h3>
          <p className="text-sm text-text-muted mt-1">
            Upload 2 photos — we extract measurements using pose estimation.
          </p>
          <div className="mt-3 flex items-center text-xs text-accent-indigo font-medium">
            Upload photos <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2a: Manual measurement form
// ---------------------------------------------------------------------------

function Step2aManual({
  state,
  mVal,
  setM,
  activeField,
  setActiveField,
  error,
  onNext,
  onBack,
}: {
  state: AvatarBuilderState
  mVal: (k: keyof AvatarMeasurements) => string
  setM: (k: keyof AvatarMeasurements, v: string) => void
  activeField: string | undefined
  setActiveField: (f: string | undefined) => void
  error: string | null
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">Your measurements</h2>
        <p className="text-text-muted mt-1">
          Enter your body measurements below. Height is required.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_140px] gap-6">
        <div className="space-y-4">
          {/* Required */}
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Required</p>
            <div className="grid grid-cols-2 gap-3">
              <MeasurementField id="height_cm" label="Height" value={mVal('height_cm')} onChange={v => setM('height_cm', v)} onFocus={() => setActiveField('height_cm')} required placeholder="e.g. 168" />
              <MeasurementField id="weight_kg" label="Weight" value={mVal('weight_kg')} onChange={v => setM('weight_kg', v)} onFocus={() => setActiveField(undefined)} placeholder="optional, kg" />
            </div>
          </div>

          {/* Circumference */}
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Circumference</p>
            <div className="grid grid-cols-2 gap-3">
              <MeasurementField id="chest_cm" label="Bust / Chest" value={mVal('chest_cm')} onChange={v => setM('chest_cm', v)} onFocus={() => setActiveField('chest_cm')} placeholder="e.g. 88" />
              <MeasurementField id="waist_cm" label="Waist" value={mVal('waist_cm')} onChange={v => setM('waist_cm', v)} onFocus={() => setActiveField('waist_cm')} placeholder="e.g. 70" />
              <MeasurementField id="hips_cm" label="Hips" value={mVal('hips_cm')} onChange={v => setM('hips_cm', v)} onFocus={() => setActiveField('hips_cm')} placeholder="e.g. 96" />
              <MeasurementField id="shoulder_width_cm" label="Shoulder width" value={mVal('shoulder_width_cm')} onChange={v => setM('shoulder_width_cm', v)} onFocus={() => setActiveField('shoulder_width_cm')} placeholder="e.g. 42" />
            </div>
          </div>

          {/* Length */}
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Length</p>
            <div className="grid grid-cols-2 gap-3">
              <MeasurementField id="inseam_cm" label="Inseam" value={mVal('inseam_cm')} onChange={v => setM('inseam_cm', v)} onFocus={() => setActiveField('inseam_cm')} placeholder="e.g. 78" />
              <MeasurementField id="arm_length_cm" label="Arm length" value={mVal('arm_length_cm')} onChange={v => setM('arm_length_cm', v)} onFocus={() => setActiveField('arm')} placeholder="optional" />
            </div>
          </div>

          {/* AU size reference */}
          <details className="group">
            <summary className="text-xs text-accent-indigo cursor-pointer hover:underline list-none flex items-center gap-1">
              <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
              AU standard size reference
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 pr-3 text-left text-text-muted font-medium">Size</th>
                    <th className="py-1 pr-3 text-right text-text-muted font-medium">Chest</th>
                    <th className="py-1 pr-3 text-right text-text-muted font-medium">Waist</th>
                    <th className="py-1 text-right text-text-muted font-medium">Hips</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(AU_SIZE_CHART).map(([size, vals]) => (
                    <tr key={size} className="border-b border-border/50">
                      <td className="py-1 pr-3 font-semibold text-text-primary">{size}</td>
                      <td className="py-1 pr-3 text-right tabular-nums text-text-secondary">{vals.chest}</td>
                      <td className="py-1 pr-3 text-right tabular-nums text-text-secondary">{vals.waist}</td>
                      <td className="py-1 text-right tabular-nums text-text-secondary">{vals.hips}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        {/* Diagram + guide */}
        <div className="flex flex-col items-center gap-4">
          <BodyDiagram
            highlightZone={activeField?.replace('_cm', '')}
            showLabels={!activeField}
          />
          {activeField && <MeasurementGuide activeField={activeField} />}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button variant="indigo" onClick={onNext}>
          Continue <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2b: Photo upload
// ---------------------------------------------------------------------------

function Step2bPhotos({
  state,
  frontPhoto,
  sidePhoto,
  photoHeight,
  loading,
  error,
  setFrontPhoto,
  setSidePhoto,
  setPhotoHeight,
  onScan,
  onBack,
}: {
  state: AvatarBuilderState
  frontPhoto: File | null
  sidePhoto: File | null
  photoHeight: string
  loading: boolean
  error: string | null
  setFrontPhoto: (f: File | null) => void
  setSidePhoto: (f: File | null) => void
  setPhotoHeight: (h: string) => void
  onScan: () => void
  onBack: () => void
}) {
  const frontRef = useRef<HTMLInputElement>(null)
  const sideRef = useRef<HTMLInputElement>(null)

  const PhotoSlot = ({
    label,
    file,
    onFile,
    inputRef,
    hint,
  }: {
    label: string
    file: File | null
    onFile: (f: File | null) => void
    inputRef: React.RefObject<HTMLInputElement>
    hint: string
  }) => (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => onFile(e.target.files?.[0] ?? null)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className={cn(
          'w-full rounded-xl border-2 border-dashed p-6 text-center transition-colors',
          file
            ? 'border-accent-indigo bg-accent-indigo/5'
            : 'border-border hover:border-accent-indigo/50'
        )}
      >
        {file ? (
          <div className="space-y-1">
            <Check className="w-6 h-6 text-accent-indigo mx-auto" />
            <p className="text-sm font-medium text-text-primary">{file.name}</p>
            <p className="text-xs text-text-muted">Click to replace</p>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload className="w-6 h-6 text-text-muted mx-auto" />
            <p className="text-sm font-medium text-text-primary">{label}</p>
            <p className="text-xs text-text-muted">{hint}</p>
          </div>
        )}
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">Upload photos</h2>
        <p className="text-text-muted mt-1">
          Two photos — front and side. Good lighting, full body visible.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <PhotoSlot
          label="Front photo"
          file={frontPhoto}
          onFile={setFrontPhoto}
          inputRef={frontRef}
          hint="Face the camera, arms at sides"
        />
        <PhotoSlot
          label="Side photo"
          file={sidePhoto}
          onFile={setSidePhoto}
          inputRef={sideRef}
          hint="Stand sideways, arms at sides"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="photo-height">
          Your height <span className="text-red-400">*</span>
          <span className="ml-1 text-text-muted font-normal">cm — required for calibration</span>
        </Label>
        <Input
          id="photo-height"
          type="number"
          min={50}
          max={300}
          value={photoHeight}
          onChange={e => setPhotoHeight(e.target.value)}
          placeholder="e.g. 168"
          className="max-w-[160px] font-mono"
        />
      </div>

      <div className="rounded-lg border border-border bg-surface-elevated p-3 text-sm space-y-1">
        <p className="font-medium text-text-primary">Tips for best results</p>
        <ul className="text-text-muted space-y-0.5 text-xs">
          <li>• Wear form-fitting clothes (no loose layers)</li>
          <li>• Stand against a plain background</li>
          <li>• Good, even lighting — no shadows</li>
          <li>• Full body must be visible head to toe</li>
        </ul>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analysing photos — extracting measurements...
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          variant="indigo"
          onClick={onScan}
          disabled={loading || !frontPhoto || !sidePhoto || !photoHeight}
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Extract measurements <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Body type result + measurement review
// ---------------------------------------------------------------------------

function Step3BodyType({
  state,
  update,
  mVal,
  setM,
  onNext,
  onBack,
}: {
  state: AvatarBuilderState
  update: (p: Partial<AvatarBuilderState>) => void
  mVal: (k: keyof AvatarMeasurements) => string
  setM: (k: keyof AvatarMeasurements, v: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">Your body profile</h2>
        <p className="text-text-muted mt-1">
          Review and adjust your measurements. You can override any value.
        </p>
      </div>

      <div className="flex gap-6">
        <div className="shrink-0">
          <BodyDiagram bodyType={state.bodyType} showLabels className="w-36" />
        </div>

        <div className="flex-1 grid grid-cols-2 gap-3">
          <MeasurementField id="height_cm" label="Height" value={mVal('height_cm')} onChange={v => setM('height_cm', v)} required />
          <MeasurementField id="chest_cm" label="Bust / Chest" value={mVal('chest_cm')} onChange={v => setM('chest_cm', v)} />
          <MeasurementField id="waist_cm" label="Waist" value={mVal('waist_cm')} onChange={v => setM('waist_cm', v)} />
          <MeasurementField id="hips_cm" label="Hips" value={mVal('hips_cm')} onChange={v => setM('hips_cm', v)} />
          <MeasurementField id="shoulder_width_cm" label="Shoulder" value={mVal('shoulder_width_cm')} onChange={v => setM('shoulder_width_cm', v)} />
          <MeasurementField id="inseam_cm" label="Inseam" value={mVal('inseam_cm')} onChange={v => setM('inseam_cm', v)} />
        </div>
      </div>

      {state.photoWarnings.length > 0 && (
        <div className="space-y-1.5">
          {state.photoWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {state.photoConfidence != null && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-text-muted">
            <span>Extraction confidence</span>
            <span>{Math.round(state.photoConfidence * 100)}%</span>
          </div>
          <Progress value={state.photoConfidence * 100} className="h-1.5" />
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button variant="indigo" onClick={onNext}>
          Continue <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Fit preferences
// ---------------------------------------------------------------------------

function Step4Preferences({
  state,
  update,
  loading,
  error,
  onSave,
  onBack,
}: {
  state: AvatarBuilderState
  update: (p: Partial<AvatarBuilderState>) => void
  loading: boolean
  error: string | null
  onSave: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">How do you like clothes to fit?</h2>
        <p className="text-text-muted mt-1">
          This shapes your size recommendations across all garments.
        </p>
      </div>

      {/* Fit preference */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Fit preference</p>
        <div className="grid grid-cols-2 gap-3">
          {FIT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update({ fitPreference: opt.value })}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                state.fitPreference === opt.value
                  ? 'border-accent-indigo bg-accent-indigo/5'
                  : 'border-border hover:border-accent-indigo/40'
              )}
            >
              <p className="font-medium text-text-primary text-sm">{opt.label}</p>
              <p className="text-xs text-text-muted mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Occasions */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-primary">What occasions do you mainly shop for?</p>
        <div className="flex flex-wrap gap-2">
          {OCCASION_OPTIONS.map(opt => {
            const active = state.occasions.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => {
                  const next = active
                    ? state.occasions.filter(o => o !== opt.value)
                    : [...state.occasions, opt.value]
                  update({ occasions: next })
                }}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm border transition-colors',
                  active
                    ? 'border-accent-indigo bg-accent-indigo text-white'
                    : 'border-border text-text-secondary hover:border-accent-indigo/40'
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Avatar name */}
      <div className="space-y-1.5">
        <Label htmlFor="avatar-name">Name your avatar</Label>
        <Input
          id="avatar-name"
          value={state.avatarName}
          onChange={e => update({ avatarName: e.target.value })}
          placeholder="e.g. My Avatar"
          className="max-w-xs"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button variant="indigo" onClick={onSave} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          Create avatar
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5: Done
// ---------------------------------------------------------------------------

function Step5Done({ avatar }: { avatar: NonNullable<AvatarBuilderState['savedAvatar']> }) {
  return (
    <div className="space-y-6 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-16 h-16 rounded-full bg-accent-indigo flex items-center justify-center mx-auto"
      >
        <Check className="w-8 h-8 text-white" />
      </motion.div>

      <div>
        <h2 className="text-2xl font-semibold text-text-primary">Your avatar is ready</h2>
        <p className="text-text-muted mt-1">
          {avatar.name} is set up and ready for personalised fit scoring.
        </p>
      </div>

      <div className="text-left">
        <AvatarCard avatar={avatar} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="indigo" size="lg" asChild>
          <a href="/dashboard/garments">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Try on garments →
          </a>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <a href="/dashboard/avatar">
            Back to avatar
          </a>
        </Button>
      </div>
    </div>
  )
}
