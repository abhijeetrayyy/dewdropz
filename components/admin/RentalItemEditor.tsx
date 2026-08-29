'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { upsertRentalItem } from '@/actions/rentals'
import type { RentalItem } from '@/types/database'

/**
 * Adding and editing hireable gear.
 *
 * Without this, rental items could only come into existence through
 * `scripts/seed-rentals.mjs` — the admin screen could add UNITS to gear that
 * already existed and change their condition, but there was no way to put a
 * new item in the locker or give one a photograph. That is why /rent showed
 * "Photograph to come" on every row: nobody could upload one.
 *
 * MONEY IS ENTERED IN RUPEES AND STORED IN PAISE. Every amount in this
 * database is an integer number of paise, and the conversion happens here, at
 * the edge, exactly once. A shopkeeper typing "450" means ₹450; storing 450
 * paise would quietly make a tent cost four and a half rupees a day.
 */
export function RentalItemEditor({ item, onDone }: { item?: RentalItem; onDone?: () => void }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    name: item?.name ?? '',
    slug: item?.slug ?? '',
    summary: item?.summary ?? '',
    description: item?.description ?? '',
    images: item?.images ?? [],
    dailyRupees: item ? String(item.daily_rate / 100) : '',
    depositRupees: item ? String(item.deposit / 100) : '',
    weekly_discount_pct: String(item?.weekly_discount_pct ?? 0),
    min_days: String(item?.min_days ?? 1),
    max_days: String(item?.max_days ?? 21),
    buffer_days: String(item?.buffer_days ?? 1),
    gst_rate: String(item?.gst_rate ?? 18),
    sac_code: item?.sac_code ?? '997314',
    allows_pickup: item?.allows_pickup ?? true,
    allows_shipping: item?.allows_shipping ?? false,
    is_active: item?.is_active ?? true,
  })

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  // Typing a name on a NEW item fills the slug; editing an existing one leaves
  // it alone, because a slug already in use is a URL somebody may have shared.
  function setName(name: string) {
    setF((p) => ({
      ...p,
      name,
      slug: item ? p.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60),
    }))
  }

  async function save() {
    const daily = Math.round(Number(f.dailyRupees) * 100)
    const deposit = Math.round(Number(f.depositRupees) * 100)
    if (!f.name.trim() || !f.slug.trim()) return toast.error('It needs a name and a slug.')
    if (!Number.isFinite(daily) || daily <= 0) return toast.error('Give it a day rate.')
    if (!f.allows_pickup && !f.allows_shipping) {
      return toast.error('It has to be collectable or postable — otherwise nobody can get it.')
    }
    if (Number(f.max_days) < Number(f.min_days)) {
      return toast.error('The maximum rental cannot be shorter than the minimum.')
    }

    setSaving(true)
    try {
      const res = await upsertRentalItem({
        ...(item ? { id: item.id } : {}),
        name: f.name.trim(),
        slug: f.slug.trim(),
        summary: f.summary.trim() || null,
        description: f.description.trim() || null,
        images: f.images,
        daily_rate: daily,
        deposit,
        weekly_discount_pct: Number(f.weekly_discount_pct) || 0,
        min_days: Number(f.min_days) || 1,
        max_days: Number(f.max_days) || 21,
        buffer_days: Number(f.buffer_days) || 0,
        gst_rate: Number(f.gst_rate) || 18,
        sac_code: f.sac_code.trim() || null,
        allows_pickup: f.allows_pickup,
        allows_shipping: f.allows_shipping,
        is_active: f.is_active,
      } as Partial<RentalItem> & { name: string; slug: string })
      if (!res.ok) { toast.error(res.error); return }
      toast.success(item ? 'Saved' : `${f.name} is in the locker`)
      router.refresh()
      onDone?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="r-name">Name</Label>
          <Input id="r-name" value={f.name} onChange={(e) => setName(e.target.value)} placeholder="Four-Season Tent (2P)" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-slug">Slug</Label>
          <Input id="r-slug" value={f.slug} onChange={(e) => set('slug', e.target.value)} placeholder="four-season-tent" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="r-sum">One line, for the list</Label>
        <Input id="r-sum" value={f.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Double-wall, taped seams, holds a ridge in wind." />
      </div>

      <div className="space-y-1">
        <Label htmlFor="r-desc">The full description</Label>
        <Textarea id="r-desc" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>Photographs</Label>
        <ImageUploader bucket="PRODUCTS" value={f.images} onChange={(urls) => set('images', urls)} maxFiles={6} />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="r-rate">Day rate (₹)</Label>
          <Input id="r-rate" inputMode="decimal" value={f.dailyRupees} onChange={(e) => set('dailyRupees', e.target.value)} placeholder="450" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-dep">Deposit (₹)</Label>
          <Input id="r-dep" inputMode="decimal" value={f.depositRupees} onChange={(e) => set('depositRupees', e.target.value)} placeholder="9000" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-disc">Long-rental discount (%)</Label>
          <Input id="r-disc" inputMode="numeric" value={f.weekly_discount_pct} onChange={(e) => set('weekly_discount_pct', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-gst">GST (%)</Label>
          <Input id="r-gst" inputMode="decimal" value={f.gst_rate} onChange={(e) => set('gst_rate', e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="r-min">Minimum days</Label>
          <Input id="r-min" inputMode="numeric" value={f.min_days} onChange={(e) => set('min_days', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-max">Maximum days</Label>
          <Input id="r-max" inputMode="numeric" value={f.max_days} onChange={(e) => set('max_days', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-buf">Turnaround days</Label>
          <Input id="r-buf" inputMode="numeric" value={f.buffer_days} onChange={(e) => set('buffer_days', e.target.value)} />
          <p className="text-[11px] text-gray-500">Held back after each return for drying and checking.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-sac">SAC code</Label>
          <Input id="r-sac" value={f.sac_code} onChange={(e) => set('sac_code', e.target.value)} />
          <p className="text-[11px] text-gray-500">A rental is a service, not a sale — SAC, not HSN.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-5 pt-1">
        {([
          ['allows_pickup', 'Can be collected'],
          ['allows_shipping', 'Can be posted'],
          ['is_active', 'Listed for rent'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
            <Checkbox checked={f[key]} onCheckedChange={(v) => set(key, v === true)} />
            {label}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
          {item ? 'Save changes' : 'Add to the locker'}
        </Button>
        {onDone && <Button variant="ghost" onClick={onDone}>Cancel</Button>}
      </div>
    </div>
  )
}
