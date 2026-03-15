// Avatar module types

export type BodyType =
  | 'hourglass'
  | 'pear'
  | 'apple'
  | 'rectangle'
  | 'inverted_triangle'

export type FitPreference = 'fitted' | 'regular' | 'relaxed' | 'oversized'

export type MeasurementSource = 'manual' | 'photo_scan' | 'tape_measure' | 'ml_inferred'

export interface AvatarMeasurements {
  height_cm: number | null
  weight_kg: number | null
  chest_cm: number | null
  waist_cm: number | null
  hips_cm: number | null
  inseam_cm: number | null
  shoulder_width_cm: number | null
  sleeve_length_cm: number | null
  arm_length_cm: number | null
  neck_cm: number | null
  thigh_cm: number | null
  torso_length_cm: number | null
  measurement_source: MeasurementSource
  confidence_score: number | null
  extended_measurements: Record<string, unknown>
}

export interface FitPreferenceProfile {
  preference: FitPreference
  occasions: string[]
}

export interface StyleProfile {
  colours: string[]
  silhouettes: string[]
  occasions: string[]
  avoid: string[]
}

export interface AvatarMeasurementRecord {
  id: string
  height_cm: number | null
  weight_kg: number | null
  chest_cm: number | null
  waist_cm: number | null
  hips_cm: number | null
  inseam_cm: number | null
  shoulder_width_cm: number | null
  sleeve_length_cm: number | null
  arm_length_cm: number | null
  neck_cm: number | null
  thigh_cm: number | null
  torso_length_cm: number | null
  body_type: BodyType | null
  measurement_source: MeasurementSource
  confidence_score: number | null
  is_current: boolean
  created_at: string
}

export interface Avatar {
  id: string
  name: string
  gender: string | null
  age_range: string | null
  scan_source: string
  body_type: BodyType | null
  fit_preference: FitPreferenceProfile
  size_history: Record<string, Record<string, string>>
  style_profile: StyleProfile
  is_active: boolean
  created_at: string
  updated_at: string
  measurements: AvatarMeasurementRecord[]
}

// Builder wizard state
export type AvatarBuilderStep = 1 | 2 | 3 | 4 | 5

export type MeasurementMethod = 'manual' | 'photos'

export interface AvatarBuilderState {
  step: AvatarBuilderStep
  method: MeasurementMethod | null
  measurements: Partial<AvatarMeasurements>
  bodyType: BodyType | null
  fitPreference: FitPreference
  occasions: string[]
  photoConfidence: number | null
  photoWarnings: string[]
  avatarName: string
  savedAvatar: Avatar | null
}

// Fit recommendation types
export interface ZoneFitDetail {
  fit: string
  ease_cm: number | null
}

export interface FitRecommendation {
  garment_id: string
  ugi: string
  garment_name: string
  overall_fit: 'good' | 'acceptable' | 'poor'
  size_recommendation: string
  confidence: number
  zones: Record<string, ZoneFitDetail>
  reasoning: string
  alternative: { size: string; note: string } | null
}

export interface FitRecommendationsResponse {
  avatar_id: string
  recommendations: FitRecommendation[]
  total: number
}

// Photo scan result
export interface PhotoScanResult {
  success: boolean
  measurements: Partial<Record<keyof AvatarMeasurements, number | null>>
  confidence_scores: Record<string, number>
  overall_confidence: number
  warnings: string[]
  error: string | null
  fallback_required: boolean
  body_type: BodyType | null
}
