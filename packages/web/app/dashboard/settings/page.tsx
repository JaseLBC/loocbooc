'use client'

import { motion } from 'framer-motion'
import { getStoredAuth } from '@/lib/auth'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function SettingsPage() {
  const auth = getStoredAuth()

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Manage your brand account and API access.</p>
      </div>

      {/* Brand Profile */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border border-border bg-surface overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Brand profile</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Brand name</Label>
            <Input defaultValue={auth?.brandName ?? ''} placeholder="Your Brand" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue={auth?.email ?? ''} type="email" />
          </div>
          <Button size="sm">Save changes</Button>
        </div>
      </motion.div>

      {/* API Key */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="rounded-xl border border-border bg-surface overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">API access</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                defaultValue={auth?.apiKey ?? ''}
                type="password"
                readOnly
                className="font-mono"
              />
              <Button variant="outline" size="default">Rotate</Button>
            </div>
            <p className="text-xs text-text-muted">
              Keep your API key secret. It grants full access to your brand data.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Brand ID</Label>
            <Input
              value={auth?.brandId ?? ''}
              readOnly
              className="font-mono text-text-muted"
            />
            <p className="text-xs text-text-muted">
              Use this to identify your brand in API calls and integrations.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className="rounded-xl border border-error/20 bg-error/5 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-error/20">
          <h2 className="text-sm font-semibold text-error">Danger zone</h2>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-text-secondary">Delete brand account</p>
            <p className="text-xs text-text-muted mt-0.5">Permanently deletes all garments and data. Cannot be undone.</p>
          </div>
          <Button variant="destructive" size="sm" disabled>
            Delete account
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
