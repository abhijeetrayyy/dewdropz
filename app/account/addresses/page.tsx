'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress } from '@/actions/addresses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Address } from '@/types/database'

const emptyForm = {
  full_name: '', phone: '', address_line1: '', address_line2: '',
  city: '', state: '', postal_code: '', is_default: false,
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAddresses(await getAddresses())
    } catch {
      toast.error('Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(addr: Address) {
    setEditingId(addr.id)
    setForm({
      full_name: addr.full_name, phone: addr.phone, address_line1: addr.address_line1,
      address_line2: addr.address_line2 ?? '', city: addr.city, state: addr.state,
      postal_code: addr.postal_code, is_default: addr.is_default,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = editingId
        ? await updateAddress(editingId, form)
        : await createAddress(form)
      if (result && 'error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'Please check the form for errors')
        return
      }
      toast.success(editingId ? 'Address updated' : 'Address added')
      setDialogOpen(false)
      load()
    } catch {
      toast.error('Failed to save address')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteAddress(deleteTarget.id)
      toast.success('Address removed')
      setDeleteTarget(null)
      load()
    } catch {
      toast.error('Failed to remove address')
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultAddress(id)
      toast.success('Default address updated')
      load()
    } catch {
      toast.error('Failed to update default address')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-text">Addresses</h2>
        <Button onClick={openAdd} className="bg-forest hover:bg-forest-mid">+ Add Address</Button>
      </div>

      {loading ? (
        <p className="font-body text-sm text-mid">Loading…</p>
      ) : addresses.length === 0 ? (
        <div className="p-8 border border-dashed border-rule rounded-sm text-center">
          <p className="font-body text-sm text-mid">No saved addresses yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div key={addr.id} className="p-5 border border-rule rounded-sm bg-paper space-y-2">
              <div className="flex items-start justify-between">
                <div className="font-body text-sm font-medium text-text">{addr.full_name}</div>
                {addr.is_default && (
                  <span className="px-1.5 py-0.5 rounded-sm bg-forest/10 text-forest text-[10px] tracking-[0.08em] uppercase">
                    Default
                  </span>
                )}
              </div>
              <div className="font-body text-sm text-mid leading-relaxed">
                {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}<br />
                {addr.city}, {addr.state} {addr.postal_code}<br />
                {addr.phone}
              </div>
              <div className="flex items-center gap-4 pt-2 font-body text-xs">
                <button type="button" onClick={() => openEdit(addr)} className="text-forest hover:underline">Edit</button>
                {!addr.is_default && (
                  <button type="button" onClick={() => handleSetDefault(addr.id)} className="text-mid hover:text-forest transition-colors">
                    Set as default
                  </button>
                )}
                <button type="button" onClick={() => setDeleteTarget(addr)} className="text-clay hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Address' : 'Add Address'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Address Line 1</Label>
              <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
            </div>
            <div>
              <Label>Address Line 2 (optional)</Label>
              <Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <Checkbox checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: !!v })} />
              <span className="font-body text-sm text-text">Set as default address</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-forest hover:bg-forest-mid">
              {saving ? 'Saving…' : 'Save Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this address?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.full_name} — {deleteTarget?.address_line1}. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
