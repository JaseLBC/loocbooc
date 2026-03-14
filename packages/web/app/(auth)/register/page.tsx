'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-indigo flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Request access</h1>
            <p className="text-sm text-text-muted mt-1">We're onboarding brands in cohorts.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand name</Label>
            <Input id="brandName" placeholder="Your Brand" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@yourbrand.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" type="url" placeholder="https://yourbrand.com" />
          </div>

          <Button className="w-full" size="lg">
            Request access
          </Button>
        </div>

        <p className="text-center text-xs text-text-muted">
          Already have access?{' '}
          <Link href="/login" className="text-text-secondary hover:text-text-primary transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
