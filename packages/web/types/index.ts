// ============================================================
// Loocbooc Frontend Types
// Aligned with backend schema in packages/api and packages/types
// ============================================================

// GarmentStatus mirrors app/models/garment.py GarmentStatus enum
export type GarmentStatus =
  | 'draft'
  | 'processing'
  | 'active'
  | 'updating'
  | 'error'
  | 'archived'
  | 'deleted'

// GarmentCategory mirrors app/models/garment.py GarmentCategory enum (plural values)
export type GarmentCategory =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'outerwear'
  | 'suits'
  | 'activewear'
  | 'swimwear'
  | 'underwear'
  | 'accessories'
  | 'footwear'
  | 'bags'
  | 'hats'
  | 'other'

export type GarmentSeason = 'SS' | 'AW' | 'all-season' | 'resort'

export type UploadMethod = 'clo3d' | 'pattern' | 'photos' | 'measurements'

// ---- Fabric Physics ----

export interface FabricPhysics {
  drape: number // 0-100
  stretch: number // 0-100
  weight: number // 0-100
  breathability: number // 0-100
  sheen: number // 0-100
}

export interface FabricPhysicsLabels {
  drape: string
  stretch: string
  weight: string
}

// ---- Garment Types ----

export interface GarmentMeasurements {
  chest?: number
  waist?: number
  hem?: number
  sleeveLength?: number
  totalLength?: number
  shoulderWidth?: number
  notes?: string
}

export interface Garment {
  ugi: string
  name: string
  category: GarmentCategory
  season?: GarmentSeason
  sku?: string
  description?: string
  fabricComposition?: string
  fabricPhysics?: FabricPhysics
  measurements?: GarmentMeasurements
  uploadMethod?: UploadMethod
  status: GarmentStatus
  hasModel3D: boolean
  thumbnailUrl?: string
  modelUrl?: string
  usdzUrl?: string
  createdAt: string
  updatedAt: string
  brandId: string
  tryOnCount?: number
}

export interface GarmentListResponse {
  items: Garment[]        // API returns 'items', not 'garments'
  total: number
  page: number
  page_size: number       // API returns 'page_size', not 'limit'
  has_next: boolean
}

export interface GarmentFilters {
  search?: string
  category?: GarmentCategory
  status?: GarmentStatus
  season?: GarmentSeason
  sortBy?: 'createdAt' | 'name' | 'status'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// ---- Create Garment Input ----

export interface CreateGarmentInput {
  name: string
  category: GarmentCategory
  season?: GarmentSeason
  sku?: string
  description?: string
  fabricComposition?: string
  measurements?: GarmentMeasurements
  uploadMethod?: UploadMethod
}

// ---- Scan / Pipeline ----

export type PipelineStageStatus = 'pending' | 'running' | 'complete' | 'error'

export interface PipelineStage {
  id: string
  label: string
  status: PipelineStageStatus
  progress?: number
  detail?: string
}

export interface ScanStatus {
  ugi: string
  status: GarmentStatus
  stages: PipelineStage[]
  estimatedSecondsRemaining?: number
  errorMessage?: string
}

// ---- Auth ----

export interface AuthUser {
  id: string
  email: string
  name: string
  brandId: string
  brandName: string
  apiKey: string
}

export interface LoginInput {
  email: string
  apiKey: string
}

// ---- Brand Stats ----

export interface BrandStats {
  totalGarments: number
  garmentsWith3D: number
  totalTryOns: number
  lastActivityAt: string | null
}

// ---- API Responses ----

export interface ApiError {
  error: string
  message: string
  statusCode: number
}

export interface ApiResponse<T> {
  data: T
  ok: boolean
}

// ---- Upload Wizard State ----

export interface WizardStep1 {
  name: string
  category: GarmentCategory | null
  season?: GarmentSeason
  sku?: string
  description?: string
}

export interface WizardStep3C {
  photos: UploadedPhoto[]
}

export interface WizardStep3D {
  measurements: GarmentMeasurements
}

export interface UploadedPhoto {
  id: string
  file: File
  previewUrl: string
  quality: 'good' | 'warning' | 'unusable'
  qualityReason?: string
  uploadProgress: number
  uploaded: boolean
}

export interface WizardState {
  step: number
  step1: WizardStep1
  uploadMethod: UploadMethod | null
  clo3dFile: File | null
  patternFiles: File[]
  photos: UploadedPhoto[]
  measurements: GarmentMeasurements
  fabricComposition: string
  fabricPhysics: FabricPhysics | null
}
