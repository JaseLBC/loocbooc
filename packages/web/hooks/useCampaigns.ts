'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignApi } from '@/lib/api'
import type {
  CampaignFilters,
  CreateCampaignInput,
  UpdateCampaignInput,
} from '@/types/back-it'

// ─── Queries ──────────────────────────────────────────────────

export function useCampaigns(filters?: CampaignFilters) {
  return useQuery({
    queryKey: ['campaigns', filters],
    queryFn: () => campaignApi.list(filters),
    staleTime: 30_000,
  })
}

export function useCampaign(slug: string) {
  return useQuery({
    queryKey: ['campaign', slug],
    queryFn: () => campaignApi.getBySlug(slug),
    staleTime: 15_000,
    enabled: !!slug,
  })
}

// ─── Mutations ────────────────────────────────────────────────

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCampaignInput) => campaignApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useUpdateCampaign(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateCampaignInput) => campaignApi.update(slug, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', slug] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useActivateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => campaignApi.activate(slug),
    onSuccess: (_data, slug) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', slug] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useCancelCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => campaignApi.cancel(slug),
    onSuccess: (_data, slug) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', slug] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}
