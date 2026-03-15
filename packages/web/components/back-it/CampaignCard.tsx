'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Calendar, ArrowRight, Shirt, AlertCircle, CheckCircle2 } from 'lucide-react'
import { CampaignStatusBadge } from './CampaignStatusBadge'
import { MoqProgressBar } from './MoqProgressBar'
import { cn } from '@/lib/utils'
import type { CampaignListItem } from '@/types/back-it'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
}

function daysRemaining(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000))
}

export function CampaignCard({
  campaign,
  index,
}: {
  campaign: CampaignListItem
  index: number
}) {
  const days = daysRemaining(campaign.campaignEnd)
  const isActive = campaign.status === 'active' || campaign.status === 'moq_reached'
  const isUrgent = isActive && days <= 5
  const discount = Math.round(
    ((campaign.retailPriceCents - campaign.backerPriceCents) / campaign.retailPriceCents) * 100
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <Link href={`/dashboard/back-it/${campaign.slug}`}>
        <div className={cn(
          'group rounded-xl border bg-surface p-5 space-y-4 transition-all duration-200 hover:shadow-md hover:border-border/60',
          isUrgent && 'border-warning/40'
        )}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center shrink-0">
                {campaign.coverImageUrl ? (
                  <img
                    src={campaign.coverImageUrl}
                    alt={campaign.title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Shirt className="w-5 h-5 text-text-muted" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-indigo transition-colors">
                  {campaign.title}
                </h3>
                {campaign.garmentName && (
                  <p className="text-xs text-text-muted truncate mt-0.5">{campaign.garmentName}</p>
                )}
              </div>
            </div>
            <CampaignStatusBadge status={campaign.status} />
          </div>

          {/* Progress */}
          {campaign.status !== 'draft' && campaign.status !== 'scheduled' && (
            <MoqProgressBar
              currentCount={campaign.currentBackingCount}
              moq={campaign.moq}
              stretchGoalQty={campaign.stretchGoalQty}
              percentComplete={campaign.percentComplete}
              size="sm"
              animate={false}
            />
          )}

          {/* Pricing row */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-text-primary">
                {formatCurrency(campaign.backerPriceCents, campaign.currency)}
              </span>
              <span className="text-text-muted line-through">
                {formatCurrency(campaign.retailPriceCents, campaign.currency)}
              </span>
            </div>
            <span className="text-success font-medium">{discount}% off</span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">MOQ {campaign.moq}</span>
          </div>

          {/* Timeline + urgency */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              {campaign.moqReached ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              ) : isUrgent ? (
                <AlertCircle className="w-3.5 h-3.5 text-warning" />
              ) : (
                <Calendar className="w-3.5 h-3.5" />
              )}
              {campaign.status === 'active' && !campaign.moqReached ? (
                <span className={isUrgent ? 'text-warning font-medium' : ''}>
                  {days === 0 ? 'Ends today' : `${days}d remaining`}
                </span>
              ) : campaign.moqReached ? (
                <span className="text-success font-medium">MOQ reached</span>
              ) : campaign.status === 'draft' ? (
                <span>Starts {formatDate(campaign.campaignStart)}</span>
              ) : (
                <span>Ended {formatDate(campaign.campaignEnd)}</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-text-muted group-hover:text-text-secondary transition-colors">
              <span>
                {formatCurrency(campaign.collectedDepositsCents, campaign.currency)} collected
              </span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
