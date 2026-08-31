'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { getAdminStoreSettings, updateStoreSettings } from '@/actions/settings'
import type { StoreSettings } from '@/types/database'

// Settings is now only the things that are genuinely settings.
//
// It used to carry four tabs, and the three that mattered day to day — shipping
// zones, homepage merchandising and tax rules — were the ones buried behind a
// tab on a page called "Settings". They now have their own pages in the
// sidebar; what is left is the store's own identity, which is edited once.
export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<StoreSettings | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setSettings(await getAdminStoreSettings())
      } catch {
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
      const result = await updateStoreSettings({
        store_name: settings.store_name,
        support_email: settings.support_email,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Settings saved')
    } catch {
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
    <div className="space-y-6 pb-10 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Settings</h2>
          <p className="text-sm text-gray-500 mt-1">How the store identifies itself to customers.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-black hover:bg-black/90">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Store identity</CardTitle>
          <CardDescription>Used in customer emails, receipts and invoices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="store_name">Store name</Label>
            <Input
              id="store_name"
              value={settings.store_name}
              onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
            />
          </div>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="store_email">Support email</Label>
            <Input
              id="store_email"
              type="email"
              value={settings.support_email}
              onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Signposted rather than silently moved: anyone who knew these lived here
          needs to be told where they went, once. */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Moved out of Settings</CardTitle>
          <CardDescription>These now have their own pages in the sidebar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            ['Shipping', '/admin/shipping', 'Zones, rates, free-shipping threshold'],
            ['Homepage', '/admin/homepage', 'Front-page merchandising'],
            ['Tax Rules', '/admin/tax', 'GST by HSN, origin state, GSTIN'],
          ].map(([label, href, hint]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-gray-200 p-4 hover:border-gray-900 transition-colors"
            >
              <div className="text-sm font-medium text-gray-900">{label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{hint}</div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
