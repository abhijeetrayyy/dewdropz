'use client'

import { useEffect, useState } from 'react'
import { getStoreSettings, updateStoreSettings } from '@/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { StoreSettings } from '@/types/database'

// The store-wide half of tax, moved off the Settings page so that everything
// governing what a customer is charged in GST is on one screen: the switch, the
// fallback rate, where we ship from, and the GSTIN that goes on the invoice.
export default function TaxSettingsCard() {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getStoreSettings().then(setSettings).catch(() => toast.error('Failed to load tax settings'))
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      await updateStoreSettings({
        enable_tax: settings.enable_tax,
        gst_percentage: settings.gst_percentage,
        origin_state: settings.origin_state,
        gstin: settings.gstin,
      })
      toast.success('Tax settings saved')
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <Card><CardContent className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Tax settings</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Applies to every order. Per-product rates are the table below.
            </p>
          </div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-4 flex items-center gap-2">
            <Checkbox
              id="enable_tax"
              className="w-5 h-5"
              checked={settings.enable_tax}
              onCheckedChange={(v) => setSettings({ ...settings, enable_tax: !!v })}
            />
            <Label htmlFor="enable_tax" className="font-normal">
              Charge GST at checkout
            </Label>
          </div>

          <div>
            <Label htmlFor="gst_percentage">Fallback rate (%)</Label>
            <Input
              id="gst_percentage"
              type="number"
              step="0.1"
              value={settings.gst_percentage}
              onChange={(e) => setSettings({ ...settings, gst_percentage: parseFloat(e.target.value || '0') })}
            />
            <p className="text-xs text-gray-400 mt-1">Only for products with no HSN code.</p>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="origin_state">Origin state</Label>
            <Input
              id="origin_state"
              value={settings.origin_state ?? ''}
              onChange={(e) => setSettings({ ...settings, origin_state: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-1">
              Buyers in this state are charged CGST + SGST; everywhere else is IGST.
            </p>
          </div>

          <div>
            <Label htmlFor="gstin">GSTIN</Label>
            <Input
              id="gstin"
              value={settings.gstin ?? ''}
              onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
              placeholder="05ABCDE1234F1Z5"
            />
            <p className="text-xs text-gray-400 mt-1">Printed on invoices.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
