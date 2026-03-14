'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Sparkles, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, setStoredAuth } from '@/lib/auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  apiKey: z.string().min(1, 'API key is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showKey, setShowKey] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    try {
      const user = await login(data)
      setStoredAuth(user)
      router.push('/dashboard')
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-indigo flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">loocbooc</h1>
            <p className="text-sm text-text-muted mt-1">Sign in to your brand portal</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@yourbrand.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-error">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                placeholder="lb_••••••••••••••••"
                autoComplete="current-password"
                className="pr-10"
                {...register('apiKey')}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.apiKey && (
              <p className="text-xs text-error">{errors.apiKey.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-lg border border-error/20 bg-error/10 px-3 py-2">
              <p className="text-xs text-error">{serverError}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        {/* Dev note */}
        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-secondary">Dev mode:</span> Any email + any API key will work.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-text-muted">
          Don't have an account?{' '}
          <a href="/register" className="text-text-secondary hover:text-text-primary transition-colors">
            Request access
          </a>
        </p>
      </motion.div>
    </div>
  )
}
