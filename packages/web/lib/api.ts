import { getStoredAuth } from '@/lib/auth'
import type {
  Garment,
  GarmentListResponse,
  GarmentFilters,
  CreateGarmentInput,
  ScanStatus,
  FabricPhysics,
  BrandStats,
} from '@/types'
import type {
  CampaignListItem,
  CampaignDetail,
  CampaignListResponse,
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignFilters,
} from '@/types/back-it'
import type {
  ManufacturerListItem,
  ManufacturerProfile,
  ManufacturerListResponse,
  ManufacturerFilters,
  BrandConnection,
  SendEnquiryInput,
  RateManufacturerInput,
  CreateProfileInput,
} from '@/types/manufacturer'
import { generateMockUGI } from '@/lib/utils'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const API_V1 = `${BASE_URL}/api/v1`

// ---- HTTP Client ----

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const auth = getStoredAuth()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (auth?.apiKey) {
    headers['X-API-Key'] = auth.apiKey
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error((error as { message?: string }).message || `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ---- Mock Data ----

function generateMockGarments(count = 12): Garment[] {
  const categories = ['tops', 'bottoms', 'dresses', 'outerwear', 'activewear'] as const
  const statuses = ['active', 'active', 'active', 'processing', 'draft'] as const
  const names = [
    'Oversized Linen Blazer', 'Ribbed Knit Dress', 'Wide Leg Trousers',
    'Silk Slip Skirt', 'Cropped Hoodie', 'Tailored Coat',
    'Wrap Midi Dress', 'High Rise Jeans', 'Sheer Blouse',
    'Structured Tote', 'Cashmere Sweater', 'Pleated Midi Skirt',
  ]

  return Array.from({ length: count }, (_, i) => ({
    ugi: generateMockUGI(),
    name: names[i % names.length],
    category: categories[i % categories.length],
    season: 'AW' as const,
    sku: `SKU-${String(i + 1).padStart(4, '0')}`,
    description: 'Premium quality garment with attention to detail.',
    fabricComposition: '80% Wool, 20% Cashmere',
    fabricPhysics: {
      drape: 45 + (i * 7) % 40,
      stretch: 15 + (i * 11) % 60,
      weight: 30 + (i * 13) % 50,
      breathability: 40 + (i * 9) % 45,
      sheen: 10 + (i * 5) % 30,
    },
    status: statuses[i % statuses.length],
    hasModel3D: i % 3 !== 0,
    createdAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - i * 43200000).toISOString(),
    brandId: 'brand-charcoal',
    tryOnCount: Math.floor(Math.random() * 500),
  }))
}

const MOCK_GARMENTS = generateMockGarments(12)

// ---- API Client ----

export const api = {
  garments: {
    list: async (filters?: GarmentFilters): Promise<GarmentListResponse> => {
      try {
        const params = new URLSearchParams()
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined) params.set(key, String(value))
          })
        }
        return await request<GarmentListResponse>(`/api/v1/garments?${params}`)
      } catch {
        // Mock fallback
        await new Promise(r => setTimeout(r, 400))
        let garments = [...MOCK_GARMENTS]

        if (filters?.search) {
          const q = filters.search.toLowerCase()
          garments = garments.filter(g =>
            g.name.toLowerCase().includes(q) ||
            g.ugi.toLowerCase().includes(q) ||
            g.category.toLowerCase().includes(q)
          )
        }
        if (filters?.category) {
          garments = garments.filter(g => g.category === filters.category)
        }
        if (filters?.status) {
          garments = garments.filter(g => g.status === filters.status)
        }

        return {
          items: garments,
          total: garments.length,
          page: filters?.page ?? 1,
          page_size: filters?.limit ?? 20,
          has_next: false,
        }
      }
    },

    get: async (ugi: string): Promise<Garment> => {
      try {
        return await request<Garment>(`/api/v1/garments/${ugi}`)
      } catch {
        await new Promise(r => setTimeout(r, 300))
        const found = MOCK_GARMENTS.find(g => g.ugi === ugi)
        if (found) return found
        // Return a default mock
        return {
          ugi,
          name: 'Sample Garment',
          category: 'top',
          status: 'active',
          hasModel3D: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          brandId: 'brand-charcoal',
        }
      }
    },

    create: async (data: CreateGarmentInput): Promise<Garment> => {
      try {
        return await request<Garment>('/api/v1/garments', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      } catch {
        await new Promise(r => setTimeout(r, 1200))
        const newGarment: Garment = {
          ugi: generateMockUGI(),
          ...data,
          category: data.category,
          status: 'processing',
          hasModel3D: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          brandId: 'brand-charcoal',
        }
        MOCK_GARMENTS.unshift(newGarment)
        return newGarment
      }
    },

    uploadFiles: async (ugi: string, files: File[]): Promise<void> => {
      // API accepts one file per request — upload sequentially
      const auth = getStoredAuth()
      const headers: Record<string, string> = auth?.apiKey
        ? { 'X-API-Key': auth.apiKey }
        : {}

      try {
        for (const file of files) {
          const formData = new FormData()
          formData.append('file', file)  // API param name is 'file' (singular)
          const res = await fetch(`${BASE_URL}/api/v1/garments/${ugi}/files`, {
            method: 'POST',
            headers,
            body: formData,
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
            throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`)
          }
        }
      } catch {
        await new Promise(r => setTimeout(r, 800))
      }
    },

    getScanStatus: async (ugi: string): Promise<ScanStatus> => {
      try {
        return await request<ScanStatus>(`/api/v1/garments/${ugi}/scan/status`)
      } catch {
        // Mock progressive pipeline for development
        await new Promise(r => setTimeout(r, 200))
        const garment = MOCK_GARMENTS.find(g => g.ugi === ugi)
        const isProcessing = garment?.status === 'processing'

        return {
          ugi,
          status: isProcessing ? 'processing' : 'active',
          stages: [
            { id: 'upload', label: 'Files uploaded', status: 'complete' },
            { id: 'analyse', label: 'Analysing photos', status: 'complete', detail: '12/12' },
            { id: 'model', label: 'Building 3D model', status: isProcessing ? 'running' : 'complete', progress: isProcessing ? 65 : 100 },
            { id: 'physics', label: 'Applying fabric physics', status: isProcessing ? 'pending' : 'complete' },
            { id: 'finalise', label: 'Finalising', status: isProcessing ? 'pending' : 'complete' },
          ],
          estimatedSecondsRemaining: isProcessing ? 180 : 0,
        }
      }
    },
  },

  scan: {
    label: async (imageFile: File): Promise<string> => {
      try {
        const formData = new FormData()
        formData.append('image', imageFile)
        const result = await request<{ composition: string }>('/api/v1/scan/label', {
          method: 'POST',
          headers: {},
          body: formData,
        })
        return result.composition
      } catch {
        await new Promise(r => setTimeout(r, 1500))
        // Mock OCR result
        return '85% Polyester, 15% Elastane'
      }
    },
  },

  fabrics: {
    getPhysics: async (composition: string): Promise<FabricPhysics> => {
      try {
        return await request<FabricPhysics>('/api/v1/fabrics/physics', {
          method: 'POST',
          body: JSON.stringify({ composition }),
        })
      } catch {
        await new Promise(r => setTimeout(r, 600))
        // Mock physics derivation from composition keywords
        const lower = composition.toLowerCase()
        const isElastic = lower.includes('elastane') || lower.includes('spandex') || lower.includes('lycra')
        const isSilk = lower.includes('silk') || lower.includes('satin')
        const isWool = lower.includes('wool') || lower.includes('cashmere')
        const isLinen = lower.includes('linen') || lower.includes('cotton')

        return {
          drape: isSilk ? 82 : isLinen ? 35 : isWool ? 55 : 60,
          stretch: isElastic ? 85 : isLinen ? 10 : isWool ? 20 : 30,
          weight: isWool ? 65 : isSilk ? 30 : isLinen ? 45 : 40,
          breathability: isLinen ? 85 : isSilk ? 70 : isWool ? 60 : 40,
          sheen: isSilk ? 80 : 20,
        }
      }
    },
  },

  brand: {
    getStats: async (): Promise<BrandStats> => {
      try {
        return await request<BrandStats>('/api/v1/brand/stats')
      } catch {
        await new Promise(r => setTimeout(r, 300))
        return {
          totalGarments: MOCK_GARMENTS.length,
          garmentsWith3D: MOCK_GARMENTS.filter(g => g.hasModel3D).length,
          totalTryOns: 2847,
          lastActivityAt: new Date(Date.now() - 3600000).toISOString(),
        }
      }
    },
  },
}

// ─────────────────────────────────────────────────────────────
// MANUFACTURER MARKETPLACE MOCK DATA
// ─────────────────────────────────────────────────────────────

const MOCK_MANUFACTURERS: ManufacturerListItem[] = [
  {
    id: 'mfr-001', profileId: 'prof-001', slug: 'orient-textile-hangzhou',
    displayName: 'Orient Textile — Hangzhou',
    country: 'CN', city: 'Hangzhou',
    heroImageUrl: null,
    specialisations: ['Woven', 'Knitwear', 'Outerwear'],
    certifications: ['OEKO-TEX', 'ISO 9001'],
    priceTier: 'mid',
    moqMin: 200, bulkLeadTimeDays: 45,
    ratingAvg: 4.3, ratingCount: 18,
    isVerified: true, isFeatured: true,
    responseTimeHours: 12,
  },
  {
    id: 'mfr-002', profileId: 'prof-002', slug: 'artisan-mills-bangalore',
    displayName: 'Artisan Mills — Bangalore',
    country: 'IN', city: 'Bangalore',
    heroImageUrl: null,
    specialisations: ['Knitwear', 'Activewear', 'Swimwear'],
    certifications: ['GOTS', 'Fair Trade', 'OEKO-TEX'],
    priceTier: 'mid',
    moqMin: 100, bulkLeadTimeDays: 60,
    ratingAvg: 4.7, ratingCount: 31,
    isVerified: true, isFeatured: false,
    responseTimeHours: 8,
  },
  {
    id: 'mfr-003', profileId: 'prof-003', slug: 'euro-stitch-porto',
    displayName: 'EuroStitch — Porto',
    country: 'PT', city: 'Porto',
    heroImageUrl: null,
    specialisations: ['Suits', 'Woven', 'Outerwear'],
    certifications: ['BSCI', 'ISO 9001'],
    priceTier: 'premium',
    moqMin: 50, bulkLeadTimeDays: 90,
    ratingAvg: 4.9, ratingCount: 12,
    isVerified: true, isFeatured: true,
    responseTimeHours: 24,
  },
  {
    id: 'mfr-004', profileId: 'prof-004', slug: 'delta-apparel-dhaka',
    displayName: 'Delta Apparel — Dhaka',
    country: 'BD', city: 'Dhaka',
    heroImageUrl: null,
    specialisations: ['Woven', 'Denim'],
    certifications: ['BSCI'],
    priceTier: 'mass',
    moqMin: 500, bulkLeadTimeDays: 55,
    ratingAvg: 3.8, ratingCount: 7,
    isVerified: false, isFeatured: false,
    responseTimeHours: 48,
  },
  {
    id: 'mfr-005', profileId: 'prof-005', slug: 'saigon-fashion-group',
    displayName: 'Saigon Fashion Group',
    country: 'VN', city: 'Ho Chi Minh City',
    heroImageUrl: null,
    specialisations: ['Activewear', 'Swimwear', 'Knitwear'],
    certifications: ['OEKO-TEX', 'Bluesign'],
    priceTier: 'mid',
    moqMin: 150, bulkLeadTimeDays: 50,
    ratingAvg: 4.5, ratingCount: 22,
    isVerified: true, isFeatured: false,
    responseTimeHours: 18,
  },
  {
    id: 'mfr-006', profileId: 'prof-006', slug: 'atelier-istanbul',
    displayName: 'Atelier Istanbul',
    country: 'TR', city: 'Istanbul',
    heroImageUrl: null,
    specialisations: ['Leather', 'Denim', 'Suits'],
    certifications: ['OEKO-TEX', 'SA8000'],
    priceTier: 'premium',
    moqMin: 75, bulkLeadTimeDays: 75,
    ratingAvg: 4.6, ratingCount: 9,
    isVerified: true, isFeatured: false,
    responseTimeHours: 16,
  },
  {
    id: 'mfr-007', profileId: 'prof-007', slug: 'pacific-thread-sydney',
    displayName: 'Pacific Thread — Sydney',
    country: 'AU', city: 'Sydney',
    heroImageUrl: null,
    specialisations: ['Woven', 'Knitwear', 'Accessories'],
    certifications: ['GOTS', 'Fair Trade'],
    priceTier: 'premium',
    moqMin: 30, bulkLeadTimeDays: 30,
    ratingAvg: 4.8, ratingCount: 5,
    isVerified: true, isFeatured: false,
    responseTimeHours: 4,
  },
  {
    id: 'mfr-008', profileId: 'prof-008', slug: 'milan-luxury-studio',
    displayName: 'Milan Luxury Studio',
    country: 'IT', city: 'Milan',
    heroImageUrl: null,
    specialisations: ['Suits', 'Leather', 'Accessories'],
    certifications: ['ISO 9001'],
    priceTier: 'luxury',
    moqMin: 20, bulkLeadTimeDays: 120,
    ratingAvg: 5.0, ratingCount: 4,
    isVerified: true, isFeatured: true,
    responseTimeHours: 48,
  },
]

const MOCK_RATINGS = [
  {
    id: 'rat-001', brandName: 'Harbour & Co.', overallScore: 5,
    qualityScore: 5, communicationScore: 4, timelinessScore: 5,
    review: 'Outstanding craftsmanship. Delivered on spec, 3 days early. Will be back for SS26.',
    ordersCompleted: 3, isVerifiedPurchase: true,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'rat-002', brandName: 'Solstice Apparel', overallScore: 4,
    qualityScore: 4, communicationScore: 5, timelinessScore: 4,
    review: 'Very responsive. Minor size grading issue on first sample but quickly resolved.',
    ordersCompleted: 1, isVerifiedPurchase: true,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 'rat-003', brandName: 'The Label', overallScore: 4,
    qualityScore: 5, communicationScore: 4, timelinessScore: 3,
    review: 'Quality is exceptional. Lead time ran 2 weeks over. Communication was always clear.',
    ordersCompleted: 2, isVerifiedPurchase: true,
    createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
  },
]

function getMockManufacturerProfile(slug: string): ManufacturerProfile | null {
  const item = MOCK_MANUFACTURERS.find(m => m.slug === slug)
  if (!item) return null

  return {
    ...item,
    description: `${item.displayName} is a leading apparel manufacturer specialising in ${item.specialisations.join(', ').toLowerCase()}. With a commitment to quality and ethical production, we serve brands across ${item.exportMarkets?.join(', ') ?? 'the globe'}.`,
    galleryImageUrls: [],
    videoUrl: null,
    yearEstablished: 2005 + parseInt(item.id.replace('mfr-', '')) * 2,
    employeeCount: item.priceTier === 'mass' ? '500-2000' : item.priceTier === 'luxury' ? '10-50' : '100-500',
    monthlyCapacityMin: item.moqMin ? item.moqMin * 5 : null,
    monthlyCapacityMax: item.moqMin ? item.moqMin * 20 : null,
    moqMin: item.moqMin ?? 100,
    moqMax: null,
    sampleLeadTimeDays: Math.round((item.bulkLeadTimeDays ?? 60) * 0.4),
    bulkLeadTimeDays: item.bulkLeadTimeDays ?? 60,
    materials: ['Cotton', 'Polyester', 'Viscose', 'Elastane'].slice(0, 3),
    exportMarkets: ['AU', 'US', 'UK', 'EU'],
    techPackFormats: ['PDF', 'Excel', 'CLO3D'],
    languages: ['English', 'Mandarin'].slice(0, item.country === 'CN' ? 2 : 1),
    ratings: MOCK_RATINGS,
    connectionStatus: null,
  }
}

const MOCK_CONNECTIONS: BrandConnection[] = [
  {
    id: 'conn-001',
    manufacturerProfileId: 'prof-001',
    manufacturerSlug: 'orient-textile-hangzhou',
    manufacturerName: 'Orient Textile — Hangzhou',
    manufacturerCountry: 'CN',
    manufacturerHeroImageUrl: null,
    status: 'CONNECTED',
    enquiryMessage: 'Looking for a woven partner for our AW26 collection.',
    respondedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    connectedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'conn-002',
    manufacturerProfileId: 'prof-003',
    manufacturerSlug: 'euro-stitch-porto',
    manufacturerName: 'EuroStitch — Porto',
    manufacturerCountry: 'PT',
    manufacturerHeroImageUrl: null,
    status: 'RESPONDED',
    enquiryMessage: 'Interested in your tailored suit capabilities for our workwear range.',
    respondedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    connectedAt: null,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'conn-003',
    manufacturerProfileId: 'prof-005',
    manufacturerSlug: 'saigon-fashion-group',
    manufacturerName: 'Saigon Fashion Group',
    manufacturerCountry: 'VN',
    manufacturerHeroImageUrl: null,
    status: 'ENQUIRY',
    enquiryMessage: 'Looking for an activewear partner for our Back It campaign.',
    respondedAt: null,
    connectedAt: null,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
]

// ─── Manufacturer API namespace ───────────────────────────────

export const manufacturerApi = {
  list: async (filters?: ManufacturerFilters): Promise<ManufacturerListResponse> => {
    try {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined) params.set(k, Array.isArray(v) ? v.join(',') : String(v))
        })
      }
      return await request<ManufacturerListResponse>(`/api/v1/manufacturers?${params}`)
    } catch {
      await new Promise(r => setTimeout(r, 500))
      let results = [...MOCK_MANUFACTURERS]

      if (filters?.search) {
        const q = filters.search.toLowerCase()
        results = results.filter(m =>
          m.displayName.toLowerCase().includes(q) ||
          m.country.toLowerCase().includes(q) ||
          (m.city?.toLowerCase().includes(q) ?? false) ||
          m.specialisations.some(s => s.toLowerCase().includes(q))
        )
      }
      if (filters?.country?.length) {
        results = results.filter(m => filters.country!.includes(m.country))
      }
      if (filters?.specialisations?.length) {
        results = results.filter(m =>
          filters.specialisations!.some(s => m.specialisations.includes(s))
        )
      }
      if (filters?.priceTiers?.length) {
        results = results.filter(m => m.priceTier && filters.priceTiers!.includes(m.priceTier))
      }
      if (filters?.certifications?.length) {
        results = results.filter(m =>
          filters.certifications!.some(c => m.certifications.includes(c))
        )
      }
      if (filters?.maxMoq !== undefined) {
        results = results.filter(m => (m.moqMin ?? 0) <= filters.maxMoq!)
      }
      if (filters?.verifiedOnly) {
        results = results.filter(m => m.isVerified)
      }

      const page = filters?.page ?? 1
      const limit = filters?.limit ?? 12
      const start = (page - 1) * limit
      return {
        manufacturers: results.slice(start, start + limit),
        total: results.length,
        page,
        limit,
      }
    }
  },

  getBySlug: async (slug: string): Promise<ManufacturerProfile | null> => {
    try {
      return await request<ManufacturerProfile>(`/api/v1/manufacturers/${slug}`)
    } catch {
      await new Promise(r => setTimeout(r, 300))
      return getMockManufacturerProfile(slug)
    }
  },

  sendEnquiry: async (input: SendEnquiryInput): Promise<{ connectionId: string }> => {
    try {
      return await request<{ connectionId: string }>('/api/v1/manufacturers/connections', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    } catch {
      await new Promise(r => setTimeout(r, 800))
      return { connectionId: `conn-${Date.now()}` }
    }
  },

  getConnections: async (): Promise<BrandConnection[]> => {
    try {
      return await request<BrandConnection[]>('/api/v1/manufacturers/connections/mine')
    } catch {
      await new Promise(r => setTimeout(r, 400))
      return MOCK_CONNECTIONS
    }
  },

  rate: async (input: RateManufacturerInput): Promise<void> => {
    try {
      await request(`/api/v1/manufacturers/${input.manufacturerProfileId}/ratings`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    } catch {
      await new Promise(r => setTimeout(r, 600))
    }
  },

  createProfile: async (input: CreateProfileInput): Promise<{ slug: string }> => {
    try {
      return await request<{ slug: string }>('/api/v1/manufacturers/profile', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    } catch {
      await new Promise(r => setTimeout(r, 1000))
      return { slug: `manufacturer-${Date.now()}` }
    }
  },

  updateProfile: async (slug: string, input: Partial<CreateProfileInput>): Promise<void> => {
    try {
      await request(`/api/v1/manufacturers/${slug}/profile`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    } catch {
      await new Promise(r => setTimeout(r, 800))
    }
  },
}

// ─────────────────────────────────────────────────────────────
// BACK IT — CAMPAIGN MOCK DATA + API
// ─────────────────────────────────────────────────────────────

function centsToDisplay(cents: number, currency = 'AUD') {
  return (cents / 100).toLocaleString('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 })
}

const now = Date.now()
const day = 86_400_000

const MOCK_CAMPAIGNS: CampaignListItem[] = [
  {
    id: 'camp-001',
    slug: 'midnight-linen-blazer-aw26',
    title: 'Midnight Linen Blazer — AW26',
    status: 'active',
    garmentId: 'gmt-001',
    garmentName: 'Midnight Linen Blazer',
    garmentCategory: 'outerwear',
    retailPriceCents: 42000,
    backerPriceCents: 29000,
    depositPercent: 100,
    currency: 'AUD',
    moq: 150,
    currentBackingCount: 112,
    moqReached: false,
    moqReachedAt: null,
    stretchGoalQty: 200,
    percentComplete: 74.7,
    campaignStart: new Date(now - 14 * day).toISOString(),
    campaignEnd: new Date(now + 16 * day).toISOString(),
    estimatedShipDate: new Date(now + 90 * day).toISOString(),
    coverImageUrl: null,
    projectedRevenueCents: 150 * 29000,
    collectedDepositsCents: 112 * 29000,
    createdAt: new Date(now - 20 * day).toISOString(),
    updatedAt: new Date(now - 1 * day).toISOString(),
  },
  {
    id: 'camp-002',
    slug: 'ribbed-cashmere-dress-aw26',
    title: 'Ribbed Cashmere Dress — AW26',
    status: 'moq_reached',
    garmentId: 'gmt-002',
    garmentName: 'Ribbed Cashmere Dress',
    garmentCategory: 'dresses',
    retailPriceCents: 68000,
    backerPriceCents: 48000,
    depositPercent: 100,
    currency: 'AUD',
    moq: 100,
    currentBackingCount: 143,
    moqReached: true,
    moqReachedAt: new Date(now - 2 * day).toISOString(),
    stretchGoalQty: 200,
    percentComplete: 100,
    campaignStart: new Date(now - 21 * day).toISOString(),
    campaignEnd: new Date(now + 9 * day).toISOString(),
    estimatedShipDate: new Date(now + 75 * day).toISOString(),
    coverImageUrl: null,
    projectedRevenueCents: 143 * 48000,
    collectedDepositsCents: 143 * 48000,
    createdAt: new Date(now - 28 * day).toISOString(),
    updatedAt: new Date(now - 2 * day).toISOString(),
  },
  {
    id: 'camp-003',
    slug: 'wide-leg-wool-trousers-aw26',
    title: 'Wide Leg Wool Trousers — AW26',
    status: 'draft',
    garmentId: 'gmt-003',
    garmentName: 'Wide Leg Wool Trousers',
    garmentCategory: 'bottoms',
    retailPriceCents: 32000,
    backerPriceCents: 22000,
    depositPercent: 50,
    currency: 'AUD',
    moq: 200,
    currentBackingCount: 0,
    moqReached: false,
    moqReachedAt: null,
    stretchGoalQty: null,
    percentComplete: 0,
    campaignStart: new Date(now + 7 * day).toISOString(),
    campaignEnd: new Date(now + 37 * day).toISOString(),
    estimatedShipDate: new Date(now + 120 * day).toISOString(),
    coverImageUrl: null,
    projectedRevenueCents: 200 * 22000,
    collectedDepositsCents: 0,
    createdAt: new Date(now - 3 * day).toISOString(),
    updatedAt: new Date(now - 3 * day).toISOString(),
  },
  {
    id: 'camp-004',
    slug: 'silk-slip-skirt-ss25',
    title: 'Silk Slip Skirt — SS25',
    status: 'completed',
    garmentId: 'gmt-004',
    garmentName: 'Silk Slip Skirt',
    garmentCategory: 'bottoms',
    retailPriceCents: 28000,
    backerPriceCents: 19500,
    depositPercent: 100,
    currency: 'AUD',
    moq: 80,
    currentBackingCount: 127,
    moqReached: true,
    moqReachedAt: new Date(now - 120 * day).toISOString(),
    stretchGoalQty: 150,
    percentComplete: 100,
    campaignStart: new Date(now - 180 * day).toISOString(),
    campaignEnd: new Date(now - 150 * day).toISOString(),
    estimatedShipDate: new Date(now - 60 * day).toISOString(),
    coverImageUrl: null,
    projectedRevenueCents: 127 * 19500,
    collectedDepositsCents: 127 * 19500,
    createdAt: new Date(now - 200 * day).toISOString(),
    updatedAt: new Date(now - 60 * day).toISOString(),
  },
]

const MOCK_CAMPAIGN_EVENTS = [
  { id: 'evt-001', eventType: 'campaign.created', createdAt: new Date(now - 20 * day).toISOString(), payload: {} },
  { id: 'evt-002', eventType: 'campaign.activated', createdAt: new Date(now - 14 * day).toISOString(), payload: {} },
  { id: 'evt-003', eventType: 'backing.placed', createdAt: new Date(now - 13 * day).toISOString(), payload: { backer: 'Customer #1', size: 'S' } },
  { id: 'evt-004', eventType: 'backing.placed', createdAt: new Date(now - 11 * day).toISOString(), payload: { backer: 'Customer #2', size: 'M' } },
  { id: 'evt-005', eventType: 'backing.placed', createdAt: new Date(now - 8 * day).toISOString(), payload: { backer: 'Customer #3', size: 'L' } },
  { id: 'evt-006', eventType: 'backing.milestone', createdAt: new Date(now - 5 * day).toISOString(), payload: { milestone: '50 backers reached' } },
  { id: 'evt-007', eventType: 'backing.placed', createdAt: new Date(now - 3 * day).toISOString(), payload: { backer: 'Customer #4', size: 'M' } },
  { id: 'evt-008', eventType: 'backing.placed', createdAt: new Date(now - 1 * day).toISOString(), payload: { backer: 'Customer #5', size: 'XS' } },
]

function generateDailyBackings(campaignStart: string, currentCount: number): Array<{ date: string; count: number; cumulative: number }> {
  const start = new Date(campaignStart)
  const today = new Date()
  const points: Array<{ date: string; count: number; cumulative: number }> = []
  let cumulative = 0
  let d = new Date(start)

  while (d <= today) {
    const daysIn = Math.floor((d.getTime() - start.getTime()) / day)
    const totalDays = Math.floor((today.getTime() - start.getTime()) / day) + 1
    // S-curve distribution
    const progress = daysIn / Math.max(totalDays, 1)
    const idealCumulative = Math.round(currentCount * (1 / (1 + Math.exp(-10 * (progress - 0.5)))))
    const dailyCount = Math.max(0, idealCumulative - cumulative)
    cumulative = idealCumulative
    points.push({
      date: d.toISOString().split('T')[0],
      count: dailyCount,
      cumulative,
    })
    d = new Date(d.getTime() + day)
  }

  return points
}

function getMockCampaignDetail(slug: string): CampaignDetail | null {
  const item = MOCK_CAMPAIGNS.find(c => c.slug === slug)
  if (!item) return null

  const sizes = ['XS', 'S', 'M', 'L', 'XL']
  const sizeDist = [8, 22, 38, 24, 8]
  const sizeBreakdown = sizes.map((size, i) => ({
    size,
    count: Math.round((item.currentBackingCount * sizeDist[i]) / 100),
    percent: sizeDist[i],
  }))

  const recentBackings = Array.from({ length: Math.min(item.currentBackingCount, 10) }, (_, i) => ({
    id: `back-${item.id}-${i}`,
    size: sizes[Math.floor(Math.random() * sizes.length)],
    quantity: 1,
    totalCents: item.backerPriceCents,
    currency: item.currency,
    status: 'active' as const,
    createdAt: new Date(now - i * 3 * 3600 * 1000).toISOString(),
    displayName: `Customer #${item.currentBackingCount - i}`,
    country: ['AU', 'US', 'UK', 'CA'][i % 4],
  }))

  return {
    ...item,
    description: `Limited production campaign for ${item.title}. Back now to lock in your backer price and help us hit the MOQ needed for production.`,
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    sizeLimits: null,
    manufacturerId: item.status === 'moq_reached' || item.status === 'completed' ? 'mfr-001' : null,
    manufacturerName: item.status === 'moq_reached' || item.status === 'completed' ? 'Orient Textile — Hangzhou' : null,
    shopifyProductId: item.status !== 'draft' ? `shopify-${item.id}` : null,
    shopifyStoreUrl: 'charcoalclothing.com',
    galleryUrls: [],
    manufacturerNotifiedAt: item.moqReached ? item.moqReachedAt : null,
    sizeBreakdown,
    recentBackings,
    events: MOCK_CAMPAIGN_EVENTS,
    dailyBackings: generateDailyBackings(item.campaignStart, item.currentBackingCount),
  }
}

// ─── Campaign API namespace ──────────────────────────────────

export const campaignApi = {
  list: async (filters?: CampaignFilters): Promise<CampaignListResponse> => {
    try {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined) params.set(k, String(v))
        })
      }
      return await request<CampaignListResponse>(`/api/v1/campaigns?${params}`)
    } catch {
      await new Promise(r => setTimeout(r, 400))
      let campaigns = [...MOCK_CAMPAIGNS]

      if (filters?.status && filters.status !== 'all') {
        campaigns = campaigns.filter(c => c.status === filters.status)
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase()
        campaigns = campaigns.filter(c =>
          c.title.toLowerCase().includes(q) ||
          (c.garmentName?.toLowerCase().includes(q) ?? false)
        )
      }

      const active = campaigns.filter(c => ['active', 'moq_reached', 'funded', 'in_production', 'shipped'].includes(c.status))
      const draft = campaigns.filter(c => c.status === 'draft' || c.status === 'scheduled')
      const completed = campaigns.filter(c => ['completed', 'cancelled', 'expired'].includes(c.status))

      return {
        campaigns,
        total: campaigns.length,
        page: filters?.page ?? 1,
        limit: filters?.limit ?? 20,
        stats: {
          totalActive: active.length,
          totalDraft: draft.length,
          totalCompleted: completed.length,
          totalRevenueCents: MOCK_CAMPAIGNS.reduce((sum, c) => sum + c.collectedDepositsCents, 0),
          totalBackers: MOCK_CAMPAIGNS.reduce((sum, c) => sum + c.currentBackingCount, 0),
        },
      }
    }
  },

  getBySlug: async (slug: string): Promise<CampaignDetail | null> => {
    try {
      return await request<CampaignDetail>(`/api/v1/campaigns/${slug}`)
    } catch {
      await new Promise(r => setTimeout(r, 300))
      return getMockCampaignDetail(slug)
    }
  },

  create: async (input: CreateCampaignInput): Promise<{ slug: string }> => {
    try {
      return await request<{ slug: string }>('/api/v1/campaigns', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    } catch {
      await new Promise(r => setTimeout(r, 1200))
      const slug = input.slug || input.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const newCampaign: CampaignListItem = {
        id: `camp-${Date.now()}`,
        slug,
        title: input.title,
        status: 'draft',
        garmentId: input.garmentId,
        garmentName: 'Selected Garment',
        garmentCategory: null,
        retailPriceCents: input.retailPriceCents,
        backerPriceCents: input.backerPriceCents,
        depositPercent: input.depositPercent,
        currency: input.currency,
        moq: input.moq,
        currentBackingCount: 0,
        moqReached: false,
        moqReachedAt: null,
        stretchGoalQty: input.stretchGoalQty ?? null,
        percentComplete: 0,
        campaignStart: input.campaignStart,
        campaignEnd: input.campaignEnd,
        estimatedShipDate: input.estimatedShipDate ?? null,
        coverImageUrl: null,
        projectedRevenueCents: input.moq * input.backerPriceCents,
        collectedDepositsCents: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      MOCK_CAMPAIGNS.unshift(newCampaign)
      return { slug }
    }
  },

  update: async (slug: string, input: UpdateCampaignInput): Promise<void> => {
    try {
      await request(`/api/v1/campaigns/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    } catch {
      await new Promise(r => setTimeout(r, 600))
    }
  },

  activate: async (slug: string): Promise<void> => {
    try {
      await request(`/api/v1/campaigns/${slug}/activate`, { method: 'POST' })
    } catch {
      await new Promise(r => setTimeout(r, 800))
      const campaign = MOCK_CAMPAIGNS.find(c => c.slug === slug)
      if (campaign) campaign.status = 'active'
    }
  },

  cancel: async (slug: string): Promise<void> => {
    try {
      await request(`/api/v1/campaigns/${slug}/cancel`, { method: 'POST' })
    } catch {
      await new Promise(r => setTimeout(r, 800))
      const campaign = MOCK_CAMPAIGNS.find(c => c.slug === slug)
      if (campaign) campaign.status = 'cancelled'
    }
  },
}
