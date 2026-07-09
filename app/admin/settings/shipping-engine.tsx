'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Globe, Plus, Pencil, Trash2, Loader2, DollarSign, Weight, MapPin } from 'lucide-react'
import { getShippingZones, createShippingZone, updateShippingZone, deleteShippingZone, createShippingRate, updateShippingRate, deleteShippingRate } from '@/actions/shipping'
import type { ShippingZoneWithRates, ShippingRate } from '@/types/database'

export function ShippingEngine() {
  const [zones, setZones] = useState<ShippingZoneWithRates[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modals
  const [zoneModalOpen, setZoneModalOpen] = useState(false)
  const [rateModalOpen, setRateModalOpen] = useState(false)
  
  // State for forms
  const [activeZone, setActiveZone] = useState<ShippingZoneWithRates | null>(null)
  const [zoneForm, setZoneForm] = useState({ name: '', countries: '', states: '' })
  
  const [activeRate, setActiveRate] = useState<ShippingRate | null>(null)
  const [rateForm, setRateForm] = useState({ name: '', type: 'flat', price: '', min_value: '', max_value: '' })
  
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = await getShippingZones()
      setZones(data)
    } catch {
      toast.error('Failed to load shipping zones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Zone Actions
  function openZoneModal(zone?: ShippingZoneWithRates) {
    if (zone) {
      setActiveZone(zone)
      setZoneForm({ name: zone.name, countries: zone.countries.join(', '), states: zone.states.join(', ') })
    } else {
      setActiveZone(null)
      setZoneForm({ name: '', countries: '', states: '' })
    }
    setZoneModalOpen(true)
  }

  async function handleSaveZone() {
    if (!zoneForm.name) return toast.error('Zone name is required')
    setSaving(true)
    const countries = zoneForm.countries.split(',').map(c => c.trim()).filter(Boolean)
    const states = zoneForm.states.split(',').map(s => s.trim()).filter(Boolean)
    try {
      if (activeZone) {
        await updateShippingZone(activeZone.id, { name: zoneForm.name, countries, states })
        toast.success('Zone updated')
      } else {
        await createShippingZone({ name: zoneForm.name, countries, states })
        toast.success('Zone created')
      }
      setZoneModalOpen(false)
      load()
    } catch { toast.error('Failed to save zone') }
    finally { setSaving(false) }
  }

  async function handleDeleteZone(id: string) {
    if (!confirm('Are you sure? This will delete all rates in this zone.')) return
    try {
      await deleteShippingZone(id)
      toast.success('Zone deleted')
      load()
    } catch { toast.error('Failed to delete zone') }
  }

  // Rate Actions
  function openRateModal(zone: ShippingZoneWithRates, rate?: ShippingRate) {
    setActiveZone(zone)
    if (rate) {
      setActiveRate(rate)
      setRateForm({
        name: rate.name, type: rate.type, price: (rate.price / 100).toString(),
        min_value: rate.type === 'flat' ? '' : rate.min_value.toString(),
        max_value: rate.max_value ? rate.max_value.toString() : ''
      })
    } else {
      setActiveRate(null)
      setRateForm({ name: '', type: 'flat', price: '', min_value: '', max_value: '' })
    }
    setRateModalOpen(true)
  }

  async function handleSaveRate() {
    if (!activeZone) return
    if (!rateForm.name || !rateForm.price) return toast.error('Name and price are required')
    setSaving(true)
    try {
      const price = Math.round(parseFloat(rateForm.price) * 100)
      const min_value = rateForm.min_value ? parseInt(rateForm.min_value) : 0
      const max_value = rateForm.max_value ? parseInt(rateForm.max_value) : null
      
      if (activeRate) {
        await updateShippingRate(activeRate.id, { name: rateForm.name, type: rateForm.type as any, price, min_value, max_value })
        toast.success('Rate updated')
      } else {
        await createShippingRate({ zone_id: activeZone.id, name: rateForm.name, type: rateForm.type as any, price, min_value, max_value })
        toast.success('Rate created')
      }
      setRateModalOpen(false)
      load()
    } catch { toast.error('Failed to save rate') }
    finally { setSaving(false) }
  }

  async function handleDeleteRate(id: string) {
    if (!confirm('Delete this rate?')) return
    try {
      await deleteShippingRate(id)
      toast.success('Rate deleted')
      load()
    } catch { toast.error('Failed to delete rate') }
  }

  if (loading) return <div className="py-12 flex justify-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Shipping Zones</h3>
          <p className="text-sm text-gray-500 mt-1">Manage where you ship and how much you charge.</p>
        </div>
        <Button onClick={() => openZoneModal()} size="sm"><Plus className="h-4 w-4 mr-2" /> Add Zone</Button>
      </div>

      {zones.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Globe className="h-12 w-12 text-gray-200 mb-4" />
            <div className="text-lg font-medium text-gray-900 mb-1">No shipping zones</div>
            <div className="text-sm text-gray-500 max-w-md mb-4">You haven't set up any shipping regions yet. Customers won't be able to checkout until you add a zone and rates.</div>
            <Button onClick={() => openZoneModal()}>Create your first zone</Button>
          </CardContent>
        </Card>
      ) : (
        zones.map((zone) => (
          <Card key={zone.id} className="shadow-sm border-gray-200 overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-100 flex flex-row items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-gray-400" />
                <div>
                  <CardTitle className="text-base">{zone.name}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {zone.states.length > 0
                      ? `States: ${zone.states.join(', ')}`
                      : zone.countries.length > 0 ? zone.countries.join(', ') : 'Catch-all — matches anything not covered by another zone'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openZoneModal(zone)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteZone(zone.id)}>Delete</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {zone.rates.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">No rates configured. Customers cannot checkout to this zone.</div>
                ) : (
                  zone.rates.map(rate => (
                    <div key={rate.id} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {rate.type === 'flat' ? <MapPin className="h-4 w-4 text-gray-400" /> : rate.type === 'weight_based' ? <Weight className="h-4 w-4 text-gray-400" /> : <DollarSign className="h-4 w-4 text-gray-400" />}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{rate.name}</div>
                          <div className="text-xs text-gray-500">
                            {rate.type === 'flat' && 'Standard flat rate'}
                            {rate.type === 'weight_based' && `Condition: ${rate.min_value}g to ${rate.max_value ? rate.max_value + 'g' : 'no limit'}`}
                            {rate.type === 'price_based' && `Condition: ₹${rate.min_value/100} to ${rate.max_value ? '₹' + rate.max_value/100 : 'no limit'}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="font-medium">{rate.price === 0 ? 'Free' : `₹${(rate.price/100).toFixed(2)}`}</div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRateModal(zone, rate)}><Pencil className="h-4 w-4 text-gray-400" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteRate(rate.id)}><Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" /></Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="p-4 bg-gray-50/30">
                  <Button variant="outline" size="sm" onClick={() => openRateModal(zone)} className="w-full border-dashed"><Plus className="h-4 w-4 mr-2" /> Add Rate</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Zone Modal */}
      <Dialog open={zoneModalOpen} onOpenChange={setZoneModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{activeZone ? 'Edit Zone' : 'Create Zone'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="zone_name">Zone Name</Label>
              <Input id="zone_name" value={zoneForm.name} onChange={e => setZoneForm({...zoneForm, name: e.target.value})} placeholder="e.g. Domestic (India)" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="zone_states">States (Comma separated — matches before country, best for domestic zones)</Label>
              <Input id="zone_states" value={zoneForm.states} onChange={e => setZoneForm({...zoneForm, states: e.target.value})} placeholder="e.g. Maharashtra, Delhi, Karnataka" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="zone_countries">Countries (Comma separated codes)</Label>
              <Input id="zone_countries" value={zoneForm.countries} onChange={e => setZoneForm({...zoneForm, countries: e.target.value})} placeholder="e.g. IN, US, UK (leave both blank for a catch-all zone)" className="mt-1 uppercase" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveZone} disabled={saving}>{saving ? 'Saving...' : 'Save Zone'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Modal */}
      <Dialog open={rateModalOpen} onOpenChange={setRateModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{activeRate ? 'Edit Rate' : 'Add Rate'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Rate Name</Label>
              <Input value={rateForm.name} onChange={e => setRateForm({...rateForm, name: e.target.value})} placeholder="e.g. Standard Shipping" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rate Price (₹)</Label>
                <Input type="number" value={rateForm.price} onChange={e => setRateForm({...rateForm, price: e.target.value})} placeholder="0 for Free" className="mt-1" />
              </div>
              <div>
                <Label>Condition Type</Label>
                <Select value={rateForm.type} onValueChange={v => setRateForm({...rateForm, type: v, min_value: '', max_value: ''})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">No Conditions (Flat)</SelectItem>
                    <SelectItem value="weight_based">Based on order weight</SelectItem>
                    <SelectItem value="price_based">Based on order price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {rateForm.type !== 'flat' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <Label>Min {rateForm.type === 'weight_based' ? 'Weight (g)' : 'Price (₹)'}</Label>
                  <Input type="number" value={rateForm.min_value} onChange={e => setRateForm({...rateForm, min_value: e.target.value})} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <Label>Max {rateForm.type === 'weight_based' ? 'Weight (g)' : 'Price (₹)'} (Optional)</Label>
                  <Input type="number" value={rateForm.max_value} onChange={e => setRateForm({...rateForm, max_value: e.target.value})} placeholder="No limit" className="mt-1" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRate} disabled={saving}>{saving ? 'Saving...' : 'Save Rate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
