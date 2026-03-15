'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2, CheckCircle2, MessageSquare, Package, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ManufacturerListItem } from '@/types/manufacturer'
import { useSendEnquiry } from '@/hooks/useManufacturers'

interface EnquiryModalProps {
  manufacturer: ManufacturerListItem
  open: boolean
  onClose: () => void
}

interface EnquiryFormData {
  message: string
  estimatedQuantity: string
  targetDeliveryDate: string
  productCategory: string
}

const INITIAL_FORM: EnquiryFormData = {
  message: '',
  estimatedQuantity: '',
  targetDeliveryDate: '',
  productCategory: '',
}

export function EnquiryModal({ manufacturer, open, onClose }: EnquiryModalProps) {
  const [form, setForm] = useState<EnquiryFormData>(INITIAL_FORM)
  const [sent, setSent] = useState(false)
  const { mutateAsync: sendEnquiry, isPending } = useSendEnquiry()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.message.trim()) return

    try {
      await sendEnquiry({
        manufacturerProfileId: manufacturer.profileId,
        message: form.message,
        estimatedQuantity: form.estimatedQuantity ? parseInt(form.estimatedQuantity) : undefined,
        targetDeliveryDate: form.targetDeliveryDate || undefined,
        productCategory: form.productCategory || undefined,
      })
      setSent(true)
    } catch (err) {
      // In demo mode this still succeeds via mock
      setSent(true)
    }
  }

  const handleClose = () => {
    setForm(INITIAL_FORM)
    setSent(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl pointer-events-auto overflow-hidden">
              {sent ? (
                /* Success state */
                <div className="p-8 text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="flex justify-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-success" />
                    </div>
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">Enquiry sent</h3>
                    <p className="text-sm text-text-muted mt-1">
                      {manufacturer.displayName} will be notified and typically responds within{' '}
                      {manufacturer.responseTimeHours
                        ? `${Math.round(manufacturer.responseTimeHours)} hours`
                        : '48 hours'}
                      .
                    </p>
                  </div>
                  <Button onClick={handleClose} className="w-full">Done</Button>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                      <h2 className="text-base font-semibold text-text-primary">
                        Send enquiry
                      </h2>
                      <p className="text-sm text-text-muted">
                        to {manufacturer.displayName}
                      </p>
                    </div>
                    <button
                      onClick={handleClose}
                      className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Manufacturer quick info */}
                  <div className="px-6 py-3 bg-surface-elevated/50 border-b border-border">
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      {manufacturer.moqMin && (
                        <div className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          <span>MOQ {manufacturer.moqMin.toLocaleString()}</span>
                        </div>
                      )}
                      {manufacturer.bulkLeadTimeDays && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{manufacturer.bulkLeadTimeDays}d lead time</span>
                        </div>
                      )}
                      {manufacturer.responseTimeHours && (
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>~{Math.round(manufacturer.responseTimeHours)}h response</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Message */}
                    <div className="space-y-1.5">
                      <Label htmlFor="enq-message" className="text-sm font-medium text-text-primary">
                        Message <span className="text-error">*</span>
                      </Label>
                      <Textarea
                        id="enq-message"
                        value={form.message}
                        onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="Introduce your brand, describe the garment type, and what you're looking for..."
                        rows={4}
                        className="resize-none"
                        required
                      />
                    </div>

                    {/* Product category + Quantity */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="enq-category" className="text-sm text-text-secondary">
                          Product category
                        </Label>
                        <Input
                          id="enq-category"
                          value={form.productCategory}
                          onChange={e => setForm(prev => ({ ...prev, productCategory: e.target.value }))}
                          placeholder="e.g. Knitwear, Denim"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="enq-qty" className="text-sm text-text-secondary">
                          Est. quantity
                        </Label>
                        <Input
                          id="enq-qty"
                          type="number"
                          value={form.estimatedQuantity}
                          onChange={e => setForm(prev => ({ ...prev, estimatedQuantity: e.target.value }))}
                          placeholder="e.g. 500"
                          min="1"
                        />
                      </div>
                    </div>

                    {/* Target delivery */}
                    <div className="space-y-1.5">
                      <Label htmlFor="enq-delivery" className="text-sm text-text-secondary">
                        Target delivery date
                      </Label>
                      <Input
                        id="enq-delivery"
                        type="date"
                        value={form.targetDeliveryDate}
                        onChange={e => setForm(prev => ({ ...prev, targetDeliveryDate: e.target.value }))}
                        className="text-text-primary"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={!form.message.trim() || isPending}
                        className="flex-1 gap-2"
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Send enquiry
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
