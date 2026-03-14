import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { GarmentCategory, GarmentStatus, GarmentSeason, FabricPhysics, FabricPhysicsLabels } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatRelative(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = now - then
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) return `~${seconds} seconds`
  const minutes = Math.ceil(seconds / 60)
  return `~${minutes} minute${minutes > 1 ? 's' : ''}`
}

export const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  top: 'Top',
  bottom: 'Bottom',
  dress: 'Dress',
  outerwear: 'Outerwear',
  suit: 'Suit',
  activewear: 'Activewear',
  swimwear: 'Swimwear',
  underwear: 'Underwear',
  accessory: 'Accessory',
  footwear: 'Footwear',
  other: 'Other',
}

export const SEASON_LABELS: Record<GarmentSeason, string> = {
  SS: 'Spring/Summer',
  AW: 'Autumn/Winter',
  'all-season': 'All Season',
  resort: 'Resort',
}

export const STATUS_LABELS: Record<GarmentStatus, string> = {
  draft: 'Draft',
  processing: 'Processing',
  active: 'Active',
  error: 'Error',
}

export const STATUS_COLORS: Record<GarmentStatus, string> = {
  draft: 'text-text-muted bg-surface-elevated border-border',
  processing: 'text-warning bg-warning/10 border-warning/20',
  active: 'text-success bg-success/10 border-success/20',
  error: 'text-error bg-error/10 border-error/20',
}

export function getFabricPhysicsLabels(physics: FabricPhysics): FabricPhysicsLabels {
  const label = (value: number, low: string, mid: string, high: string): string => {
    if (value < 35) return low
    if (value < 65) return mid
    return high
  }

  return {
    drape: label(physics.drape, 'Structured', 'Medium', 'Fluid'),
    stretch: label(physics.stretch, 'None', 'Moderate', 'High'),
    weight: label(physics.weight, 'Lightweight', 'Medium', 'Heavy'),
  }
}

export function generateMockUGI(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const parts = [4, 4, 4].map(() =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  )
  return `LB-${parts.join('-')}`
}

// Simulate photo quality assessment (real version would use CV API)
export function assessPhotoQuality(file: File): 'good' | 'warning' | 'unusable' {
  // In production, send to API for quality assessment
  // For MVP: basic checks
  const sizeKB = file.size / 1024
  if (sizeKB < 50) return 'unusable'
  if (sizeKB < 200) return 'warning'
  return 'good'
}

export function getQualityReason(quality: 'good' | 'warning' | 'unusable', file: File): string | undefined {
  if (quality === 'good') return undefined
  const sizeKB = file.size / 1024
  if (quality === 'unusable') {
    if (sizeKB < 50) return 'File too small — likely too low resolution'
    return 'Image quality too low for 3D reconstruction'
  }
  if (quality === 'warning') {
    if (sizeKB < 200) return 'Low resolution — may affect 3D quality'
    return 'Slightly low resolution'
  }
  return undefined
}
