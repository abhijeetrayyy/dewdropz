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
import { Surface } from '@/components/ui/surface'
import EmptyState from '@/components/ui/empty-state'
import { MapPin, Plus, Star } from 'lucide-react'
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-text">Addresses</h2>
          <p className="mt-1 font-body text-sm text-mid">
            Where your orders go. The default is used first at checkout.
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0 gap-1.5 rounded-full bg-forest hover:bg-forest-mid">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Add
        </Button>
      </div>

      {loading ? (
        /* A skeleton in the shape of the answer, rather than the word
           "Loading…" — the layout no longer jumps when the data lands. */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Surface key={i} elevation="flat" className="animate-pulse p-5">
              <div className="h-3.5 w-32 rounded-full bg-rule/60" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded-full bg-paper-warm" />
                <div className="h-3 w-3/4 rounded-full bg-paper-warm" />
              </div>
            </Surface>
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" strokeWidth={1.5} />}
          title="No addresses saved."
          body="Add one now and checkout gets a good deal shorter next time."
          secondary={{ label: 'Add an address', onClick: openAdd }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            /* The default address is the one that matters, so it is the one
               that looks different — a forest edge and a marked badge, rather
               than the identical box with a quiet grey label it had before. */
            <Surface
              key={addr.id}
              className={`flex flex-col p-5 ${addr.is_default ? 'border-forest/40 ring-1 ring-forest/10' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-body text-sm font-medium text-text">{addr.full_name}</div>
                {addr.is_default && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-tag)] bg-sage-soft px-1.5 py-0.5 font-body text-[10px] uppercase tracking-[0.08em] text-forest">
                    <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                    Default
                  </span>
                )}
              </div>

              <address className="mt-2 flex-1 font-body text-sm not-italic leading-relaxed text-mid">
                {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}<br />
                {addr.city}, {addr.state} {addr.postal_code}<br />
                <span className="font-mono text-xs">{addr.phone}</span>
              </address>

              <div className="mt-4 flex items-center gap-4 border-t border-rule-soft pt-3 font-body text-xs">
                <button type="button" onClick={() => openEdit(addr)} className="text-forest transition-colors hover:text-forest-mid">
                  Edit
                </button>
                {!addr.is_default && (
                  <button type="button" onClick={() => handleSetDefault(addr.id)} className="text-mid transition-colors hover:text-forest">
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(addr)}
                  className="ml-auto text-light transition-colors hover:text-clay-deep"
                >
                  Delete
                </button>
              </div>
            </Surface>
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
            <AlertDialogAction onClick={handleDelete} className="bg-clay-deep hover:bg-clay focus:ring-clay-deep">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
