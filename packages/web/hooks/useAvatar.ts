'use client'

import { useState, useCallback } from 'react'
import type {
  Avatar,
  AvatarMeasurements,
  FitPreference,
  PhotoScanResult,
  FitRecommendationsResponse,
} from '@/types/avatar'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const API_V1 = `${API_BASE}/api/v1`

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Create avatar from manual measurements
// ---------------------------------------------------------------------------

export async function createAvatarFromMeasurements(params: {
  name: string
  measurements: Partial<AvatarMeasurements>
  gender?: string
  fitPreference: FitPreference
  occasions: string[]
}): Promise<Avatar> {
  return apiFetch<Avatar>(`${API_V1}/avatars/`, {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      gender: params.gender,
      measurements: {
        ...params.measurements,
        measurement_source: 'manual',
      },
      fit_preference: {
        preference: params.fitPreference,
        occasions: params.occasions,
      },
      style_profile: { colours: [], silhouettes: [], occasions: params.occasions, avoid: [] },
    }),
  })
}

// ---------------------------------------------------------------------------
// Update measurements
// ---------------------------------------------------------------------------

export async function updateAvatarMeasurements(
  avatarId: string,
  measurements: Partial<AvatarMeasurements>,
): Promise<Avatar> {
  return apiFetch<Avatar>(`${API_V1}/avatars/${avatarId}/measurements`, {
    method: 'PUT',
    body: JSON.stringify({ measurements }),
  })
}

// ---------------------------------------------------------------------------
// Photo scan
// ---------------------------------------------------------------------------

export async function scanPhotos(params: {
  avatarId: string
  frontPhoto: File
  sidePhoto: File
  heightCm: number
}): Promise<PhotoScanResult> {
  const form = new FormData()
  form.append('height_cm', String(params.heightCm))
  form.append('front_photo', params.frontPhoto)
  form.append('side_photo', params.sidePhoto)

  const res = await fetch(`${API_V1}/avatars/${params.avatarId}/photo-scan`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `Photo scan failed: ${res.status}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Get avatar
// ---------------------------------------------------------------------------

export async function getAvatar(avatarId: string): Promise<Avatar> {
  return apiFetch<Avatar>(`${API_V1}/avatars/${avatarId}`)
}

// ---------------------------------------------------------------------------
// Fit recommendations
// ---------------------------------------------------------------------------

export async function getFitRecommendations(
  avatarId: string,
  limit = 20,
): Promise<FitRecommendationsResponse> {
  return apiFetch<FitRecommendationsResponse>(
    `${API_V1}/avatars/${avatarId}/fit-recommendations?limit=${limit}`
  )
}

// ---------------------------------------------------------------------------
// Hook for managing avatar builder state
// ---------------------------------------------------------------------------

export function useAvatarBuilder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createAvatar = useCallback(
    async (params: Parameters<typeof createAvatarFromMeasurements>[0]) => {
      setLoading(true)
      setError(null)
      try {
        return await createAvatarFromMeasurements(params)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create avatar')
        throw e
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const photoScan = useCallback(
    async (params: Parameters<typeof scanPhotos>[0]) => {
      setLoading(true)
      setError(null)
      try {
        return await scanPhotos(params)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Photo scan failed')
        throw e
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { loading, error, createAvatar, photoScan }
}
