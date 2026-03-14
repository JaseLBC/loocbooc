'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { WizardState, UploadedPhoto, GarmentCategory, GarmentSeason, UploadMethod, GarmentMeasurements, FabricPhysics } from '@/types'
import { assessPhotoQuality, getQualityReason } from '@/lib/utils'

const initialState: WizardState = {
  step: 1,
  step1: {
    name: '',
    category: null,
    season: undefined,
    sku: '',
    description: '',
  },
  uploadMethod: null,
  clo3dFile: null,
  patternFiles: [],
  photos: [],
  measurements: {},
  fabricComposition: '',
  fabricPhysics: null,
}

export function useGarmentUpload() {
  const [state, setState] = useState<WizardState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedUGI, setSubmittedUGI] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const goToStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, step }))
  }, [])

  const updateStep1 = useCallback((data: Partial<WizardState['step1']>) => {
    setState(prev => ({ ...prev, step1: { ...prev.step1, ...data } }))
  }, [])

  const setUploadMethod = useCallback((method: UploadMethod) => {
    setState(prev => ({ ...prev, uploadMethod: method, step: 3 }))
  }, [])

  const setClo3dFile = useCallback((file: File | null) => {
    setState(prev => ({ ...prev, clo3dFile: file }))
  }, [])

  const setPatternFiles = useCallback((files: File[]) => {
    setState(prev => ({ ...prev, patternFiles: files }))
  }, [])

  const addPhotos = useCallback((newFiles: File[]) => {
    const newPhotos: UploadedPhoto[] = newFiles.map(file => {
      const quality = assessPhotoQuality(file)
      return {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        quality,
        qualityReason: getQualityReason(quality, file),
        uploadProgress: 0,
        uploaded: false,
      }
    })

    setState(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }))

    // Simulate upload progress for each photo
    newPhotos.forEach(photo => {
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 30
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          setState(prev => ({
            ...prev,
            photos: prev.photos.map(p =>
              p.id === photo.id ? { ...p, uploadProgress: 100, uploaded: true } : p
            ),
          }))
        } else {
          setState(prev => ({
            ...prev,
            photos: prev.photos.map(p =>
              p.id === photo.id ? { ...p, uploadProgress: Math.round(progress) } : p
            ),
          }))
        }
      }, 200)
    })
  }, [])

  const removePhoto = useCallback((photoId: string) => {
    setState(prev => {
      const photo = prev.photos.find(p => p.id === photoId)
      if (photo) URL.revokeObjectURL(photo.previewUrl)
      return { ...prev, photos: prev.photos.filter(p => p.id !== photoId) }
    })
  }, [])

  const reorderPhotos = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const photos = [...prev.photos]
      const [removed] = photos.splice(fromIndex, 1)
      photos.splice(toIndex, 0, removed)
      return { ...prev, photos }
    })
  }, [])

  const setMeasurements = useCallback((measurements: GarmentMeasurements) => {
    setState(prev => ({ ...prev, measurements }))
  }, [])

  const setFabricComposition = useCallback((composition: string) => {
    setState(prev => ({ ...prev, fabricComposition: composition }))
  }, [])

  const setFabricPhysics = useCallback((physics: FabricPhysics | null) => {
    setState(prev => ({ ...prev, fabricPhysics: physics }))
  }, [])

  const submit = useCallback(async (): Promise<string | null> => {
    setIsSubmitting(true)
    setError(null)

    try {
      const garment = await api.garments.create({
        name: state.step1.name,
        category: state.step1.category!,
        season: state.step1.season,
        sku: state.step1.sku || undefined,
        description: state.step1.description || undefined,
        fabricComposition: state.fabricComposition || undefined,
        measurements: Object.keys(state.measurements).length > 0 ? state.measurements : undefined,
        uploadMethod: state.uploadMethod || undefined,
      })

      // Upload files if present
      const filesToUpload: File[] = [
        ...(state.clo3dFile ? [state.clo3dFile] : []),
        ...state.patternFiles,
        ...state.photos.map(p => p.file),
      ]

      if (filesToUpload.length > 0) {
        await api.garments.uploadFiles(garment.ugi, filesToUpload)
      }

      setSubmittedUGI(garment.ugi)
      return garment.ugi
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create garment. Please try again.')
      return null
    } finally {
      setIsSubmitting(false)
    }
  }, [state])

  const reset = useCallback(() => {
    // Cleanup blob URLs
    state.photos.forEach(p => URL.revokeObjectURL(p.previewUrl))
    setState(initialState)
    setSubmittedUGI(null)
    setError(null)
  }, [state.photos])

  return {
    state,
    isSubmitting,
    submittedUGI,
    error,
    goToStep,
    updateStep1,
    setUploadMethod,
    setClo3dFile,
    setPatternFiles,
    addPhotos,
    removePhoto,
    reorderPhotos,
    setMeasurements,
    setFabricComposition,
    setFabricPhysics,
    submit,
    reset,
  }
}
