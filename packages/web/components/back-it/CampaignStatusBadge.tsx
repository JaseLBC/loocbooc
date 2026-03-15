import { cn } from '@/lib/utils'
import type { CampaignStatus } from '@/types/back-it'

interface StatusConfig {
  label: string
  className: string
  dot: string
}

const STATUS_CONFIG: Record<CampaignStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    className: 'text-text-muted bg-surface-elevated border-border',
    dot: 'bg-text-muted',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'text-accent-indigo bg-accent-indigo/10 border-accent-indigo/30',
    dot: 'bg-accent-indigo',
  },
  active: {
    label: 'Live',
    className: 'text-success bg-success/10 border-success/30',
    dot: 'bg-success animate-pulse',
  },
  moq_reached: {
    label: 'MOQ reached',
    className: 'text-accent-indigo bg-accent-indigo/10 border-accent-indigo/30',
    dot: 'bg-accent-indigo',
  },
  funded: {
    label: 'Funded',
    className: 'text-success bg-success/10 border-success/30',
    dot: 'bg-success',
  },
  in_production: {
    label: 'In production',
    className: 'text-warning bg-warning/10 border-warning/30',
    dot: 'bg-warning',
  },
  shipped: {
    label: 'Shipped',
    className: 'text-accent-indigo bg-accent-indigo/10 border-accent-indigo/30',
    dot: 'bg-accent-indigo',
  },
  completed: {
    label: 'Completed',
    className: 'text-text-muted bg-surface-elevated border-border',
    dot: 'bg-text-muted',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'text-error bg-error/10 border-error/30',
    dot: 'bg-error',
  },
  expired: {
    label: 'Expired',
    className: 'text-error bg-error/10 border-error/30',
    dot: 'bg-error',
  },
}

export function CampaignStatusBadge({
  status,
  size = 'sm',
}: {
  status: CampaignStatus
  size?: 'xs' | 'sm'
}) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        cfg.className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
