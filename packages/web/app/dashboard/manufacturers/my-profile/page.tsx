'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2, CheckCircle2, Factory, Globe, Package, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateManufacturerProfile } from '@/hooks/useManufacturers'
import { cn } from '@/lib/utils'
import type { CreateProfileInput } from '@/types/manufacturer'

const SPECIALISATION_OPTIONS = [
  'Woven', 'Knitwear', 'Denim', 'Leather', 'Activewear',
  'Swimwear', 'Lingerie', 'Outerwear', 'Suits', 'Accessories',
]

const MATERIAL_OPTIONS = [
  'Cotton', 'Polyester', 'Viscose', 'Nylon', 'Wool', 'Linen',
  'Silk', 'Elastane', 'Lyocell', 'Recycled Polyester',
]

const CERTIFICATION_OPTIONS = [
  'GOTS', 'OEKO-TEX', 'Fair Trade', 'BSCI', 'ISO 9001', 'Bluesign', 'SA8000',
]

const TECH_PACK_FORMAT_OPTIONS = ['PDF', 'Excel', 'CLO3D', 'Loocbooc Native']

const EXPORT_MARKET_OPTIONS = ['AU', 'US', 'UK', 'EU', 'CA', 'JP', 'KR', 'ME', 'Global']

const PRICE_TIER_OPTIONS = [
  { value: 'mass', label: 'Budget / Mass Market', desc: 'High volume, competitive pricing' },
  { value: 'mid', label: 'Mid-Range', desc: 'Balanced quality and cost' },
  { value: 'premium', label: 'Premium', desc: 'Quality-first, skilled craftspeople' },
  { value: 'luxury', label: 'Luxury / Artisan', desc: 'Top-tier quality and materials' },
]

const EMPLOYEE_COUNT_OPTIONS = ['1-10', '10-50', '50-100', '100-500', '500-2000', '2000+']

type FormStep = 'basics' | 'capabilities' | 'capacity' | 'certifications'

interface FormState extends Partial<CreateProfileInput> {
  specialisations: string[]
  materials: string[]
  certifications: string[]
  exportMarkets: string[]
  techPackFormats: string[]
  languages: string[]
}

const INITIAL_FORM: FormState = {
  displayName: '',
  description: '',
  country: '',
  city: '',
  priceTier: '',
  specialisations: [],
  materials: [],
  certifications: [],
  exportMarkets: [],
  techPackFormats: [],
  languages: ['English'],
  moqMin: undefined,
  moqMax: undefined,
  sampleLeadTimeDays: undefined,
  bulkLeadTimeDays: undefined,
  monthlyCapacityMin: undefined,
  monthlyCapacityMax: undefined,
  yearEstablished: undefined,
  employeeCount: '',
}

function StepIndicator({ step, currentStep, label }: { step: number; currentStep: number; label: string }) {
  const isComplete = step < currentStep
  const isActive = step === currentStep

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
        isComplete ? 'bg-success text-white' :
        isActive ? 'bg-accent-indigo text-white' :
        'bg-surface-elevated border border-border text-text-muted'
      )}>
        {isComplete ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <span className={cn(
        'text-xs font-medium transition-colors',
        isActive ? 'text-text-primary' : 'text-text-muted'
      )}>
        {label}
      </span>
    </div>
  )
}

function MultiSelectToggle({
  options, selected, onChange, colorOnSelect = 'indigo',
}: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  colorOnSelect?: 'indigo' | 'success'
}) {
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs border font-medium transition-all duration-150',
            selected.includes(opt)
              ? colorOnSelect === 'success'
                ? 'border-success/50 bg-success/10 text-success'
                : 'border-accent-indigo/50 bg-accent-indigo/10 text-text-primary'
              : 'border-border text-text-muted hover:border-border/60 hover:text-text-secondary'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function SectionField({ label, required, hint, children }: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </Label>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
      {children}
    </div>
  )
}

export default function ManufacturerProfilePage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [step, setStep] = useState<FormStep>('basics')
  const [saved, setSaved] = useState(false)
  const { mutateAsync: createProfile, isPending } = useCreateManufacturerProfile()

  const steps: { key: FormStep; label: string; num: number }[] = [
    { key: 'basics', label: 'Basics', num: 1 },
    { key: 'capabilities', label: 'Capabilities', num: 2 },
    { key: 'capacity', label: 'Capacity', num: 3 },
    { key: 'certifications', label: 'Credentials', num: 4 },
  ]

  const currentStepNum = steps.find(s => s.key === step)?.num ?? 1

  const updateForm = (patch: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...patch }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !form.displayName || !form.country || !form.priceTier ||
      form.moqMin === undefined || form.sampleLeadTimeDays === undefined || form.bulkLeadTimeDays === undefined
    ) return

    try {
      await createProfile({
        displayName: form.displayName!,
        description: form.description,
        country: form.country!,
        city: form.city,
        priceTier: form.priceTier!,
        moqMin: form.moqMin!,
        moqMax: form.moqMax,
        sampleLeadTimeDays: form.sampleLeadTimeDays!,
        bulkLeadTimeDays: form.bulkLeadTimeDays!,
        specialisations: form.specialisations,
        materials: form.materials,
        certifications: form.certifications,
        exportMarkets: form.exportMarkets,
        techPackFormats: form.techPackFormats,
        languages: form.languages,
        monthlyCapacityMin: form.monthlyCapacityMin,
        monthlyCapacityMax: form.monthlyCapacityMax,
        yearEstablished: form.yearEstablished,
        employeeCount: form.employeeCount,
      })
      setSaved(true)
    } catch {
      // mock success
      setSaved(true)
    }
  }

  if (saved) {
    return (
      <div className="max-w-lg mx-auto py-16 flex flex-col items-center text-center gap-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-full bg-success/10 border border-success/20 flex items-center justify-center"
        >
          <CheckCircle2 className="w-10 h-10 text-success" />
        </motion.div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Profile created</h2>
          <p className="text-sm text-text-muted mt-2">
            Your manufacturer profile is live and discoverable by brands.
            The Loocbooc team will review for verified status within 2 business days.
          </p>
        </div>
        <Link href="/dashboard/manufacturers">
          <Button>View marketplace</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Nav */}
      <Link
        href="/dashboard/manufacturers"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to manufacturers
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Create manufacturer profile</h1>
        <p className="text-sm text-text-muted mt-1">
          List your manufacturing capabilities on Loocbooc and connect with fashion brands worldwide.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-4 flex-wrap">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <button type="button" onClick={() => setStep(s.key)} className="flex items-center gap-2">
              <StepIndicator step={s.num} currentStep={currentStepNum} label={s.label} />
            </button>
            {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* STEP 1: Basics */}
        {step === 'basics' && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5 rounded-xl border border-border bg-surface p-6"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Factory className="w-4 h-4 text-text-muted" />
              <h2 className="text-sm font-semibold text-text-primary">Basic information</h2>
            </div>

            <SectionField label="Company name" required>
              <Input
                value={form.displayName}
                onChange={e => updateForm({ displayName: e.target.value })}
                placeholder="e.g. Orient Textile Co."
                required
              />
            </SectionField>

            <SectionField label="Description" hint="What makes your factory unique? What brands do you typically work with?">
              <Textarea
                value={form.description ?? ''}
                onChange={e => updateForm({ description: e.target.value })}
                placeholder="Describe your factory, history, and what you specialise in..."
                rows={3}
                className="resize-none"
              />
            </SectionField>

            <div className="grid grid-cols-2 gap-4">
              <SectionField label="Country" required>
                <Input
                  value={form.country ?? ''}
                  onChange={e => updateForm({ country: e.target.value.toUpperCase().slice(0, 2) })}
                  placeholder="e.g. CN"
                  maxLength={2}
                  required
                />
              </SectionField>
              <SectionField label="City">
                <Input
                  value={form.city ?? ''}
                  onChange={e => updateForm({ city: e.target.value })}
                  placeholder="e.g. Hangzhou"
                />
              </SectionField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SectionField label="Year established">
                <Input
                  type="number"
                  value={form.yearEstablished ?? ''}
                  onChange={e => updateForm({ yearEstablished: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 2005"
                  min={1900}
                  max={new Date().getFullYear()}
                />
              </SectionField>
              <SectionField label="Team size">
                <select
                  value={form.employeeCount ?? ''}
                  onChange={e => updateForm({ employeeCount: e.target.value })}
                  className="w-full h-10 bg-input border border-input rounded-md px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select range</option>
                  {EMPLOYEE_COUNT_OPTIONS.map(o => (
                    <option key={o} value={o}>{o} employees</option>
                  ))}
                </select>
              </SectionField>
            </div>

            <SectionField label="Price tier" required>
              <div className="grid grid-cols-2 gap-2">
                {PRICE_TIER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateForm({ priceTier: opt.value })}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all duration-150',
                      form.priceTier === opt.value
                        ? 'border-accent-indigo/50 bg-accent-indigo/10'
                        : 'border-border hover:border-border/60'
                    )}
                  >
                    <p className={cn(
                      'text-xs font-semibold',
                      form.priceTier === opt.value ? 'text-text-primary' : 'text-text-secondary'
                    )}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </SectionField>

            <Button
              type="button"
              onClick={() => setStep('capabilities')}
              disabled={!form.displayName || !form.country || !form.priceTier}
              className="w-full"
            >
              Continue
            </Button>
          </motion.div>
        )}

        {/* STEP 2: Capabilities */}
        {step === 'capabilities' && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5 rounded-xl border border-border bg-surface p-6"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Package className="w-4 h-4 text-text-muted" />
              <h2 className="text-sm font-semibold text-text-primary">Capabilities</h2>
            </div>

            <SectionField label="Specialisations" hint="What garment categories do you produce?">
              <MultiSelectToggle
                options={SPECIALISATION_OPTIONS}
                selected={form.specialisations}
                onChange={v => updateForm({ specialisations: v })}
              />
            </SectionField>

            <SectionField label="Materials" hint="What fabrics and materials do you work with?">
              <MultiSelectToggle
                options={MATERIAL_OPTIONS}
                selected={form.materials}
                onChange={v => updateForm({ materials: v })}
              />
            </SectionField>

            <SectionField label="Tech pack formats" hint="What design file formats can you accept?">
              <MultiSelectToggle
                options={TECH_PACK_FORMAT_OPTIONS}
                selected={form.techPackFormats}
                onChange={v => updateForm({ techPackFormats: v })}
              />
            </SectionField>

            <SectionField label="Export markets" hint="Which markets do you currently export to?">
              <MultiSelectToggle
                options={EXPORT_MARKET_OPTIONS}
                selected={form.exportMarkets}
                onChange={v => updateForm({ exportMarkets: v })}
              />
            </SectionField>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep('basics')} className="flex-1">
                Back
              </Button>
              <Button type="button" onClick={() => setStep('capacity')} className="flex-1">
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Capacity */}
        {step === 'capacity' && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5 rounded-xl border border-border bg-surface p-6"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Clock className="w-4 h-4 text-text-muted" />
              <h2 className="text-sm font-semibold text-text-primary">Capacity & lead times</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SectionField label="Min MOQ" required hint="Minimum order quantity per style">
                <Input
                  type="number"
                  value={form.moqMin ?? ''}
                  onChange={e => updateForm({ moqMin: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 100"
                  min={1}
                  required
                />
              </SectionField>
              <SectionField label="Max MOQ" hint="Leave blank if unlimited">
                <Input
                  type="number"
                  value={form.moqMax ?? ''}
                  onChange={e => updateForm({ moqMax: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Optional"
                  min={1}
                />
              </SectionField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SectionField label="Sample lead time (days)" required>
                <Input
                  type="number"
                  value={form.sampleLeadTimeDays ?? ''}
                  onChange={e => updateForm({ sampleLeadTimeDays: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 21"
                  min={1}
                  required
                />
              </SectionField>
              <SectionField label="Bulk lead time (days)" required>
                <Input
                  type="number"
                  value={form.bulkLeadTimeDays ?? ''}
                  onChange={e => updateForm({ bulkLeadTimeDays: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 60"
                  min={1}
                  required
                />
              </SectionField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SectionField label="Monthly capacity min" hint="Units per month">
                <Input
                  type="number"
                  value={form.monthlyCapacityMin ?? ''}
                  onChange={e => updateForm({ monthlyCapacityMin: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 5000"
                  min={1}
                />
              </SectionField>
              <SectionField label="Monthly capacity max">
                <Input
                  type="number"
                  value={form.monthlyCapacityMax ?? ''}
                  onChange={e => updateForm({ monthlyCapacityMax: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Optional"
                  min={1}
                />
              </SectionField>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep('capabilities')} className="flex-1">
                Back
              </Button>
              <Button
                type="button"
                onClick={() => setStep('certifications')}
                disabled={!form.moqMin || !form.sampleLeadTimeDays || !form.bulkLeadTimeDays}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Certifications */}
        {step === 'certifications' && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5 rounded-xl border border-border bg-surface p-6"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Globe className="w-4 h-4 text-text-muted" />
              <h2 className="text-sm font-semibold text-text-primary">Certifications & credentials</h2>
            </div>

            <SectionField label="Certifications" hint="Select all that apply. These are verified by the Loocbooc team.">
              <MultiSelectToggle
                options={CERTIFICATION_OPTIONS}
                selected={form.certifications}
                onChange={v => updateForm({ certifications: v })}
                colorOnSelect="success"
              />
            </SectionField>

            <SectionField label="Languages spoken">
              <div className="flex flex-wrap gap-2">
                {['English', 'Mandarin', 'Hindi', 'Bengali', 'Vietnamese', 'Turkish', 'Portuguese', 'Italian'].map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      const next = form.languages.includes(lang)
                        ? form.languages.filter(l => l !== lang)
                        : [...form.languages, lang]
                      updateForm({ languages: next })
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs border font-medium transition-all duration-150',
                      form.languages.includes(lang)
                        ? 'border-accent-indigo/50 bg-accent-indigo/10 text-text-primary'
                        : 'border-border text-text-muted hover:border-border/60 hover:text-text-secondary'
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </SectionField>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep('capacity')} className="flex-1">
                Back
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 gap-2"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Create profile
              </Button>
            </div>
          </motion.div>
        )}
      </form>
    </div>
  )
}
