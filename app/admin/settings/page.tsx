'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { getStoreSettings, updateStoreSettings } from '@/actions/settings'
import type { StoreSettings } from '@/types/database'
import { ShippingEngine } from './shipping-engine'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<StoreSettings | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getStoreSettings()
        setSettings(data)
      } catch (error) {
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await updateStoreSettings({
        store_name: settings.store_name,
        support_email: settings.support_email,
        enable_tax: settings.enable_tax,
        gst_percentage: settings.gst_percentage,
      })
      toast.success('General settings saved successfully')
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  if (!settings) return null

  return (
    <div className="space-y-6 pb-10 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Settings Engine</h2>
          <p className="text-sm text-gray-500 mt-1">Configure global platform behavior, logistics, and compliance rules.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-black hover:bg-black/90">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save General Settings
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 bg-gray-100/50 p-1">
          <TabsTrigger value="general" className="px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">General</TabsTrigger>
          <TabsTrigger value="shipping" className="px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">Shipping & Delivery</TabsTrigger>
          <TabsTrigger value="taxes" className="px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">Taxes</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Platform Identity</CardTitle>
              <CardDescription>Global variables for customer communications and receipts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-md">
                <Label htmlFor="store_name">Store Name</Label>
                <Input
                  id="store_name"
                  value={settings.store_name}
                  onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                />
              </div>
              <div className="space-y-2 max-w-md">
                <Label htmlFor="store_email">Support Email</Label>
                <Input
                  id="store_email"
                  type="email"
                  value={settings.support_email}
                  onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping" className="mt-0">
          <ShippingEngine />
        </TabsContent>

        <TabsContent value="taxes" className="mt-0">
          <Card className="shadow-sm border-gray-200 max-w-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Compliance & Taxation</CardTitle>
              <CardDescription>Rules engine for checkout cart modifications based on geography.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between p-4 bg-gray-50 border border-gray-100 rounded-lg">
                <div className="space-y-1 pr-6">
                  <Label className="text-base font-semibold text-gray-900">Enable Tax Calculation Engine</Label>
                  <div className="text-sm text-gray-500">When enabled, the cart automatically calculates standard GST during the checkout flow based on the rules defined below.</div>
                </div>
                <div className="pt-1">
                  <Checkbox
                    checked={settings.enable_tax}
                    onCheckedChange={(checked) => setSettings({ ...settings, enable_tax: !!checked })}
                    className="w-5 h-5"
                  />
                </div>
              </div>
              {settings.enable_tax && (
                <div className="p-4 border border-gray-100 rounded-lg space-y-4">
                  <h4 className="font-medium text-sm text-gray-900">Active Rules</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gst_percentage">Default GST Percentage (%)</Label>
                      <Input
                        id="gst_percentage"
                        type="number"
                        step="0.1"
                        value={settings.gst_percentage}
                        onChange={(e) => setSettings({ ...settings, gst_percentage: parseFloat(e.target.value || '0') })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
