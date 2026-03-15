'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Calendar, Users, TrendingUp, Tag, Zap, Package,
  AlertTriangle, CheckCircle2, Clock, ExternalLink, Copy,
  Factory, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CampaignStatusBadge } from '@/components/back-it/CampaignStatusBadge'
import { MoqProgressBar } from '@/components/back-it/MoqProgressBar'
import { useCampaign, useActivateCampaign, useCancelCampaign } from '@/hooks/useCampaigns'
import { cn } from '@/lib/utils'
import type { CampaignDetail, DailyBackingPoint } from '@/types/back-it'

// ─── Helpers ──────────────────────────────────────────────────

function formatCurrency(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Sparkline chart ──────────────────────────────────────────

function BackingSparkline({ data, moq }: { data: DailyBackingPoint[]; moq: number }) {
  if (!data.length) return null

  const max = Math.max(...data.map(d => d.cumulative), moq)
  const width = 560
  const height = 120
  const padding = { top: 12, right: 12, bottom: 28, left: 36 }

  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const xScale = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * chartW
  const yScale = (v: number) => padding.top + chartH - (v / max) * chartH

  // Build SVG path
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(d.cumulative).toFixed(1)}`)
    .join(' ')

  const areaPath = `${linePath} L ${xScale(data.length - 1).toFixed(1)} ${(padding.top + chartH).toFixed(1)} L ${xScale(0).toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`

  // MOQ line y-position
  const moqY = yScale(moq)

  // X-axis labels (show ~4 dates)
  const labelIndices = [0, Math.floor(data.length / 3), Math.floor((data.length * 2) / 3), data.length - 1]
    .filter((v, i, arr) => arr.indexOf(v) === i)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 120 }}>
      <defs>
        <linearGradient id="backerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-indigo, #6366f1)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent-indigo, #6366f1)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill="url(#backerGrad)" />

      {/* MOQ reference line */}
      {moqY > padding.top && moqY < padding.top + chartH && (
        <g>
          <line
            x1={padding.left}
            y1={moqY.toFixed(1)}
            x2={padding.left + chartW}
            y2={moqY.toFixed(1)}
            stroke="var(--success, #22c55e)"
            strokeWidth="1"
            strokeDasharray="4,3"
            opacity="0.7"
          />
          <text
            x={padding.left + chartW + 2}
            y={moqY + 4}
            fill="var(--success, #22c55e)"
            fontSize="8"
            fontFamily="inherit"
          >
            MOQ
          </text>
        </g>
      )}

      {/* Line */}
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Y axis labels */}
      {[0, Math.round(max / 2), max].map((v, i) => (
        <text
          key={i}
          x={padding.left - 4}
          y={yScale(v) + 4}
          textAnchor="end"
          fontSize="8"
          fill="var(--text-muted, #888)"
          fontFamily="inherit"
        >
          {v}
        </text>
      ))}

      {/* X axis labels */}
      {labelIndices.map(idx => (
        data[idx] && (
          <text
            key={idx}
            x={xScale(idx)}
            y={padding.top + chartH + 16}
            textAnchor="middle"
            fontSize="8"
            fill="var(--text-muted, #888)"
            fontFamily="inherit"
          >
            {data[idx].date.slice(5)}
          </text>
        )
      ))}
    </svg>
  )
}

// ─── Stat card ────────────────────────────────────────────────

function Stat({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
        <Icon className="w-3.5 h-3.5 text-text-muted" />
      </div>
      <p className={cn('text-xl font-bold tabular-nums', accent ?? 'text-text-primary')}>{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const { data: campaign, isLoading } = useCampaign(slug)
  const { mutateAsync: activate, isPending: activating } = useActivateCampaign()
  const { mutateAsync: cancel, isPending: cancelling } = useCancelCampaign()

  const [showAllEvents, setShowAllEvents] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleActivate = async () => {
    await activate(slug)
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this campaign? All deposits will be refunded to backers.')) return
    await cancel(slug)
    router.push('/dashboard/back-it')
  }

  const copyLink = () => {
    const url = `${window.location.origin}/back/${slug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
        <AlertTriangle className="w-10 h-10 text-text-muted mb-4" />
        <h2 className="text-base font-semibold text-text-primary">Campaign not found</h2>
        <p className="text-sm text-text-muted mt-1">This campaign doesn't exist or you don't have access.</p>
        <Link href="/dashboard/back-it" className="mt-4">
          <Button variant="outline">Back to campaigns</Button>
        </Link>
      </div>
    )
  }

  const daysRemaining = Math.max(0, Math.ceil(
    (new Date(campaign.campaignEnd).getTime() - Date.now()) / 86_400_000
  ))
  const isLive = campaign.status === 'active'
  const isDraft = campaign.status === 'draft' || campaign.status === 'scheduled'
  const isConcluded = ['completed', 'cancelled', 'expired'].includes(campaign.status)
  const discount = Math.round(
    ((campaign.retailPriceCents - campaign.backerPriceCents) / campaign.retailPriceCents) * 100
  )

  const visibleEvents = showAllEvents
    ? campaign.events
    : campaign.events.slice(0, 5)

  const eventLabelMap: Record<string, string> = {
    'campaign.created': 'Campaign created',
    'campaign.activated': 'Campaign went live',
    'backing.placed': 'New backing',
    'backing.milestone': 'Milestone reached',
    'backing.cancelled': 'Backing cancelled',
    'campaign.moq_reached': 'MOQ reached 🎉',
    'campaign.expired': 'Campaign expired',
    'campaign.completed': 'Campaign completed',
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/back-it"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back It campaigns
      </Link>

      {/* Title + status */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{campaign.title}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          {campaign.garmentName && (
            <p className="text-sm text-text-muted">{campaign.garmentName}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy link */}
          {!isDraft && (
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          )}

          {/* View live */}
          {!isDraft && (
            <Link href={`/back/${slug}`} target="_blank">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                View live
              </Button>
            </Link>
          )}

          {/* Activate */}
          {isDraft && (
            <Button size="sm" onClick={handleActivate} disabled={activating} className="gap-1.5">
              {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Activate campaign
            </Button>
          )}

          {/* Cancel */}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="gap-1.5 text-error border-error/30 hover:bg-error/10"
            >
              {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              Cancel campaign
            </Button>
          )}
        </div>
      </motion.div>

      {/* MOQ Progress — big feature card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={cn(
          'rounded-xl border p-6 space-y-4',
          campaign.moqReached
            ? 'border-success/30 bg-success/5'
            : isLive && daysRemaining <= 5
            ? 'border-warning/40 bg-warning/5'
            : 'border-border bg-surface'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Backing progress</h2>
          {campaign.moqReached && (
            <div className="flex items-center gap-1.5 text-xs text-success font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              MOQ reached {campaign.moqReachedAt ? formatDate(campaign.moqReachedAt) : ''}
            </div>
          )}
          {isLive && !campaign.moqReached && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Clock className="w-3.5 h-3.5" />
              {daysRemaining === 0 ? 'Ends today' : `${daysRemaining} days left`}
            </div>
          )}
        </div>

        <MoqProgressBar
          currentCount={campaign.currentBackingCount}
          moq={campaign.moq}
          stretchGoalQty={campaign.stretchGoalQty}
          percentComplete={campaign.percentComplete}
          size="lg"
          showLabels
          animate
        />

        {/* Sparkline */}
        {campaign.dailyBackings.length > 1 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Daily backing trend</p>
            <BackingSparkline data={campaign.dailyBackings} moq={campaign.moq} />
          </div>
        )}
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <Stat
          icon={TrendingUp}
          label="Collected"
          value={formatCurrency(campaign.collectedDepositsCents, campaign.currency)}
          sub={`of ${formatCurrency(campaign.projectedRevenueCents, campaign.currency)} projected`}
          accent="text-text-primary"
        />
        <Stat
          icon={Users}
          label="Backers"
          value={campaign.currentBackingCount}
          sub={`${campaign.moq - campaign.currentBackingCount > 0 ? `${campaign.moq - campaign.currentBackingCount} more to MOQ` : 'MOQ reached'}`}
        />
        <Stat
          icon={Tag}
          label="Backer price"
          value={formatCurrency(campaign.backerPriceCents, campaign.currency)}
          sub={`${discount}% off retail`}
          accent="text-success"
        />
        <Stat
          icon={Calendar}
          label={isConcluded ? 'Ended' : 'Deadline'}
          value={formatDate(campaign.campaignEnd)}
          sub={isLive ? `${daysRemaining}d remaining` : undefined}
        />
      </motion.div>

      {/* Two-column: size breakdown + backings */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Size breakdown */}
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Size breakdown</h3>
          {campaign.currentBackingCount === 0 ? (
            <p className="text-sm text-text-muted">No backings yet.</p>
          ) : (
            <div className="space-y-3">
              {campaign.sizeBreakdown.map(s => (
                <div key={s.size} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-text-primary">{s.size}</span>
                    <span className="text-text-muted">{s.count} ({s.percent}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                    <div
                      style={{ width: `${s.percent}%` }}
                      className="h-full rounded-full bg-accent-indigo"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent backings */}
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Recent backings</h3>
          {campaign.recentBackings.length === 0 ? (
            <p className="text-sm text-text-muted">No backings yet.</p>
          ) : (
            <div className="space-y-2.5">
              {campaign.recentBackings.slice(0, 7).map(b => (
                <div key={b.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-[10px] font-medium text-text-muted shrink-0">
                      {b.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-text-secondary truncate">{b.displayName}</p>
                      {b.country && (
                        <p className="text-text-muted">{b.country} · Size {b.size}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-medium text-text-primary">
                      {formatCurrency(b.totalCents, b.currency)}
                    </p>
                    <p className="text-text-muted">{timeAgo(b.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Campaign details */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="rounded-xl border border-border bg-surface p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-text-primary">Campaign details</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <DetailRow label="Campaign URL" value={`/back/${campaign.slug}`} mono />
          <DetailRow label="Currency" value={campaign.currency} />
          <DetailRow label="Deposit" value={`${campaign.depositPercent}% upfront`} />
          <DetailRow
            label="Start date"
            value={formatDate(campaign.campaignStart)}
          />
          <DetailRow
            label="End date"
            value={formatDate(campaign.campaignEnd)}
          />
          {campaign.estimatedShipDate && (
            <DetailRow label="Est. ship date" value={formatDate(campaign.estimatedShipDate)} />
          )}
          <DetailRow label="Available sizes" value={campaign.availableSizes.join(', ')} />
          {campaign.manufacturerName && (
            <DetailRow label="Manufacturer" value={campaign.manufacturerName} />
          )}
          {campaign.shopifyStoreUrl && (
            <DetailRow label="Shopify store" value={campaign.shopifyStoreUrl} />
          )}
        </div>
      </motion.div>

      {/* Manufacturer assignment (if no manufacturer yet, prompt) */}
      {!campaign.manufacturerId && campaign.moqReached && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="rounded-xl border border-warning/40 bg-warning/5 p-5 flex items-start gap-4"
        >
          <Factory className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p className="text-sm font-semibold text-text-primary">MOQ reached — assign a manufacturer</p>
            <p className="text-sm text-text-muted">
              You've hit your target. Connect with a manufacturer to move to production.
            </p>
            <Link href="/dashboard/manufacturers">
              <Button size="sm" className="gap-1.5 mt-1">
                <Factory className="w-3.5 h-3.5" />
                Find a manufacturer
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Activity log */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border border-border bg-surface p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-text-primary">Activity log</h3>

        <div className="space-y-0 divide-y divide-border">
          <AnimatePresence>
            {visibleEvents.map(evt => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start justify-between py-3 gap-3 text-xs"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                    evt.eventType.startsWith('backing') ? 'bg-accent-indigo' :
                    evt.eventType.includes('moq') ? 'bg-success' :
                    evt.eventType.includes('cancel') || evt.eventType.includes('expire') ? 'bg-error' :
                    'bg-text-muted'
                  )} />
                  <div>
                    <p className="text-text-secondary font-medium">
                      {eventLabelMap[evt.eventType] ?? evt.eventType}
                    </p>
                    {evt.payload && Object.keys(evt.payload).length > 0 && (
                      <p className="text-text-muted mt-0.5">
                        {Object.entries(evt.payload).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-text-muted shrink-0">{timeAgo(evt.createdAt)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {campaign.events.length > 5 && (
          <button
            onClick={() => setShowAllEvents(!showAllEvents)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            {showAllEvents ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Show all {campaign.events.length} events</>
            )}
          </button>
        )}
      </motion.div>

      {/* Danger zone: draft activation prompt */}
      {isDraft && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17 }}
          className="rounded-xl border border-dashed border-border bg-surface p-6 flex items-center justify-between gap-6"
        >
          <div>
            <p className="text-sm font-semibold text-text-primary">Ready to go live?</p>
            <p className="text-xs text-text-muted mt-1">
              Activating this campaign makes it public. Consumers can begin backing immediately.
            </p>
          </div>
          <Button onClick={handleActivate} disabled={activating} className="gap-1.5 shrink-0">
            {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Activate
          </Button>
        </motion.div>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
      <p className={cn('text-text-secondary', mono && 'font-mono text-[11px]')}>{value}</p>
    </div>
  )
}
