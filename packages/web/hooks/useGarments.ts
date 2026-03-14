'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { GarmentFilters, CreateGarmentInput, Garment } from '@/types'

export function useGarments(filters?: GarmentFilters) {
  return useQuery({
    queryKey: ['garments', filters],
    queryFn: () => api.garments.list(filters),
    staleTime: 30_000,
  })
}

export function useGarment(ugi: string) {
  return useQuery({
    queryKey: ['garment', ugi],
    queryFn: () => api.garments.get(ugi),
    staleTime: 30_000,
    enabled: !!ugi,
  })
}

export function useCreateGarment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateGarmentInput) => api.garments.create(data),
    onSuccess: (newGarment: Garment) => {
      // Optimistically update the list
      queryClient.setQueryData(
        ['garments', undefined],
        (old: { garments: Garment[]; total: number } | undefined) => {
          if (!old) return old
          return {
            ...old,
            garments: [newGarment, ...old.garments],
            total: old.total + 1,
          }
        }
      )
      queryClient.invalidateQueries({ queryKey: ['garments'] })
      queryClient.invalidateQueries({ queryKey: ['brand-stats'] })
    },
  })
}

export function useBrandStats() {
  return useQuery({
    queryKey: ['brand-stats'],
    queryFn: () => api.brand.getStats(),
    staleTime: 60_000,
  })
}
