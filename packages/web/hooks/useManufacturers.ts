'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { manufacturerApi } from '@/lib/api'
import type {
  ManufacturerFilters,
  SendEnquiryInput,
  RateManufacturerInput,
  CreateProfileInput,
} from '@/types/manufacturer'

// ─── Queries ──────────────────────────────────────────────────

export function useManufacturers(filters?: ManufacturerFilters) {
  return useQuery({
    queryKey: ['manufacturers', filters],
    queryFn: () => manufacturerApi.list(filters),
    staleTime: 60_000,
  })
}

export function useManufacturer(slug: string) {
  return useQuery({
    queryKey: ['manufacturer', slug],
    queryFn: () => manufacturerApi.getBySlug(slug),
    staleTime: 30_000,
    enabled: !!slug,
  })
}

export function useMyConnections() {
  return useQuery({
    queryKey: ['manufacturer-connections'],
    queryFn: () => manufacturerApi.getConnections(),
    staleTime: 30_000,
  })
}

// ─── Mutations ────────────────────────────────────────────────

export function useSendEnquiry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SendEnquiryInput) => manufacturerApi.sendEnquiry(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturer-connections'] })
    },
  })
}

export function useRateManufacturer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RateManufacturerInput) => manufacturerApi.rate(input),
    onSuccess: (_data, input) => {
      // Invalidate the specific manufacturer profile so ratings refresh
      queryClient.invalidateQueries({ queryKey: ['manufacturer'] })
    },
  })
}

export function useCreateManufacturerProfile() {
  return useMutation({
    mutationFn: (input: CreateProfileInput) => manufacturerApi.createProfile(input),
  })
}

export function useUpdateManufacturerProfile(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<CreateProfileInput>) =>
      manufacturerApi.updateProfile(slug, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturer', slug] })
    },
  })
}
