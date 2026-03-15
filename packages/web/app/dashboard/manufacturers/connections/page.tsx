'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, MessageSquare, CheckCircle2, Clock, XCircle,
  ArrowRight, Package, MapPin, Plug,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMyConnections } from '@/hooks/useManufacturers'
import { cn } from '@/lib/utils'
import type { BrandConnection, ConnectionStatus } from '@/types/manufacturer'

const STATUS_CONFIG: Record<ConnectionStatus, {
  label: string
  description: string
  color: string
  icon: typeof MessageSquare
  priority: number
}> = {
  RESPONDED: {
    label: 'Response received',
    description: 'The manufacturer has replied — review and decide.',
    color: 'text-accent-indigo bg-accent-indigo/10 border-accent-indigo/30',
    icon: MessageSquare,
    priority: 1,
  },
  ENQUIRY: {
    label: 'Awaiting response',
    description: 'Your enquiry has been sent.',
    color: 'text-warning bg-warning/10 border-warning/30',
    icon: Clock,
    priority: 2,
  },
  CONNECTED: {
    label: 'Connected',
    description: 'You are connected with this manufacturer.',
    color: 'text-success bg-success/10 border-success/30',
    icon: CheckCircle2,
    priority: 3,
  },
  DECLINED: {
    label: 'Declined',
    description: 'The manufacturer declined this enquiry.',
    color: 'text-error bg-error/10 border-error/30',
    icon: XCircle,
    priority: 4,
  },
  INACTIVE: {
    label: 'Inactive',
    description: 'This connection is no longer active.',
    color: 'text-text-muted bg-surface-elevated border-border',
    icon: Clock,
    priority: 5,
  },
}

function ConnectionCard({ connection, index }: { connection: BrandConnection; index: number }) {
  const config = STATUS_CONFIG[connection.status]
  const Icon = config.icon

  const timeSince = (dateStr: string) => {
    const ms = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(ms / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="rounded-xl border border-border bg-surface p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Manufacturer info */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center shrink-0">
            {connection.manufacturerHeroImageUrl ? (
              <img
                src={connection.manufacturerHeroImageUrl}
                alt={connection.manufacturerName}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Package className="w-5 h-5 text-text-muted" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {connection.manufacturerName}
            </h3>
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <MapPin className="w-3 h-3" />
              <span>{connection.manufacturerCountry}</span>
              <span className="text-border mx-1">·</span>
              <span>{timeSince(connection.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium shrink-0',
          config.color
        )}>
          <Icon className="w-3 h-3" />
          {config.label}
        </div>
      </div>

      {/* Enquiry message preview */}
      {connection.enquiryMessage && (
        <div className="bg-surface-elevated rounded-lg p-3">
          <p className="text-xs text-text-muted mb-1">Your enquiry</p>
          <p className="text-sm text-text-secondary line-clamp-2">
            {connection.enquiryMessage}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span>Sent {timeSince(connection.createdAt)}</span>
        {connection.respondedAt && (
          <>
            <span>·</span>
            <span>Responded {timeSince(connection.respondedAt)}</span>
          </>
        )}
        {connection.connectedAt && (
          <>
            <span>·</span>
            <span>Connected {timeSince(connection.connectedAt)}</span>
          </>
        )}
      </div>

      {/* Action */}
      <div className="pt-1 border-t border-border">
        <Link href={`/dashboard/manufacturers/${connection.manufacturerSlug}`}>
          <Button variant="outline" size="sm" className="gap-2 w-full">
            View profile
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}

export default function ConnectionsPage() {
  const { data: connections, isLoading } = useMyConnections()

  const sorted = [...(connections ?? [])].sort((a, b) =>
    STATUS_CONFIG[a.status].priority - STATUS_CONFIG[b.status].priority
  )

  const activeCount = sorted.filter(c => ['ENQUIRY', 'RESPONDED', 'CONNECTED'].includes(c.status)).length

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/manufacturers"
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Manufacturers
        </Link>
        <span className="text-border">/</span>
        <span className="text-sm text-text-primary">My connections</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">My connections</h1>
        {!isLoading && (
          <p className="text-sm text-text-muted mt-1">
            {activeCount} active {activeCount === 1 ? 'connection' : 'connections'}
          </p>
        )}
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-3">
        {(Object.keys(STATUS_CONFIG) as ConnectionStatus[]).map(status => {
          const cfg = STATUS_CONFIG[status]
          const count = sorted.filter(c => c.status === status).length
          if (count === 0) return null
          return (
            <div key={status} className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium',
              cfg.color
            )}>
              <cfg.icon className="w-3 h-3" />
              {cfg.label} ({count})
            </div>
          )
        })}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-surface-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-border bg-surface">
          <Plug className="w-10 h-10 text-text-muted mb-4" />
          <h3 className="text-base font-medium text-text-primary">No connections yet</h3>
          <p className="text-sm text-text-muted mt-1 max-w-sm">
            Send an enquiry to a manufacturer to start a connection.
          </p>
          <Link href="/dashboard/manufacturers" className="mt-4">
            <Button>Browse manufacturers</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((conn, i) => (
            <ConnectionCard key={conn.id} connection={conn} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
