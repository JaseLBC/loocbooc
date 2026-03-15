/**
 * Back It module types — brand dashboard view.
 * Extends the shared types from @loocbooc/types with UI-specific interfaces.
 */

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'moq_reached'
  | 'funded'
  | 'in_production'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'expired'

export type BackingStatus = 'active' | 'cancelled' | 'refunded' | 'fulfilled'

export interface CampaignListItem {
  id: string
  slug: string
  title: string
  status: CampaignStatus
  garmentId: string
  garmentName: string | null
  garmentCategory: string | null

  // Pricing
  retailPriceCents: number
  backerPriceCents: number
  depositPercent: number
  currency: string

  // Progress
  moq: number
  currentBackingCount: number
  moqReached: boolean
  moqReachedAt: string | null
  stretchGoalQty: number | null
  percentComplete: number

  // Timeline
  campaignStart: string
  campaignEnd: string
  estimatedShipDate: string | null

  // Assets
  coverImageUrl: string | null

  // Revenue estimates
  projectedRevenueCents: number
  collectedDepositsCents: number

  createdAt: string
  updatedAt: string
}

export interface CampaignDetail extends CampaignListItem {
  description: string | null
  availableSizes: string[]
  sizeLimits: Record<string, number> | null
  manufacturerId: string | null
  manufacturerName: string | null
  shopifyProductId: string | null
  shopifyStoreUrl: string | null
  galleryUrls: string[]
  manufacturerNotifiedAt: string | null

  // Analytics
  sizeBreakdown: SizeBreak[]
  recentBackings: BackingPreview[]
  events: CampaignEvent[]
  dailyBackings: DailyBackingPoint[]
}

export interface SizeBreak {
  size: string
  count: number
  percent: number
}

export interface BackingPreview {
  id: string
  size: string
  quantity: number
  totalCents: number
  currency: string
  status: BackingStatus
  createdAt: string
  // Consumer info (anonymised in list)
  displayName: string
  country: string | null
}

export interface CampaignEvent {
  id: string
  eventType: string
  createdAt: string
  payload: Record<string, unknown>
}

export interface DailyBackingPoint {
  date: string
  count: number
  cumulative: number
}

export interface CampaignListResponse {
  campaigns: CampaignListItem[]
  total: number
  page: number
  limit: number
  stats: CampaignStats
}

export interface CampaignStats {
  totalActive: number
  totalDraft: number
  totalCompleted: number
  totalRevenueCents: number
  totalBackers: number
}

export interface CreateCampaignInput {
  garmentId: string
  title: string
  description?: string
  slug: string
  retailPriceCents: number
  backerPriceCents: number
  depositPercent: number
  currency: string
  moq: number
  stretchGoalQty?: number
  campaignStart: string   // ISO 8601
  campaignEnd: string     // ISO 8601
  estimatedShipDate?: string  // YYYY-MM-DD
  manufacturerId?: string
  availableSizes: string[]
  sizeLimits?: Record<string, number>
}

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
  status?: 'active' | 'cancelled'
}

export interface CampaignFilters {
  status?: CampaignStatus | 'all'
  search?: string
  page?: number
  limit?: number
}
