'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Check, Loader2,
  Shirt, DollarSign, Target, Calendar, Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateCampaign } from '@/hooks/useCampaigns'
import { useGarments } from '@/hooks/useGarments'
import { cn } from '@/lib/utils'
import type { CreateCampaignInput } from '@/types/back-it'

// ─── Step types ────────────────────────────────────────────────

type Step = 'garment' | 'pricing' | 'moq' | 'timeline' | 'review'

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'garment', label: 'Garment', icon: Shirt },
  { key: 'pricing', label: 'Pricing', icon: DollarSign },
  { key: 'moq', label: 'MOQ & Sizes', icon: Target },
  { key: 'timeline', label: 'Timeline', icon: Calendar },
  { key: 'review', label: 'Review', icon: Tag },
]

const STEP_ORDER: Step[] = STEPS.map(s => s.key)

// ─── Form state ────────────────────────────────────────────────

interface FormState {
  garmentId: string
  title: string
  description: string
  slug: string
  retailPriceCents: string       // string for input control
  backerPriceCents: string
  depositPercent: string
  currency: string
  moq: string
  stretchGoalQty: string
  campaignStart: string
  campaignEnd: string
  estimatedShipDate: string
  availableSizes: string[]
}

const INITIAL: FormState = {
  garmentId: '',
  title: '',
  description: '',
  slug: '',
  retailPriceCents: '',
  backerPriceCents: '',
  depositPercent: '100',
  currency: 'AUD',
  moq: '',
  stretchGoalQty: '',
  campaignStart: '',
  campaignEnd: '',
  estimatedShipDate: '',
  availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
}

const SIZE_OPTIONS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '8', '10', '12', '14', '16', '18', 'OS']
const CURRENCY_OPTIONS = ['AUD', 'USD', 'GBP', 'EUR', 'NZD']

// ─── Sub-components ────────────────────────────────────────────

function StepIndicator({ step, currentStep }: { step: Step; currentStep: Step }) {
  const stepIndex = STEP_ORDER.indexOf(step)
  const currentIndex = STEP_ORDER.indexOf(currentStep)
  const isComplete = stepIndex < currentIndex
  const isActive = step === currentStep
  const cfg = STEPS.find(s => s.key === step)!
  const Icon = cfg.icon

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
        isComplete ? 'bg-success text-white' :
        isActive ? 'bg-accent-indigo text-white' :
        'bg-surface-elevated border border-border text-text-muted'
      )}>
        {isComplete ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
      </div>
      <span className={cn(
        'text-xs font-medium hidden lg:block',
        isActive ? 'text-text-primary' : 'text-text-muted'
      )}>
        {cfg.label}
      </span>
    </div>
  )
}

function Field({ label, required, hint, children }: {
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

function slugify(str: string) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
}

// ─── Main page ────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [step, setStep] = useState<Step>('garment')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  const { data: garmentsData, isLoading: garmentsLoading } = useGarments({ limit: 50 })
  // API returns `items`; some mock paths return `garments` — handle both
  const garments: { ugi: string; name: string; category?: string }[] =
    (garmentsData as any)?.garments ?? garmentsData?.items ?? []
  const { mutateAsync: createCampaign, isPending } = useCreateCampaign()

  const update = useCallback((patch: Partial<FormState>) => {
    setForm(prev => {
      const next = { ...prev, ...patch }
      // Auto-generate slug from title unless user has manually edited it
      if ('title' in patch && !slugManuallyEdited) {
        next.slug = slugify(patch.title ?? '')
      }
      return next
    })
  }, [slugManuallyEdited])

  const currentIndex = STEP_ORDER.indexOf(step)

  const goNext = () => {
    const next = STEP_ORDER[currentIndex + 1]
    if (next) setStep(next)
  }
  const goBack = () => {
    const prev = STEP_ORDER[currentIndex - 1]
    if (prev) setStep(prev)
  }

  // ─── Validation ────────────────────────────────────────────

  const canProceed: Record<Step, boolean> = {
    garment: !!form.garmentId && !!form.title && !!form.slug,
    pricing: !!form.retailPriceCents && !!form.backerPriceCents &&
      parseInt(form.backerPriceCents) < parseInt(form.retailPriceCents) &&
      !!form.depositPercent,
    moq: !!form.moq && parseInt(form.moq) > 0 && form.availableSizes.length > 0,
    timeline: !!form.campaignStart && !!form.campaignEnd &&
      new Date(form.campaignEnd) > new Date(form.campaignStart),
    review: true,
  }

  // ─── Submit ────────────────────────────────────────────────

  const handleSubmit = async () => {
    const input: CreateCampaignInput = {
      garmentId: form.garmentId,
      title: form.title,
      description: form.description || undefined,
      slug: form.slug,
      retailPriceCents: Math.round(parseFloat(form.retailPriceCents) * 100),
      backerPriceCents: Math.round(parseFloat(form.backerPriceCents) * 100),
      depositPercent: parseInt(form.depositPercent),
      currency: form.currency,
      moq: parseInt(form.moq),
      stretchGoalQty: form.stretchGoalQty ? parseInt(form.stretchGoalQty) : undefined,
      campaignStart: new Date(form.campaignStart).toISOString(),
      campaignEnd: new Date(form.campaignEnd).toISOString(),
      estimatedShipDate: form.estimatedShipDate || undefined,
      availableSizes: form.availableSizes,
    }

    const { slug } = await createCampaign(input)
    router.push(`/dashboard/back-it/${slug}`)
  }

  // ─── Review summary values ─────────────────────────────────

  const retailPrice = parseFloat(form.retailPriceCents) || 0
  const backerPrice = parseFloat(form.backerPriceCents) || 0
  const moqCount = parseInt(form.moq) || 0
  const discount = retailPrice ? Math.round(((retailPrice - backerPrice) / retailPrice) * 100) : 0
  const projectedRevenue = backerPrice * moqCount
  const selectedGarment = garments.find(g => g.ugi === form.garmentId)

  // ─── Render steps ──────────────────────────────────────────

  return (
    <div className="max-w-xl space-y-6">
      {/* Back nav */}
      <Link
        href="/dashboard/back-it"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to campaigns
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">New Back It campaign</h1>
        <p className="text-sm text-text-muted mt-1">
          Set up a demand-first production campaign. Go live when you're ready.
        </p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => {
              // Only allow navigating to already-completed steps
              if (STEP_ORDER.indexOf(s.key) < STEP_ORDER.indexOf(step)) {
                setStep(s.key)
              }
            }}>
              <StepIndicator step={s.key} currentStep={step} />
            </button>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Garment ── */}
      {step === 'garment' && (
        <motion.div
          key="garment"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl border border-border bg-surface p-6 space-y-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Shirt className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Select garment</h2>
          </div>

          <Field label="Garment" required hint="Choose the garment this campaign is for.">
            {garmentsLoading ? (
              <div className="h-10 bg-surface-elevated animate-pulse rounded-md" />
            ) : (
              <select
                value={form.garmentId}
                onChange={e => update({ garmentId: e.target.value })}
                className="w-full h-10 bg-input border border-input rounded-md px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select a garment…</option>
                {garments.map(g => (
                  <option key={g.ugi} value={g.ugi}>
                    {g.name} {g.category ? `(${g.category})` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Campaign title" required hint="Displayed to consumers on the campaign page.">
            <Input
              value={form.title}
              onChange={e => update({ title: e.target.value })}
              placeholder="e.g. Midnight Linen Blazer — AW26"
              required
            />
          </Field>

          <Field label="URL slug" required hint="Used in the campaign URL. Auto-generated from title.">
            <Input
              value={form.slug}
              onChange={e => {
                setSlugManuallyEdited(true)
                update({ slug: slugify(e.target.value) })
              }}
              placeholder="midnight-linen-blazer-aw26"
            />
            {form.slug && (
              <p className="text-[10px] text-text-muted mt-1">
                loocbooc.com/back/{form.slug}
              </p>
            )}
          </Field>

          <Field label="Description" hint="Optional. Shown on the consumer campaign page.">
            <Textarea
              value={form.description}
              onChange={e => update({ description: e.target.value })}
              placeholder="Tell backers about this garment, its story, and what makes it special…"
              rows={3}
              className="resize-none"
            />
          </Field>

          <Button
            onClick={goNext}
            disabled={!canProceed.garment}
            className="w-full gap-2"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {/* ── STEP 2: Pricing ── */}
      {step === 'pricing' && (
        <motion.div
          key="pricing"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl border border-border bg-surface p-6 space-y-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <DollarSign className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Pricing</h2>
          </div>

          <Field label="Currency">
            <div className="flex gap-2 flex-wrap">
              {CURRENCY_OPTIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update({ currency: c })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    form.currency === c
                      ? 'border-accent-indigo/50 bg-accent-indigo/10 text-text-primary'
                      : 'border-border text-text-muted hover:border-border/60'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Retail price" required hint="Full price post-production.">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
                <Input
                  type="number"
                  value={form.retailPriceCents}
                  onChange={e => update({ retailPriceCents: e.target.value })}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  className="pl-7"
                  required
                />
              </div>
            </Field>
            <Field label="Backer price" required hint="Discounted price for backers.">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
                <Input
                  type="number"
                  value={form.backerPriceCents}
                  onChange={e => update({ backerPriceCents: e.target.value })}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  className="pl-7"
                  required
                />
              </div>
            </Field>
          </div>

          {/* Discount preview */}
          {retailPrice > 0 && backerPrice > 0 && (
            <div className={cn(
              'rounded-lg p-3 text-sm',
              backerPrice >= retailPrice
                ? 'bg-error/10 border border-error/30 text-error'
                : 'bg-success/10 border border-success/30 text-success'
            )}>
              {backerPrice >= retailPrice
                ? 'Backer price must be lower than retail price.'
                : `${discount}% backer discount — ${form.currency} ${backerPrice.toFixed(2)} vs ${form.currency} ${retailPrice.toFixed(2)} retail`}
            </div>
          )}

          <Field
            label="Deposit percent"
            required
            hint="100% = full payment upfront. Set lower for partial deposit (remainder charged on MOQ)."
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={form.depositPercent}
                onChange={e => update({ depositPercent: e.target.value })}
                min={10}
                max={100}
                step={5}
                className="w-24"
              />
              <span className="text-sm text-text-muted">%</span>
              <div className="flex gap-2 ml-2">
                {['25', '50', '100'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => update({ depositPercent: v })}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs border font-medium transition-all',
                      form.depositPercent === v
                        ? 'border-accent-indigo/50 bg-accent-indigo/10 text-text-primary'
                        : 'border-border text-text-muted hover:border-border/60'
                    )}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            {form.depositPercent !== '100' && backerPrice > 0 && (
              <p className="text-xs text-text-muted mt-1.5">
                Charged upfront: {form.currency} {(backerPrice * parseInt(form.depositPercent) / 100).toFixed(2)}
                &nbsp;· Balance on MOQ: {form.currency} {(backerPrice * (1 - parseInt(form.depositPercent) / 100)).toFixed(2)}
              </p>
            )}
          </Field>

          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button onClick={goNext} disabled={!canProceed.pricing} className="flex-1 gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── STEP 3: MOQ & Sizes ── */}
      {step === 'moq' && (
        <motion.div
          key="moq"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl border border-border bg-surface p-6 space-y-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Target className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">MOQ & Sizes</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="MOQ" required hint="Minimum orders needed to trigger production.">
              <Input
                type="number"
                value={form.moq}
                onChange={e => update({ moq: e.target.value })}
                placeholder="e.g. 150"
                min={1}
                required
              />
            </Field>
            <Field label="Stretch goal" hint="Optional: unlock a colourway or feature.">
              <Input
                type="number"
                value={form.stretchGoalQty}
                onChange={e => update({ stretchGoalQty: e.target.value })}
                placeholder="Optional"
                min={parseInt(form.moq) + 1 || 2}
              />
            </Field>
          </div>

          {/* Revenue preview */}
          {moqCount > 0 && backerPrice > 0 && (
            <div className="rounded-lg bg-surface-elevated border border-border p-3 space-y-1.5">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Revenue at MOQ</p>
              <p className="text-xl font-bold text-text-primary">
                {form.currency} {projectedRevenue.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-text-muted">
                {moqCount} backers × {form.currency} {backerPrice.toFixed(2)} backer price
              </p>
            </div>
          )}

          <Field label="Available sizes" required hint="Select all sizes you'll offer.">
            <div className="flex flex-wrap gap-2">
              {SIZE_OPTIONS.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    const next = form.availableSizes.includes(size)
                      ? form.availableSizes.filter(s => s !== size)
                      : [...form.availableSizes, size]
                    update({ availableSizes: next })
                  }}
                  className={cn(
                    'w-12 h-10 rounded-lg border text-sm font-medium transition-all duration-150',
                    form.availableSizes.includes(size)
                      ? 'border-accent-indigo/50 bg-accent-indigo/10 text-text-primary'
                      : 'border-border text-text-muted hover:border-border/60 hover:text-text-secondary'
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
            {form.availableSizes.length === 0 && (
              <p className="text-xs text-error mt-1">Select at least one size.</p>
            )}
          </Field>

          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button onClick={goNext} disabled={!canProceed.moq} className="flex-1 gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── STEP 4: Timeline ── */}
      {step === 'timeline' && (
        <motion.div
          key="timeline"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl border border-border bg-surface p-6 space-y-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Calendar className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Campaign timeline</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Campaign start" required>
              <Input
                type="datetime-local"
                value={form.campaignStart}
                onChange={e => update({ campaignStart: e.target.value })}
                required
              />
            </Field>
            <Field label="Campaign end" required>
              <Input
                type="datetime-local"
                value={form.campaignEnd}
                onChange={e => update({ campaignEnd: e.target.value })}
                min={form.campaignStart}
                required
              />
            </Field>
          </div>

          {form.campaignStart && form.campaignEnd && (
            (() => {
              const days = Math.ceil(
                (new Date(form.campaignEnd).getTime() - new Date(form.campaignStart).getTime()) / 86_400_000
              )
              return days > 0 ? (
                <div className="text-xs text-text-muted bg-surface-elevated rounded-lg p-3">
                  Campaign duration: <span className="text-text-primary font-medium">{days} days</span>
                  {days < 14 && (
                    <span className="ml-2 text-warning">· Short campaign — consider at least 14 days for momentum</span>
                  )}
                  {days > 60 && (
                    <span className="ml-2 text-warning">· Long campaign — consumers may lose interest after 30–45 days</span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-error">End date must be after start date.</p>
              )
            })()
          )}

          <Field label="Estimated ship date" hint="When do you expect to ship to backers? Shown on the consumer page.">
            <Input
              type="date"
              value={form.estimatedShipDate}
              onChange={e => update({ estimatedShipDate: e.target.value })}
            />
          </Field>

          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button onClick={goNext} disabled={!canProceed.timeline} className="flex-1 gap-2">
              Review <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── STEP 5: Review ── */}
      {step === 'review' && (
        <motion.div
          key="review"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl border border-border bg-surface p-6 space-y-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Tag className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Review & create</h2>
          </div>

          <div className="space-y-3 text-sm">
            <ReviewRow label="Garment" value={selectedGarment?.name ?? form.garmentId} />
            <ReviewRow label="Title" value={form.title} />
            <ReviewRow label="URL slug" value={`/back/${form.slug}`} mono />
            {form.description && <ReviewRow label="Description" value={form.description} />}
            <div className="border-t border-border pt-3 space-y-3">
              <ReviewRow
                label="Retail price"
                value={`${form.currency} ${parseFloat(form.retailPriceCents).toFixed(2)}`}
              />
              <ReviewRow
                label="Backer price"
                value={`${form.currency} ${parseFloat(form.backerPriceCents).toFixed(2)} (${discount}% off)`}
                accent="text-success"
              />
              <ReviewRow
                label="Deposit"
                value={`${form.depositPercent}% upfront`}
              />
            </div>
            <div className="border-t border-border pt-3 space-y-3">
              <ReviewRow label="MOQ" value={`${form.moq} units`} />
              {form.stretchGoalQty && <ReviewRow label="Stretch goal" value={`${form.stretchGoalQty} units`} />}
              <ReviewRow
                label="Projected revenue (at MOQ)"
                value={`${form.currency} ${projectedRevenue.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                accent="text-text-primary font-semibold"
              />
              <ReviewRow
                label="Sizes"
                value={form.availableSizes.join(', ')}
              />
            </div>
            <div className="border-t border-border pt-3 space-y-3">
              <ReviewRow
                label="Campaign start"
                value={new Date(form.campaignStart).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
              />
              <ReviewRow
                label="Campaign end"
                value={new Date(form.campaignEnd).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
              />
              {form.estimatedShipDate && (
                <ReviewRow
                  label="Est. ship date"
                  value={new Date(form.estimatedShipDate).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                />
              )}
            </div>
          </div>

          <div className="rounded-lg bg-surface-elevated border border-border p-3 text-xs text-text-muted">
            Campaign will be saved as a <span className="font-medium text-text-secondary">draft</span>.
            You can review, edit, and activate it whenever you're ready.
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack} className="flex-1" disabled={isPending}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} className="flex-1 gap-2">
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
              ) : (
                <><Check className="w-4 h-4" /> Create campaign</>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function ReviewRow({ label, value, mono, accent }: {
  label: string
  value: string
  mono?: boolean
  accent?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-text-muted shrink-0">{label}</span>
      <span className={cn(
        'text-right',
        mono ? 'font-mono text-[11px] text-text-secondary' : accent ?? 'text-text-secondary'
      )}>
        {value}
      </span>
    </div>
  )
}
