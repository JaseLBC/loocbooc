/**
 * Frontend types for the Manufacturer Marketplace.
 * These map to the Prisma ManufacturerProfile + Manufacturer models.
 */

export interface ManufacturerListItem {
  id: string
  profileId: string
  slug: string
  displayName: string
  country: string
  city: string | null
  heroImageUrl: string | null
  specialisations: string[]
  certifications: string[]
  priceTier: string | null
  moqMin: number | null
  bulkLeadTimeDays: number | null
  ratingAvg: number | null
  ratingCount: number
  isVerified: boolean
  isFeatured: boolean
  responseTimeHours: number | null
}

export interface ManufacturerProfile {
  id: string
  profileId: string
  slug: string
  displayName: string
  description: string | null
  country: string
  city: string | null
  heroImageUrl: string | null
  galleryImageUrls: string[]
  videoUrl: string | null
  yearEstablished: number | null
  employeeCount: string | null
  monthlyCapacityMin: number | null
  monthlyCapacityMax: number | null
  moqMin: number
  moqMax: number | null
  sampleLeadTimeDays: number
  bulkLeadTimeDays: number
  specialisations: string[]
  materials: string[]
  certifications: string[]
  exportMarkets: string[]
  priceTier: string
  techPackFormats: string[]
  languages: string[]
  isVerified: boolean
  isFeatured: boolean
  responseTimeHours: number | null
  ratingAvg: number | null
  ratingCount: number
  ratings: ManufacturerRating[]
  connectionStatus: ConnectionStatus | null
}

export interface ManufacturerRating {
  id: string
  brandName: string
  overallScore: number
  qualityScore: number
  communicationScore: number
  timelinessScore: number
  review: string | null
  ordersCompleted: number
  isVerifiedPurchase: boolean
  createdAt: string
}

export type ConnectionStatus =
  | 'ENQUIRY'
  | 'RESPONDED'
  | 'CONNECTED'
  | 'DECLINED'
  | 'INACTIVE'

export interface BrandConnection {
  id: string
  manufacturerProfileId: string
  manufacturerSlug: string
  manufacturerName: string
  manufacturerCountry: string
  manufacturerHeroImageUrl: string | null
  status: ConnectionStatus
  enquiryMessage: string | null
  respondedAt: string | null
  connectedAt: string | null
  createdAt: string
}

export interface ManufacturerFilters {
  search?: string
  country?: string[]
  specialisations?: string[]
  priceTiers?: string[]
  certifications?: string[]
  maxMoq?: number
  verifiedOnly?: boolean
  page?: number
  limit?: number
}

export interface ManufacturerListResponse {
  manufacturers: ManufacturerListItem[]
  total: number
  page: number
  limit: number
}

export interface SendEnquiryInput {
  manufacturerProfileId: string
  message: string
  estimatedQuantity?: number
  targetDeliveryDate?: string
  productCategory?: string
}

export interface RateManufacturerInput {
  manufacturerProfileId: string
  overallScore: number
  qualityScore: number
  communicationScore: number
  timelinessScore: number
  review?: string
}

export interface CreateProfileInput {
  displayName: string
  description?: string
  country: string
  city?: string
  moqMin: number
  moqMax?: number
  sampleLeadTimeDays: number
  bulkLeadTimeDays: number
  priceTier: string
  specialisations: string[]
  materials: string[]
  certifications: string[]
  exportMarkets: string[]
  techPackFormats: string[]
  languages: string[]
  monthlyCapacityMin?: number
  monthlyCapacityMax?: number
  yearEstablished?: number
  employeeCount?: string
}
