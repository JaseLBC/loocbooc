'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvatarCard } from '@/components/avatar/AvatarCard'
import { AvatarBuilderWizard } from '@/components/avatar/AvatarBuilderWizard'
import { getAvatar } from '@/hooks/useAvatar'
import type { Avatar } from '@/types/avatar'

// For MVP: avatar is stored in localStorage (no user auth yet)
const AVATAR_STORAGE_KEY = 'loocbooc_avatar_id'

export function AvatarPageClient() {
  const searchParams = useSearchParams()
  const editParam = searchParams.get('edit')

  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)

  // Load avatar from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AVATAR_STORAGE_KEY)
    if (stored) {
      setAvatarId(stored)
    } else {
      setLoading(false)
    }
  }, [])

  // Fetch avatar when id is known
  useEffect(() => {
    if (!avatarId) return
    setLoading(true)
    getAvatar(avatarId)
      .then(setAvatar)
      .catch(() => {
        // Avatar not found — clear stored id
        localStorage.removeItem(AVATAR_STORAGE_KEY)
        setAvatarId(null)
      })
      .finally(() => setLoading(false))
  }, [avatarId])

  // If edit param present, show builder
  useEffect(() => {
    if (editParam) setShowBuilder(true)
  }, [editParam])

  const handleAvatarCreated = useCallback((id: string) => {
    localStorage.setItem(AVATAR_STORAGE_KEY, id)
    setAvatarId(id)
    setShowBuilder(false)
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-surface-elevated rounded animate-pulse" />
        <div className="h-64 bg-surface-elevated rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (showBuilder || (!avatar && !loading)) {
    return (
      <div className="space-y-4">
        {avatar && (
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-text-primary">Edit avatar</h1>
            <Button variant="ghost" onClick={() => setShowBuilder(false)}>
              Cancel
            </Button>
          </div>
        )}
        {!avatar && !showBuilder && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mx-auto">
              <User className="w-8 h-8 text-text-muted" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">No avatar yet</h2>
              <p className="text-text-muted mt-1 text-sm">
                Create your avatar to get personalised fit scores across every garment.
              </p>
            </div>
            <Button variant="indigo" onClick={() => setShowBuilder(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create avatar
            </Button>
          </div>
        )}
        {(showBuilder || !avatar) && (
          <AvatarBuilderWizard onComplete={handleAvatarCreated} />
        )}
      </div>
    )
  }

  if (!avatar) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Avatar</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Your personal body profile for virtual try-on
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBuilder(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Update avatar
          </Button>
        </div>
      </div>

      <AvatarCard avatar={avatar} />
    </div>
  )
}
