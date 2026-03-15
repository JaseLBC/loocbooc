'use client'

import { useState } from 'react'
import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, MapPin, Package, Clock, Globe, Users, Calendar,
  CheckCircle2, Star, Send, MessageSquare, Award, FileText,
  Languages, TrendingUp, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RatingStars } from '@/components/manufacturers/RatingStars'
import { EnquiryModal } from '@/components/manufacturers/EnquiryModal'
import { useManufacturer } from '@/hooks/useManufacturers'
import { cn } from '@/lib/utils'

const PRICE_TIER_LABELS: Record<string, string> = {
  mass: 'Budget / Mass Market',
  mid: 'Mid-Range',
  premium: 'Premium',
  luxury: 'Luxury / Artisan',
}

const CONNECTION_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof MessageSquare }> = {
  ENQUIRY: { label: 'Enquiry sent', color: 'text-warning border-warning/40 bg-warning/10', icon: MessageSquare },
  RESPONDED: { label: 'Responded', color: 'text-accent-indigo border-accent-indigo/40 bg-accent-indigo/10', icon: MessageSquare },
  CONNECTED: { label: 'Connected', color: 'text-success border-success/40 bg-success/10', icon: CheckCircle2 },
  DECLINED: { label: 'Declined', color: 'text-error border-error/40 bg-error/10', icon: Shield },
  INACTIVE: { label: 'Inactive', color: 'text-text-muted border-border', icon: MessageSquare },
}

function RatingBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-muted w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(score / 5) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full bg-accent-indigo"
        />
      </div>
      <span className="text-xs text-text-secondary w-6 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm text-text-primary">{value}</p>
      </div>
    </div>
  )
}

export default function ManufacturerProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const [enquiryOpen, setEnquiryOpen] = useState(false)

  const { data: manufacturer, isLoading, error } = useManufacturer(slug)

  if (isLoading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="h-6 w-32 bg-surface-elevated rounded animate-pulse" />
        <div className="h-64 bg-surface-elevated rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-surface-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!manufacturer || error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h3 className="text-base font-medium text-text-primary">Manufacturer not found</h3>
        <Link href="/dashboard/manufacturers" className="mt-4">
          <Button variant="outline">Back to search</Button>
        </Link>
      </div>
    )
  }

  const connectionConfig = manufacturer.connectionStatus
    ? CONNECTION_STATUS_CONFIG[manufacturer.connectionStatus]
    : null

  const avgScores = manufacturer.ratings.length > 0 ? {
    quality: manufacturer.ratings.reduce((s, r) => s + r.qualityScore, 0) / manufacturer.ratings.length,
    communication: manufacturer.ratings.reduce((s, r) => s + r.communicationScore, 0) / manufacturer.ratings.length,
    timeliness: manufacturer.ratings.reduce((s, r) => s + r.timelinessScore, 0) / manufacturer.ratings.length,
  } : null

  const listItem = {
    id: manufacturer.id,
    profileId: manufacturer.profileId,
    slug: manufacturer.slug,
    displayName: manufacturer.displayName,
    country: manufacturer.country,
    city: manufacturer.city,
    heroImageUrl: manufacturer.heroImageUrl,
    specialisations: manufacturer.specialisations,
    certifications: manufacturer.certifications,
    priceTier: manufacturer.priceTier,
    moqMin: manufacturer.moqMin,
    bulkLeadTimeDays: manufacturer.bulkLeadTimeDays,
    ratingAvg: manufacturer.ratingAvg,
    ratingCount: manufacturer.ratingCount,
    isVerified: manufacturer.isVerified,
    isFeatured: manufacturer.isFeatured,
    responseTimeHours: manufacturer.responseTimeHours,
  }

  return (
    <>
      <div className="max-w-5xl space-y-6">
        {/* Back nav */}
        <Link
          href="/dashboard/manufacturers"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to manufacturers
        </Link>

        {/* Hero */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {/* Cover image */}
          <div className="h-52 bg-gradient-to-br from-surface-elevated to-background relative">
            {manufacturer.heroImageUrl ? (
              <img
                src={manufacturer.heroImageUrl}
                alt={manufacturer.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-text-muted opacity-30" />
              </div>
            )}
          </div>

          {/* Profile header */}
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-text-primary">
                    {manufacturer.displayName}
                  </h1>
                  {manufacturer.isVerified && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success/10 border border-success/20">
                      <CheckCircle2 className="w-3 h-3 text-success" />
                      <span className="text-[10px] font-medium text-success">Verified</span>
                    </div>
                  )}
                  {manufacturer.isFeatured && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent-indigo text-white">
                      Featured
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-text-muted">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{manufacturer.city ? `${manufacturer.city}, ` : ''}{manufacturer.country}</span>
                </div>
                {manufacturer.ratingAvg && manufacturer.ratingAvg > 0 ? (
                  <RatingStars
                    rating={manufacturer.ratingAvg}
                    count={manufacturer.ratingCount}
                    size="md"
                  />
                ) : null}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {connectionConfig ? (
                  <div className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium',
                    connectionConfig.color
                  )}>
                    <connectionConfig.icon className="w-3.5 h-3.5" />
                    {connectionConfig.label}
                  </div>
                ) : (
                  <Button onClick={() => setEnquiryOpen(true)} className="gap-2">
                    <Send className="w-4 h-4" />
                    Send enquiry
                  </Button>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
              <div className="text-center">
                <p className="text-xs text-text-muted">MOQ</p>
                <p className="text-lg font-bold text-text-primary">
                  {manufacturer.moqMin?.toLocaleString() ?? '—'}
                </p>
                {manufacturer.moqMax && (
                  <p className="text-xs text-text-muted">up to {manufacturer.moqMax.toLocaleString()}</p>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs text-text-muted">Sample lead time</p>
                <p className="text-lg font-bold text-text-primary">{manufacturer.sampleLeadTimeDays}d</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-muted">Bulk lead time</p>
                <p className="text-lg font-bold text-text-primary">{manufacturer.bulkLeadTimeDays}d</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-muted">Response time</p>
                <p className="text-lg font-bold text-text-primary">
                  {manufacturer.responseTimeHours
                    ? `~${Math.round(manufacturer.responseTimeHours)}h`
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Two column: details + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {manufacturer.description && (
              <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
                <h2 className="text-sm font-semibold text-text-primary">About</h2>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {manufacturer.description}
                </p>
              </div>
            )}

            {/* Specialisations + Materials */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
              <h2 className="text-sm font-semibold text-text-primary">Capabilities</h2>

              {manufacturer.specialisations.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Specialisations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {manufacturer.specialisations.map(spec => (
                      <span
                        key={spec}
                        className="px-2.5 py-1 rounded-full text-xs border border-border text-text-secondary"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {manufacturer.materials.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Materials</p>
                  <div className="flex flex-wrap gap-1.5">
                    {manufacturer.materials.map(mat => (
                      <span
                        key={mat}
                        className="px-2.5 py-1 rounded-full text-xs border border-border text-text-secondary"
                      >
                        {mat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {manufacturer.techPackFormats.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Tech pack formats</p>
                  <div className="flex flex-wrap gap-1.5">
                    {manufacturer.techPackFormats.map(fmt => (
                      <span
                        key={fmt}
                        className="px-2.5 py-1 rounded-full text-xs border border-accent-indigo/30 text-accent-indigo"
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Certifications */}
            {manufacturer.certifications.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-text-muted" />
                  <h2 className="text-sm font-semibold text-text-primary">Certifications</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {manufacturer.certifications.map(cert => (
                    <div
                      key={cert}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-success/30 bg-success/5"
                    >
                      <CheckCircle2 className="w-3 h-3 text-success" />
                      <span className="text-xs font-medium text-success">{cert}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ratings */}
            {manufacturer.ratings.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-warning" />
                  <h2 className="text-sm font-semibold text-text-primary">
                    Reviews ({manufacturer.ratingCount})
                  </h2>
                </div>

                {/* Score breakdown */}
                {avgScores && (
                  <div className="space-y-2 pb-4 border-b border-border">
                    <RatingBar label="Quality" score={avgScores.quality} />
                    <RatingBar label="Communication" score={avgScores.communication} />
                    <RatingBar label="Timeliness" score={avgScores.timeliness} />
                  </div>
                )}

                {/* Review cards */}
                <div className="space-y-4">
                  {manufacturer.ratings.map(rating => (
                    <motion.div
                      key={rating.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-surface-elevated border border-border flex items-center justify-center">
                            <span className="text-[10px] font-bold text-text-muted">
                              {rating.brandName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-text-primary">{rating.brandName}</p>
                            <p className="text-[10px] text-text-muted">
                              {rating.ordersCompleted} order{rating.ordersCompleted !== 1 ? 's' : ''} completed
                              {rating.isVerifiedPurchase ? ' · Verified' : ''}
                            </p>
                          </div>
                        </div>
                        <RatingStars rating={rating.overallScore} size="sm" showCount={false} />
                      </div>
                      {rating.review && (
                        <p className="text-sm text-text-secondary leading-relaxed pl-9">
                          {rating.review}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Company info */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
              <h2 className="text-sm font-semibold text-text-primary">Company info</h2>
              <div className="space-y-3">
                <InfoRow icon={MapPin} label="Location" value={manufacturer.city ? `${manufacturer.city}, ${manufacturer.country}` : manufacturer.country} />
                <InfoRow icon={Calendar} label="Est." value={manufacturer.yearEstablished?.toString()} />
                <InfoRow icon={Users} label="Team size" value={manufacturer.employeeCount} />
                <InfoRow icon={TrendingUp} label="Price tier" value={PRICE_TIER_LABELS[manufacturer.priceTier] ?? manufacturer.priceTier} />
                {manufacturer.monthlyCapacityMin && (
                  <div className="flex items-start gap-3">
                    <Package className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-text-muted">Monthly capacity</p>
                      <p className="text-sm text-text-primary">
                        {manufacturer.monthlyCapacityMin.toLocaleString()}
                        {manufacturer.monthlyCapacityMax
                          ? `–${manufacturer.monthlyCapacityMax.toLocaleString()}`
                          : '+'} units
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Export markets */}
            {manufacturer.exportMarkets.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-text-muted" />
                  <h2 className="text-sm font-semibold text-text-primary">Export markets</h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {manufacturer.exportMarkets.map(m => (
                    <span key={m} className="px-2 py-0.5 rounded text-xs border border-border text-text-muted">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {manufacturer.languages.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-text-muted" />
                  <h2 className="text-sm font-semibold text-text-primary">Languages</h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {manufacturer.languages.map(lang => (
                    <span key={lang} className="px-2 py-0.5 rounded text-xs border border-border text-text-muted">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            {!connectionConfig && (
              <div className="rounded-xl border border-accent-indigo/30 bg-accent-indigo/5 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  Ready to connect?
                </h3>
                <p className="text-xs text-text-muted">
                  Send a direct enquiry and receive a response within{' '}
                  {manufacturer.responseTimeHours
                    ? `~${Math.round(manufacturer.responseTimeHours)} hours`
                    : '48 hours'}.
                </p>
                <Button
                  onClick={() => setEnquiryOpen(true)}
                  className="w-full gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send enquiry
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enquiry modal */}
      <EnquiryModal
        manufacturer={listItem}
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
      />
    </>
  )
}
