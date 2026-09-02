'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { upsertRentalItem } from '@/actions/rentals'
import type { RentalItem, RentalCategory } from '@/types/database'

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
export function RentalItemEditor({
  item, categories = [], onDone,
}: {
  item?: RentalItem
  categories?: RentalCategory[]
  onDone?: () => void
}) {
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
    category_id: item?.category_id ?? '',
    // Kept as strings so an empty field means "not recorded" rather than 0.
    // A tent that says it weighs nothing is worse than a tent that says
    // nothing about its weight — see the storefront's "lightest first", which
    // deliberately sorts unweighed gear LAST.
    capacity: item?.capacity != null ? String(item.capacity) : '',
    weightKg: item?.weight_grams != null ? String(item.weight_grams / 1000) : '',
  })

  /** Display-only specifications, held as ordered pairs while being edited —
   *  an object would reorder itself and lose a row the moment two keys were
   *  briefly blank. Converted back on save. */
  const [specs, setSpecs] = useState<{ k: string; v: string }[]>(() =>
    Object.entries(item?.specs ?? {}).map(([k, v]) => ({ k, v: String(v) })),
  )

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
    if (f.capacity.trim() !== '' && !(Number(f.capacity) > 0)) {
      return toast.error('How many it is for has to be a whole number above zero, or blank.')
    }
    if (f.weightKg.trim() !== '' && !(Number(f.weightKg) > 0)) {
      return toast.error('A packed weight has to be above zero, or blank.')
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
        // An unset shelf is NULL, not ''. The column is a UUID foreign key and
        // an empty string is not one — it would be rejected by the database
        // rather than read as "no shelf".
        category_id: f.category_id || null,
        capacity: f.capacity.trim() === '' ? null : Math.max(1, Math.round(Number(f.capacity))),
        weight_grams: f.weightKg.trim() === '' ? null : Math.max(1, Math.round(Number(f.weightKg) * 1000)),
        // Rows with a blank label are dropped rather than saved as a spec
        // called "". The CHECK in migration 109 requires a flat object of
        // scalars, so every value goes in as a string.
        specs: Object.fromEntries(
          specs.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v.trim()]),
        ),
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

      {/* ── What it is, and what separates it from the next one ──────────
          The shelf drives the storefront's grouping and its filter rail; the
          two numbers below it are the only specifications a visitor can
          actually filter on, which is why they are columns and everything else
          is a display row. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="r-cat">Shelf</Label>
          <select
            id="r-cat"
            value={f.category_id}
            onChange={(e) => set('category_id', e.target.value)}
            className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900"
          >
            <option value="">Unfiled</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="text-[11px] text-gray-500">Unfiled gear still shows, under “Everything else”.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-cap">How many it is for</Label>
          <Input id="r-cap" inputMode="numeric" value={f.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="2" />
          <p className="text-[11px] text-gray-500">Blank where the question does not apply — poles, spikes.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-wt">Packed weight (kg)</Label>
          <Input id="r-wt" inputMode="decimal" value={f.weightKg} onChange={(e) => set('weightKg', e.target.value)} placeholder="3.2" />
          <p className="text-[11px] text-gray-500">Leave blank rather than guessing; unweighed gear sorts last, not first.</p>
        </div>
      </div>

      {/* ── Specifications ──────────────────────────────────────────────────
          Free-shape, because what is worth stating differs per shelf: a tent
          has a season rating and a pack does not. Rendered as a definition
          list on the item page. */}
      <div className="space-y-2">
        <Label>Specifications</Label>
        <p className="-mt-1 text-[11px] text-gray-500">
          Shown on the item page, in this order. Season rating, capacity in litres, fabric —
          whatever a person choosing this piece of gear would want to compare.
        </p>
        {specs.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={row.k} placeholder="Season"
              onChange={(e) => setSpecs((p) => p.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))}
              className="h-9 w-44"
            />
            <Input
              value={row.v} placeholder="Four-season"
              onChange={(e) => setSpecs((p) => p.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))}
              className="h-9 flex-1"
            />
            <Button
              type="button" size="sm" variant="ghost"
              onClick={() => setSpecs((p) => p.filter((_, j) => j !== i))}
              aria-label={`Remove the ${row.k || 'blank'} specification`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => setSpecs((p) => [...p, { k: '', v: '' }])}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add a specification
        </Button>
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
