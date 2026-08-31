'use client'

import { useEffect, useState } from 'react'
import { getAdminStoreSettings, updateStoreSettings } from '@/actions/settings'
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
    getAdminStoreSettings().then(setSettings).catch(() => toast.error('Failed to load tax settings'))
  }, [])

  // Set when the server rejects the GSTIN on its check character alone. Holds
  // the reason so it can be shown in full, and its presence is what puts the
  // override button on screen — see lib/gstin.ts for why that override exists.
  const [checksumDoubt, setChecksumDoubt] = useState<string | null>(null)

  async function save(acceptGstinChecksum = false) {
    if (!settings) return
    setSaving(true)
    try {
      const result = await updateStoreSettings({
        enable_tax: settings.enable_tax,
        gst_percentage: settings.gst_percentage,
        origin_state: settings.origin_state,
        gstin: settings.gstin?.trim().toUpperCase() || null,
        seller_legal_name: settings.seller_legal_name?.trim() || null,
        seller_address_line1: settings.seller_address_line1?.trim() || null,
        seller_address_line2: settings.seller_address_line2?.trim() || null,
        seller_city: settings.seller_city?.trim() || null,
        seller_postal_code: settings.seller_postal_code?.trim() || null,
        seller_state_code: settings.seller_state_code?.trim() || null,
        invoice_signatory_name: settings.invoice_signatory_name?.trim() || null,
      }, { acceptGstinChecksum })

      if (!result.ok) {
        // A checksum doubt is held on screen rather than in a toast: it asks
        // the owner to compare fifteen characters against a certificate, which
        // is not a thing to do before a toast times out.
        if (result.kind === 'checksum') setChecksumDoubt(result.error)
        else toast.error(result.error)
        return
      }

      setChecksumDoubt(null)
      setSettings(result.settings)
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

  // Mirrors exactly what issue_invoice checks, so the screen tells the truth
  // about whether dispatching will actually produce a document.
  const invoiceReady = Boolean(
    settings.gstin?.trim() &&
      settings.seller_legal_name?.trim() &&
      settings.seller_address_line1?.trim() &&
      settings.seller_city?.trim() &&
      settings.seller_postal_code?.trim() &&
      settings.seller_state_code?.trim() &&
      settings.invoice_signatory_name?.trim()
  )
  const stateCodeMismatch = Boolean(
    settings.gstin?.trim() &&
      settings.seller_state_code?.trim() &&
      settings.gstin.trim().slice(0, 2) !== settings.seller_state_code.trim()
  )

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
          <Button size="sm" onClick={() => save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>

        {checksumDoubt && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              This GSTIN does not pass its own check character
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">{checksumDoubt}</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              A GSTIN carries a check character so a typo can be caught before it reaches a
              document. Nothing has been saved. If you have compared it against the certificate
              and it is correct, save it anyway — the check is a guard, not the authority.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => save(true)}
                disabled={saving}
              >
                Save anyway
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setChecksumDoubt(null)}>
                Let me re-check it
              </Button>
            </div>
          </div>
        )}

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

        {/* Invoice identity.
            Split out because it is not "settings" in the tweak-a-number sense —
            these are copied from the GST registration certificate, and until
            every one of them is filled in, no invoice can be issued at all: the
            database refuses rather than printing a document that claims to be a
            tax invoice without a registration behind it. */}
        <div className="mt-6 border-t border-gray-100 pt-5">
          <h4 className="text-sm font-medium text-gray-900">Invoice identity</h4>
          <p className="mt-0.5 text-xs text-gray-500">
            Copy these from the GST registration certificate, not from the website — Rule 46
            asks for the registered name and address of the supplier.
          </p>

          {!invoiceReady && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Invoices are <span className="font-medium">not being issued</span>. Dispatching a
              parcel will not produce a tax invoice until the GSTIN, the fields below and the
              signatory are all filled in.
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="seller_legal_name">Registered legal name</Label>
              <Input
                id="seller_legal_name"
                value={settings.seller_legal_name ?? ''}
                onChange={(e) => setSettings({ ...settings, seller_legal_name: e.target.value })}
                placeholder="Dewdropz Apparel Pvt Ltd"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="invoice_signatory_name">Authorised signatory</Label>
              <Input
                id="invoice_signatory_name"
                value={settings.invoice_signatory_name ?? ''}
                onChange={(e) => setSettings({ ...settings, invoice_signatory_name: e.target.value })}
                placeholder="Name of whoever signs invoices"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="seller_address_line1">Address line 1</Label>
              <Input
                id="seller_address_line1"
                value={settings.seller_address_line1 ?? ''}
                onChange={(e) => setSettings({ ...settings, seller_address_line1: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="seller_address_line2">Address line 2</Label>
              <Input
                id="seller_address_line2"
                value={settings.seller_address_line2 ?? ''}
                onChange={(e) => setSettings({ ...settings, seller_address_line2: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="seller_city">City</Label>
              <Input
                id="seller_city"
                value={settings.seller_city ?? ''}
                onChange={(e) => setSettings({ ...settings, seller_city: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="seller_postal_code">PIN code</Label>
              <Input
                id="seller_postal_code"
                value={settings.seller_postal_code ?? ''}
                onChange={(e) => setSettings({ ...settings, seller_postal_code: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="seller_state_code">State code</Label>
              <Input
                id="seller_state_code"
                value={settings.seller_state_code ?? ''}
                onChange={(e) => setSettings({ ...settings, seller_state_code: e.target.value })}
                placeholder="05"
                maxLength={2}
              />
              {/* Caught here rather than at issue time: the first two digits of
                  a GSTIN ARE the state code, so a disagreement means one of the
                  two is mistyped and both get printed. */}
              {stateCodeMismatch ? (
                <p className="mt-1 text-xs text-red-600">
                  Does not match the GSTIN, which starts {settings.gstin?.slice(0, 2)}.
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">Uttarakhand is 05.</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
