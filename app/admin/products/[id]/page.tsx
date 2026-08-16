'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getProductEditorData, updateProduct } from '@/actions/products'
import { setProductCategories } from '@/actions/categories'
import { setProductTags } from '@/actions/tags'
import { setProductAttributes } from '@/actions/attributes'
import { generateVariants, getProductVariantsAdmin, deleteAllVariantsForProduct, getInventoryMovements, adjustStock } from '@/actions/variants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { VariantRow } from '@/components/admin/VariantRow'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { MultiCombobox } from '@/components/admin/MultiCombobox'
import { BulletListEditor } from '@/components/admin/BulletListEditor'
import { StoryBlockEditor, type StoryBlock } from '@/components/admin/StoryBlockEditor'
import { ColorwaysEditor } from '@/components/admin/ColorwaysEditor'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Save, PackageOpen, Layers, Hash, Sparkles, Boxes, Palette, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import type { Product, CategoryWithChildren, Tag, AttributeWithValues, VariantWithOptions, InventoryMovementWithDetails, CustomizationColorway } from '@/types/database'

function flattenTree(cats: CategoryWithChildren[]): (CategoryWithChildren & { depth: number })[] {
  const r: (CategoryWithChildren & { depth: number })[] = []
  for (const c of cats) { r.push({ ...c, depth: 0 }); r.push(...flattenTree(c.children).map((x) => ({ ...x, depth: x.depth + 1 }))) }
  return r
}

// The editable form, as one value. Everything that has a Save behind it lives
// here so "has this changed?" is a comparison against the loaded copy rather
// than a flag someone has to remember to set.
type Form = {
  name: string; slug: string; desc: string; shortDesc: string
  highlights: string[]; careInstructions: string; storyBlocks: StoryBlock[]
  price: string; comparePrice: string; sku: string; weight: string
  featured: boolean; isActive: boolean
  metaTitle: string; metaDesc: string; images: string[]
  isCustomizable: boolean; colorways: CustomizationColorway[]
  categoryIds: string[]; primaryCat: string
  tagIds: string[]
  attrs: Record<string, { valueId: string; textValue: string }>
}

type SectionKey = 'basic' | 'customization' | 'categories' | 'tags' | 'attributes'

// Which fields belong to which Save. Used both to work out what is dirty and to
// send only the sections that actually changed.
const SECTION_FIELDS: Record<SectionKey, (keyof Form)[]> = {
  basic: ['name', 'slug', 'desc', 'shortDesc', 'highlights', 'careInstructions', 'storyBlocks',
    'price', 'comparePrice', 'sku', 'weight', 'featured', 'isActive', 'metaTitle', 'metaDesc', 'images'],
  customization: ['isCustomizable', 'colorways'],
  categories: ['categoryIds', 'primaryCat'],
  tags: ['tagIds'],
  attributes: ['attrs'],
}

const TAB_SECTION: Record<string, SectionKey | null> = {
  basic: 'basic', categories: 'categories', tags: 'tags',
  attributes: 'attributes', variants: null, inventory: null, customization: 'customization',
}

export default function ProductEditor() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState<Form | null>(null)
  // The values as loaded. Dirtiness is form-vs-this, so nothing has to be
  // tracked by hand and a value edited back to its original stops being dirty.
  const [initial, setInitial] = useState<Form | null>(null)

  const [allCategories, setAllCategories] = useState<CategoryWithChildren[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [allAttrs, setAllAttrs] = useState<AttributeWithValues[]>([])
  const [variants, setVariants] = useState<VariantWithOptions[]>([])
  const [movements, setMovements] = useState<InventoryMovementWithDetails[]>([])

  const [genDialog, setGenDialog] = useState(false)
  const [selVarAttrs, setSelVarAttrs] = useState<string[]>([])
  const [stockDialog, setStockDialog] = useState(false)
  const [stockForm, setStockForm] = useState({ variantId: '', qty: '', reason: 'restock', notes: '' })
  const [confirmDeleteVariants, setConfirmDeleteVariants] = useState(false)
  const [saving, setSaving] = useState(false)

  const varAttrs = useMemo(() => allAttrs.filter((a) => a.is_variant_attribute), [allAttrs])
  const descriptiveAttrs = useMemo(() => allAttrs.filter((a) => !a.is_variant_attribute), [allAttrs])
  const flatCategories = useMemo(() => flattenTree(allCategories), [allCategories])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // One call. This page used to await nine in a row, which is why it sat on
      // a spinner for seconds before showing anything.
      const data = await getProductEditorData(productId)
      if (!data.product) { setNotFound(true); return }

      const p = data.product
      setProduct(p)
      setAllCategories(data.categories ?? [])
      setAllTags(data.tags ?? [])
      setAllAttrs(data.attributes ?? [])
      setVariants(data.variants ?? [])
      setMovements(data.movements ?? [])

      const cats = data.productCategories ?? []
      const attrs: Form['attrs'] = {}
      for (const a of data.productAttributes ?? []) {
        attrs[a.attribute_id] = { valueId: a.attribute_value_id ?? '', textValue: a.text_value ?? '' }
      }

      const loaded: Form = {
        name: p.name, slug: p.slug, desc: p.description ?? '', shortDesc: p.short_description ?? '',
        highlights: p.highlights ?? [], careInstructions: p.care_instructions ?? '',
        storyBlocks: p.story_blocks ?? [],
        price: String(p.price / 100),
        comparePrice: p.compare_at_price ? String(p.compare_at_price / 100) : '',
        sku: p.sku ?? '', weight: p.weight ? String(p.weight) : '',
        featured: p.is_featured, isActive: p.is_active,
        metaTitle: p.meta_title ?? '', metaDesc: p.meta_description ?? '',
        images: p.images ?? [],
        isCustomizable: p.is_customizable ?? false,
        colorways: p.customization_config?.colors ?? [],
        categoryIds: cats.map((c) => c.category_id),
        primaryCat: cats.find((c) => c.is_primary)?.category_id ?? '',
        tagIds: ((data.productTags ?? []) as Array<{ tag_id: string }>).map((t) => t.tag_id),
        attrs,
      }
      setForm(loaded)
      setInitial(loaded)
    } catch {
      toast.error('Could not load this product')
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { load() }, [load])

  const set = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }, [])

  const dirtySections = useMemo(() => {
    if (!form || !initial) return new Set<SectionKey>()
    const out = new Set<SectionKey>()
    for (const [section, fields] of Object.entries(SECTION_FIELDS) as [SectionKey, (keyof Form)[]][]) {
      if (fields.some((f) => JSON.stringify(form[f]) !== JSON.stringify(initial[f]))) out.add(section)
    }
    return out
  }, [form, initial])

  // Leaving with unsaved edits used to lose them without a word. Inline variant
  // and stock edits save immediately, so they are deliberately not counted here.
  useEffect(() => {
    if (dirtySections.size === 0) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtySections])

  async function saveAll() {
    if (!form || dirtySections.size === 0) return
    const priceNum = parseFloat(form.price)
    if (!Number.isFinite(priceNum) || priceNum < 0) { toast.error('Price must be a number'); return }
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    if (!form.slug.trim()) { toast.error('URL handle is required'); return }

    setSaving(true)
    try {
      const jobs: Promise<unknown>[] = []

      if (dirtySections.has('basic')) {
        jobs.push(updateProduct(productId, {
          name: form.name, slug: form.slug, description: form.desc, short_description: form.shortDesc,
          highlights: form.highlights.map((h) => h.trim()).filter(Boolean),
          care_instructions: form.careInstructions.trim() || null,
          story_blocks: form.storyBlocks
            .map((b) => ({ images: b.images, heading: b.heading.trim(), body: b.body.trim() }))
            .filter((b) => b.images.length > 0 && b.heading),
          price: Math.round(priceNum * 100),
          compare_at_price: form.comparePrice ? Math.round(parseFloat(form.comparePrice) * 100) : null,
          sku: form.sku || null,
          weight: form.weight ? parseFloat(form.weight) : null,
          is_featured: form.featured, is_active: form.isActive,
          meta_title: form.metaTitle || null, meta_description: form.metaDesc || null,
          images: form.images,
        }))
      }
      if (dirtySections.has('customization')) {
        jobs.push(updateProduct(productId, {
          is_customizable: form.isCustomizable,
          customization_config: form.isCustomizable ? { colors: form.colorways } : null,
        }))
      }
      if (dirtySections.has('categories')) {
        jobs.push(setProductCategories(productId, form.categoryIds.map((id) => ({
          category_id: id, is_primary: id === form.primaryCat,
        }))))
      }
      if (dirtySections.has('tags')) jobs.push(setProductTags(productId, form.tagIds))
      if (dirtySections.has('attributes')) {
        jobs.push(setProductAttributes(productId, Object.entries(form.attrs).map(([id, v]) => ({
          attribute_id: id, attribute_value_id: v.valueId || null, text_value: v.textValue || null,
        }))))
      }

      await Promise.all(jobs)
      setInitial(form)
      setProduct((p) => (p ? { ...p, name: form.name, slug: form.slug } : p))
      toast.success(`Saved ${jobs.length} change${jobs.length === 1 ? '' : 's'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function doGenerateVariants() {
    setSaving(true)
    try {
      await deleteAllVariantsForProduct(productId)
      await generateVariants(productId, selVarAttrs)
      setVariants((await getProductVariantsAdmin(productId)) ?? [])
      setGenDialog(false)
      toast.success('Variants generated')
    } catch { toast.error('Failed to generate variants') }
    finally { setSaving(false) }
  }

  async function doDeleteAllVariants() {
    setConfirmDeleteVariants(false)
    try {
      await deleteAllVariantsForProduct(productId)
      setVariants([])
      toast.success('All variants deleted')
    } catch { toast.error('Failed to delete variants') }
  }

  async function doStockAdjust() {
    const qty = parseInt(stockForm.qty, 10)
    if (!Number.isFinite(qty) || qty === 0) { toast.error('Enter a non-zero quantity'); return }
    setSaving(true)
    try {
      await adjustStock({
        product_id: productId, variant_id: stockForm.variantId || null,
        quantity_change: qty, reason: stockForm.reason as 'restock' | 'adjustment' | 'damaged',
        notes: stockForm.notes || undefined,
      })
      const [nextMovements, nextVariants] = await Promise.all([
        getInventoryMovements(productId),
        getProductVariantsAdmin(productId),
      ])
      setMovements(nextMovements ?? [])
      setVariants(nextVariants ?? [])
      setStockDialog(false)
      toast.success('Stock adjusted')
    } catch { toast.error('Failed to adjust stock') }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-40" /></div>
        <Skeleton className="h-10 w-full max-w-3xl" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2"><Skeleton className="h-72 w-full" /><Skeleton className="h-40 w-full" /></div>
          <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-56 w-full" /></div>
        </div>
      </div>
    )
  }
  if (notFound || !product || !form) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium text-gray-900">Product not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/products')}>Back to products</Button>
      </div>
    )
  }

  const dirtyCount = dirtySections.size
  const tabTrigger = (value: string, label: string, Icon?: typeof PackageOpen) => {
    const section = TAB_SECTION[value]
    const isDirty = section ? dirtySections.has(section) : false
    return (
      <TabsTrigger value={value} className="gap-1.5 data-[state=active]:bg-black data-[state=active]:text-white">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
        {/* An unsaved change is invisible once you switch tabs unless the tab
            itself says so. */}
        {isDirty && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes" />}
      </TabsTrigger>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/products')}><ArrowLeft className="mr-1 h-4 w-4" /> Products</Button>
          <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-black">{product.name}</h2>
          <p className="truncate font-mono text-sm text-gray-500">{product.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          {dirtyCount > 0 && <span className="text-sm text-amber-600">{dirtyCount} unsaved section{dirtyCount === 1 ? '' : 's'}</span>}
          <Button onClick={saveAll} disabled={saving || dirtyCount === 0} className="bg-black hover:bg-black/90">
            <Save className="mr-1 h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic">
        {/* Scrolls rather than wrapping into a second row that shifts the page. */}
        <TabsList className="flex w-full justify-start overflow-x-auto bg-gray-100">
          {tabTrigger('basic', 'Basic', PackageOpen)}
          {tabTrigger('categories', 'Categories', Layers)}
          {tabTrigger('tags', 'Tags', Hash)}
          {tabTrigger('attributes', 'Attributes', Sparkles)}
          {tabTrigger('variants', 'Variants', Boxes)}
          {tabTrigger('inventory', 'Inventory', ClipboardList)}
          {tabTrigger('customization', 'Customization', Palette)}
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-6 md:col-span-2">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader><CardTitle>General Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Product Name *</Label>
                    <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Full Description</Label>
                    <Textarea value={form.desc} onChange={(e) => set('desc', e.target.value)} rows={5} placeholder="Describe the product details, fit, and materials..." className="mt-1" />
                  </div>
                  <div>
                    <Label>Short Description</Label>
                    <Input value={form.shortDesc} onChange={(e) => set('shortDesc', e.target.value)} placeholder="A quick summary for product cards" className="mt-1" />
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <Label>Highlights</Label>
                    <p className="mb-2 text-xs text-gray-400">Short, punchy differentiators shown as bullets on the product page — leave empty to hide the section.</p>
                    <BulletListEditor value={form.highlights} onChange={(v) => set('highlights', v)} />
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <Label>Care Instructions</Label>
                    <p className="mb-1 text-xs text-gray-400">Leave blank to show generic care guidance on the product page instead.</p>
                    <Textarea value={form.careInstructions} onChange={(e) => set('careInstructions', e.target.value)} rows={3} placeholder="e.g. Machine wash cold, no bleach." className="mt-1" />
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <Label>Product Story</Label>
                    <p className="mb-2 text-xs text-gray-400">Full-bleed image + text sections shown between Highlights and Specifications. Leave empty to hide the section.</p>
                    <StoryBlockEditor value={form.storyBlocks} onChange={(v) => set('storyBlocks', v)} />
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <Label>Images</Label>
                    <div className="mt-1"><ImageUploader bucket="PRODUCTS" value={form.images} onChange={(v) => set('images', v)} /></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                  <CardDescription>Base price for the product. Variants adjust from here.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Price (₹) *</Label>
                    <Input value={form.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" className="mt-1 tabular-nums" />
                  </div>
                  <div>
                    <Label>Compare-at Price (₹)</Label>
                    <Input value={form.comparePrice} onChange={(e) => set('comparePrice', e.target.value)} inputMode="decimal" className="mt-1 tabular-nums" />
                  </div>
                  <div>
                    <Label>SKU</Label>
                    <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} className="mt-1 font-mono" />
                  </div>
                  <div>
                    <Label>Weight (g)</Label>
                    <Input value={form.weight} onChange={(e) => set('weight', e.target.value)} inputMode="decimal" className="mt-1 tabular-nums" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader><CardTitle>Organization & Status</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-100 p-3 transition-colors hover:bg-gray-50">
                    <Checkbox checked={form.isActive} onCheckedChange={(v) => set('isActive', !!v)} />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Active Product</div>
                      <div className="text-xs text-gray-500">Available on storefront</div>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-100 p-3 transition-colors hover:bg-gray-50">
                    <Checkbox checked={form.featured} onCheckedChange={(v) => set('featured', !!v)} />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Featured</div>
                      <div className="text-xs text-gray-500">Show on homepage</div>
                    </div>
                  </label>
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Search Engine Optimization</CardTitle>
                  <CardDescription>How this product appears in Google</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>URL Handle (Slug) *</Label>
                    <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} className="mt-1 bg-gray-50 font-mono text-sm text-gray-600" />
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <Label className="text-xs text-gray-500">Meta Title</Label>
                    <Input value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder="Max 70 chars" className="mt-1 h-8 text-sm" />
                    <p className="mt-1 text-[11px] text-gray-400">{form.metaTitle.length}/70</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Meta Description</Label>
                    <Textarea value={form.metaDesc} onChange={(e) => set('metaDesc', e.target.value)} placeholder="Max 160 chars" rows={3} className="mt-1 resize-none text-sm" />
                    <p className="mt-1 text-[11px] text-gray-400">{form.metaDesc.length}/160</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Card className="max-w-2xl">
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label>Categories</Label>
                <div className="mt-1">
                  <MultiCombobox
                    options={flatCategories.map((c) => ({ value: c.id, label: c.name, depth: c.depth }))}
                    selected={form.categoryIds}
                    onChange={(ids) => {
                      setForm((f) => (f ? {
                        ...f,
                        categoryIds: ids,
                        primaryCat: ids.includes(f.primaryCat) ? f.primaryCat : (ids[0] ?? ''),
                      } : f))
                    }}
                    placeholder="Search categories..."
                    emptyText="No matching categories."
                  />
                </div>
              </div>
              {form.categoryIds.length > 0 && (
                <div>
                  <Label>Primary Category</Label>
                  <p className="mb-1 text-xs text-gray-400">Used for breadcrumbs and the product&apos;s canonical path.</p>
                  <Select value={form.primaryCat} onValueChange={(v) => set('primaryCat', v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose primary" /></SelectTrigger>
                    <SelectContent>
                      {flatCategories.filter((c) => form.categoryIds.includes(c.id)).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="mt-4">
          <Card className="max-w-2xl">
            <CardContent className="space-y-4 pt-6">
              {allTags.length === 0 ? (
                <p className="text-sm text-gray-400">No tags yet. <a href="/admin/tags" className="text-black underline">Create some</a>.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allTags.map((t) => {
                    const on = form.tagIds.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => set('tagIds', on ? form.tagIds.filter((id) => id !== t.id) : [...form.tagIds, t.id])}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
                      >
                        {t.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attributes" className="mt-4">
          <Card className="max-w-2xl">
            <CardContent className="space-y-4 pt-6">
              {descriptiveAttrs.length === 0 ? (
                <p className="text-sm text-gray-400">No descriptive attributes. <a href="/admin/attributes" className="text-black underline">Create some</a>.</p>
              ) : descriptiveAttrs.map((a) => (
                <div key={a.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <Label>{a.name}</Label>
                  <div className="mt-1">
                    {a.input_type === 'select' && a.values?.length ? (
                      <Select
                        value={form.attrs[a.id]?.valueId || 'none'}
                        onValueChange={(v) => set('attrs', { ...form.attrs, [a.id]: { valueId: v === 'none' ? '' : v, textValue: '' } })}
                      >
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {a.values.map((v) => (<SelectItem key={v.id} value={v.id}>{v.value}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    ) : a.input_type === 'boolean' ? (
                      <Select
                        value={form.attrs[a.id]?.textValue || 'none'}
                        onValueChange={(v) => set('attrs', { ...form.attrs, [a.id]: { valueId: '', textValue: v === 'none' ? '' : v } })}
                      >
                        <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not set</SelectItem>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={form.attrs[a.id]?.textValue ?? ''}
                        onChange={(e) => set('attrs', { ...form.attrs, [a.id]: { valueId: '', textValue: e.target.value } })}
                        placeholder="Value"
                      />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variants" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{variants.length} variant{variants.length === 1 ? '' : 's'}</p>
                  <p className="text-xs text-gray-400">Edits here save on their own — they are not part of Save changes.</p>
                </div>
                <div className="flex gap-2">
                  {variants.length > 0 && (
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setConfirmDeleteVariants(true)}>Delete all</Button>
                  )}
                  <Button size="sm" onClick={() => setGenDialog(true)}>Generate variants</Button>
                </div>
              </div>
              {variants.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No variants yet. Generate them from your variant attributes.</p>
              ) : (
                <Table className="min-w-[820px] table-fixed">
                  <colgroup>
                    <col className="w-[240px]" /><col className="w-[170px]" /><col className="w-[130px]" />
                    <col className="w-[110px]" /><col className="w-[120px]" /><col className="w-[70px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-10 px-3">Variant</TableHead>
                      <TableHead className="h-10 px-3">SKU</TableHead>
                      <TableHead className="h-10 px-3 text-right">Price adj.</TableHead>
                      <TableHead className="h-10 px-3 text-right">Stock</TableHead>
                      <TableHead className="h-10 px-3 text-right">Low at</TableHead>
                      <TableHead className="h-10 px-3" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((v) => (
                      <VariantRow key={v.id} variant={v} onChange={setVariants} variants={variants} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Inventory movements</p>
                  <p className="text-xs text-gray-400">
                    {movements.length === 0 ? 'Every sale, restock and adjustment lands here.' : `Showing the ${movements.length} most recent.`}
                  </p>
                </div>
                <Button size="sm" onClick={() => { setStockForm({ variantId: '', qty: '', reason: 'restock', notes: '' }); setStockDialog(true) }}>Adjust stock</Button>
              </div>
              {movements.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No movements recorded.</p>
              ) : (
                <Table className="min-w-[760px] table-fixed">
                  <colgroup>
                    <col className="w-[130px]" /><col className="w-[190px]" /><col className="w-[100px]" />
                    <col className="w-[120px]" /><col className="w-[220px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-10 px-3">Date</TableHead>
                      <TableHead className="h-10 px-3">Variant</TableHead>
                      <TableHead className="h-10 px-3 text-right">Change</TableHead>
                      <TableHead className="h-10 px-3">Reason</TableHead>
                      <TableHead className="h-10 px-3">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="px-3 py-2 text-xs whitespace-nowrap text-gray-500">
                          {new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-sm text-gray-600"><span className="block truncate">{m.variant?.name ?? 'Base product'}</span></TableCell>
                        <TableCell className={`px-3 py-2 text-right font-medium tabular-nums ${m.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Badge variant={m.reason === 'sale' ? 'outline' : m.reason === 'restock' ? 'default' : m.reason === 'damaged' ? 'destructive' : 'secondary'}>{m.reason}</Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-gray-500"><span className="block truncate" title={m.notes ?? ''}>{m.notes ?? '—'}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customization" className="mt-4">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <label className="flex max-w-md cursor-pointer items-center gap-3 rounded-md border border-gray-100 p-3 transition-colors hover:bg-gray-50">
                <Checkbox checked={form.isCustomizable} onCheckedChange={(v) => set('isCustomizable', !!v)} />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Customizable product</div>
                  <div className="text-xs text-gray-500">
                    Shoppers get a &ldquo;Customize&rdquo; button instead of Add to Cart, and design in the studio before checkout.
                  </div>
                </div>
              </label>
              {form.isCustomizable && (
                <div className="border-t border-gray-100 pt-4">
                  <ColorwaysEditor value={form.colorways} onChange={(v) => set('colorways', v)} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={genDialog} onOpenChange={setGenDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate variants</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">Every combination of the selected attributes is created. This replaces the existing variants, including their stock and SKUs.</p>
          <div className="space-y-1">
            {varAttrs.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-gray-50">
                <Checkbox
                  checked={selVarAttrs.includes(a.id)}
                  onCheckedChange={(v) => setSelVarAttrs(v ? [...selVarAttrs, a.id] : selVarAttrs.filter((id) => id !== a.id))}
                />
                <span className="text-sm">{a.name}</span>
                <span className="text-xs text-gray-400">({a.values?.length ?? 0} values)</span>
              </label>
            ))}
            {varAttrs.length === 0 && (
              <p className="text-sm text-gray-400">No variant attributes yet (e.g. Size, Color). <a href="/admin/attributes" className="text-black underline">Create one</a> and mark it as a variant attribute.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenDialog(false)}>Cancel</Button>
            <Button onClick={doGenerateVariants} disabled={saving || selVarAttrs.length === 0}>{saving ? 'Generating…' : 'Generate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockDialog} onOpenChange={setStockDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust stock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Variant</Label>
              <Select value={stockForm.variantId || 'none'} onValueChange={(v) => setStockForm({ ...stockForm, variantId: v === 'none' ? '' : v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Base product" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Base product (no variant)</SelectItem>
                  {variants.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity change *</Label>
              <Input value={stockForm.qty} onChange={(e) => setStockForm({ ...stockForm, qty: e.target.value })} inputMode="numeric" placeholder="e.g. 10 to add, -5 to remove" className="mt-1 tabular-nums" />
            </div>
            <div>
              <Label>Reason</Label>
              <Select value={stockForm.reason} onValueChange={(v) => setStockForm({ ...stockForm, reason: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">Restock</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={stockForm.notes} onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialog(false)}>Cancel</Button>
            <Button onClick={doStockAdjust} disabled={saving || !stockForm.qty}>{saving ? 'Adjusting…' : 'Adjust'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteVariants}
        onOpenChange={setConfirmDeleteVariants}
        title={`Delete all ${variants.length} variants?`}
        description="Their stock levels and SKUs are deleted with them. This cannot be undone."
        confirmLabel="Delete all"
        onConfirm={doDeleteAllVariants}
      />
    </div>
  )
}
