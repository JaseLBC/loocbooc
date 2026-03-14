import { getStoredAuth } from '@/auth'
import type {
  Garment,
  GarmentListResponse,
  GarmentFilters,
  CreateGarmentInput,
  ScanStatus,
  FabricPhysics,
  BrandStats,
} from '@/types'
import { generateMockUGI } from '@/utils'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

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
    headers['Authorization'] = `Bearer ${auth.apiKey}`
    headers['X-Brand-ID'] = auth.brandId
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
  const categories = ['top', 'bottom', 'dress', 'outerwear', 'activewear'] as const
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
        return await request<GarmentListResponse>(`/garments?${params}`)
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
          garments,
          total: garments.length,
          page: filters?.page ?? 1,
          limit: filters?.limit ?? 20,
        }
      }
    },

    get: async (ugi: string): Promise<Garment> => {
      try {
        return await request<Garment>(`/garments/${ugi}`)
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
        return await request<Garment>('/garments', {
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
      try {
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        const auth = getStoredAuth()
        await fetch(`${BASE_URL}/garments/${ugi}/files`, {
          method: 'POST',
          headers: {
            ...(auth?.apiKey ? { Authorization: `Bearer ${auth.apiKey}` } : {}),
          },
          body: formData,
        })
      } catch {
        await new Promise(r => setTimeout(r, 800))
      }
    },

    getScanStatus: async (ugi: string): Promise<ScanStatus> => {
      try {
        return await request<ScanStatus>(`/garments/${ugi}/scan/status`)
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
        const result = await request<{ composition: string }>('/scan/label', {
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
        return await request<FabricPhysics>('/fabrics/physics', {
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
        return await request<BrandStats>('/brand/stats')
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
