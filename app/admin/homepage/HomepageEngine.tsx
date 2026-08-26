'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { getStoreSettings, updateStoreSettings } from '@/actions/settings'
import { getProducts, getCollections } from '@/actions/products'
import { getCategories } from '@/actions/categories'
import type {
  HomeConfig, ProductWithCollection, Collection, Category, HomeStat, HomeShowcaseRail, HomeShowcaseKind,
  HomeTrail,
} from '@/types/database'

// Exactly the labels components/sections/HomeTrails.tsx draws its month strip
// from. A month typed any other way simply never lights a cell, so the two
// lists have to be the same twelve strings.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const RAIL_KINDS: { value: HomeShowcaseKind; label: string; hint: string }[] = [
  { value: 'recent', label: 'Just added', hint: 'Newest active products first.' },
  { value: 'best_sellers', label: 'Best sellers', hint: 'Ranked by units actually ordered.' },
  { value: 'category', label: 'From a category', hint: 'Everything in one category.' },
  { value: 'collection', label: 'From a collection', hint: 'Everything in one collection.' },
]

// The homepage's two product-showcase sections (Season Kit, The Climb) and its
// featured-collections row all read from store_settings.home_config now
// instead of a hardcoded catalogue snapshot — see migration
// 025_home_config.sql. This is the one place that config gets edited.
export function HomepageEngine() {
  const [config, setConfig] = useState<HomeConfig | null>(null)
  const [products, setProducts] = useState<ProductWithCollection[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [settings, productList, collectionList, categoryList] = await Promise.all([
          getStoreSettings(),
          getProducts(),
          getCollections(),
          // Every category, NOT { parentId: null }. That returned only the two
          // departments — Apparel and Drinkware — so the tiles the homepage
          // actually shows (Caps, Coffee Mugs, Bottles, Tumblers, all of them
          // leaves) could not be ticked here at all. The same mistake the
          // homepage itself used to make against this list.
          getCategories(),
        ])
        setConfig(settings.home_config)
        setProducts(productList)
        setCollections(collectionList)
        setCategories(categoryList)
      } catch {
        toast.error('Failed to load homepage settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave() {
    if (!config) return
    setSaving(true)
    try {
      const result = await updateStoreSettings({ home_config: config })
      if (!result.ok) throw new Error(result.error)
      toast.success('Homepage settings saved')
    } catch {
      toast.error('Failed to save homepage settings')
    } finally {
      setSaving(false)
    }
  }

  function toggleSeasonProduct(slug: string, checked: boolean) {
    if (!config) return
    const product_slugs = checked
      ? [...config.season_kit.product_slugs, slug]
      : config.season_kit.product_slugs.filter((s) => s !== slug)
    setConfig({ ...config, season_kit: { ...config.season_kit, product_slugs } })
  }

  function toggleFeaturedCollection(slug: string, checked: boolean) {
    if (!config) return
    const featured_collection_slugs = checked
      ? [...config.featured_collection_slugs, slug]
      : config.featured_collection_slugs.filter((s) => s !== slug)
    setConfig({ ...config, featured_collection_slugs })
  }

  function toggleFeaturedCategory(slug: string, checked: boolean) {
    if (!config) return
    const featured_category_slugs = checked
      ? [...config.featured_category_slugs, slug]
      : config.featured_category_slugs.filter((s) => s !== slug)
    setConfig({ ...config, featured_category_slugs })
  }

  function updateStat(index: number, patch: Partial<HomeStat>) {
    if (!config) return
    setConfig({ ...config, stats: config.stats.map((s, i) => (i === index ? { ...s, ...patch } : s)) })
  }

  function addStat() {
    if (!config) return
    setConfig({ ...config, stats: [...config.stats, { value: 0, suffix: '', label: '', plain: false }] })
  }

  function removeStat(index: number) {
    if (!config) return
    setConfig({ ...config, stats: config.stats.filter((_, i) => i !== index) })
  }

  function updateRail(index: number, patch: Partial<HomeShowcaseRail>) {
    if (!config) return
    setConfig({ ...config, showcase: config.showcase.map((r, i) => (i === index ? { ...r, ...patch } : r)) })
  }

  function addRail() {
    if (!config) return
    setConfig({
      ...config,
      showcase: [
        ...config.showcase,
        {
          id: `rail-${Date.now()}`,
          kind: 'recent',
          title: 'New rail',
          category_slug: null,
          collection_slug: null,
          limit: 8,
          enabled: true,
        },
      ],
    })
  }

  function removeRail(index: number) {
    if (!config) return
    setConfig({ ...config, showcase: config.showcase.filter((_, i) => i !== index) })
  }

  function moveRail(index: number, dir: -1 | 1) {
    if (!config) return
    const target = index + dir
    if (target < 0 || target >= config.showcase.length) return
    const showcase = [...config.showcase]
    ;[showcase[index], showcase[target]] = [showcase[target], showcase[index]]
    setConfig({ ...config, showcase })
  }

  // ── The Trails section ───────────────────────────────────────────────────
  // "Keep options so that DEWDROPZ team can add more treks etc in this section
  // with the current layout — Easy-Moderate, Season, days and writeup." These
  // four cards used to be a hardcoded list of slugs inside the component.
  const trails = config?.trails ?? []

  function updateTrail(index: number, patch: Partial<HomeTrail>) {
    if (!config) return
    setConfig({ ...config, trails: trails.map((t, i) => (i === index ? { ...t, ...patch } : t)) })
  }

  function addTrail() {
    if (!config) return
    setConfig({
      ...config,
      trails: [
        ...trails,
        {
          // Unique enough to be a React key and a URL fragment. If it matches a
          // route in the /treks guide the card deep-links at it; if not, the
          // card links to the guide index instead of a 404.
          slug: `trail-${Date.now()}`,
          name: '',
          altitude: '',
          difficulty: 'Moderate',
          duration: '',
          bestMonths: [],
          season: '',
          image: '',
        },
      ],
    })
  }

  function removeTrail(index: number) {
    if (!config) return
    setConfig({ ...config, trails: trails.filter((_, i) => i !== index) })
  }

  function moveTrail(index: number, dir: -1 | 1) {
    if (!config) return
    const target = index + dir
    if (target < 0 || target >= trails.length) return
    const next = [...trails]
    ;[next[index], next[target]] = [next[target], next[index]]
    setConfig({ ...config, trails: next })
  }

  function toggleTrailMonth(index: number, month: string, on: boolean) {
    if (!config) return
    const current = trails[index]?.bestMonths ?? []
    // Kept in calendar order however they are clicked — the storefront draws a
    // twelve-cell strip from this and reads the array for its screen-reader
    // label, so "Oct, Jan, Feb" would be announced in that order.
    const next = on
      ? MONTHS.filter((m) => m === month || current.includes(m))
      : current.filter((m) => m !== month)
    updateTrail(index, { bestMonths: next })
  }

  function updateStation(index: number, patch: Partial<HomeConfig['climb']['stations'][number]>) {
    if (!config) return
    const stations = config.climb.stations.map((s, i) => (i === index ? { ...s, ...patch } : s))
    setConfig({ ...config, climb: { ...config.climb, stations } })
  }

  function addStation() {
    if (!config) return
    const nextLabel = String(config.climb.stations.length + 1).padStart(2, '0')
    setConfig({
      ...config,
      climb: {
        ...config.climb,
        stations: [...config.climb.stations, { product_slug: products[0]?.slug ?? '', label: nextLabel, line: '' }],
      },
    })
  }

  function removeStation(index: number) {
    if (!config) return
    setConfig({ ...config, climb: { ...config.climb, stations: config.climb.stations.filter((_, i) => i !== index) } })
  }

  function moveStation(index: number, dir: -1 | 1) {
    if (!config) return
    const target = index + dir
    if (target < 0 || target >= config.climb.stations.length) return
    const stations = [...config.climb.stations]
    ;[stations[index], stations[target]] = [stations[target], stations[index]]
    setConfig({ ...config, climb: { ...config.climb, stations } })
  }

  if (loading || !config) {
    return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 max-w-2xl">
          Controls the two product-showcase sections on the homepage and which collections lead the &quot;Three
          conditions, three kits&quot; row — no code change needed to swap what&apos;s being sold there.
        </p>
        <Button onClick={handleSave} disabled={saving} className="bg-black hover:bg-black/90 flex-shrink-0">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Homepage Settings
        </Button>
      </div>

      {/* Season Kit */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Season Kit section</CardTitle>
              <CardDescription>The first product block on the homepage, right after the trust band.</CardDescription>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <Checkbox
                checked={config.season_kit.enabled}
                onCheckedChange={(c) => setConfig({ ...config, season_kit: { ...config.season_kit, enabled: !!c } })}
              />
              Show on homepage
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Eyebrow</Label>
              <Input
                value={config.season_kit.eyebrow}
                onChange={(e) => setConfig({ ...config, season_kit: { ...config.season_kit, eyebrow: e.target.value } })}
                placeholder="Now shipping"
              />
            </div>
            <div className="space-y-2">
              <Label>Linked collection (optional)</Label>
              <Select
                value={config.season_kit.collection_slug ?? 'none'}
                onValueChange={(v) =>
                  setConfig({ ...config, season_kit: { ...config.season_kit, collection_slug: v === 'none' ? null : v } })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Headline</Label>
            <Input
              value={config.season_kit.headline}
              onChange={(e) => setConfig({ ...config, season_kit: { ...config.season_kit, headline: e.target.value } })}
            />
          </div>
          <div className="space-y-2">
            <Label>Body text</Label>
            <Textarea
              value={config.season_kit.line}
              onChange={(e) => setConfig({ ...config, season_kit: { ...config.season_kit, line: e.target.value } })}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Products in this kit</Label>
            <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 p-3">
              {products.length === 0 ? (
                <p className="text-sm text-gray-400">No active products yet.</p>
              ) : (
                products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={config.season_kit.product_slugs.includes(p.slug)}
                      onCheckedChange={(c) => toggleSeasonProduct(p.slug, !!c)}
                    />
                    {p.name}
                  </label>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The Climb */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">The Climb section</CardTitle>
              <CardDescription>The station-by-station product story further down the homepage.</CardDescription>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <Checkbox
                checked={config.climb.enabled}
                onCheckedChange={(c) => setConfig({ ...config, climb: { ...config.climb, enabled: !!c } })}
              />
              Show on homepage
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Headline</Label>
            <Input
              value={config.climb.headline}
              onChange={(e) => setConfig({ ...config, climb: { ...config.climb, headline: e.target.value } })}
            />
          </div>
          <div className="space-y-2">
            <Label>Intro text</Label>
            <Textarea
              value={config.climb.intro}
              onChange={(e) => setConfig({ ...config, climb: { ...config.climb, intro: e.target.value } })}
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <Label>Stations</Label>
            {config.climb.stations.map((station, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_2fr_auto] gap-3 items-start rounded-md border border-gray-200 p-3">
                <Select value={station.product_slug} onValueChange={(v) => updateStation(i, { product_slug: v })}>
                  <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.slug}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={station.label}
                  onChange={(e) => updateStation(i, { label: e.target.value })}
                  placeholder="01"
                />
                <Textarea
                  value={station.line}
                  onChange={(e) => updateStation(i, { line: e.target.value })}
                  rows={1}
                  placeholder="One line of story copy for this piece."
                />
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => moveStation(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveStation(i, 1)} disabled={i === config.climb.stations.length - 1} aria-label="Move down">
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeStation(i)} aria-label="Remove station">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addStation} disabled={products.length === 0}>
              <Plus className="w-4 h-4 mr-1.5" /> Add station
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Featured collections */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Featured collections</CardTitle>
          <CardDescription>
            Which collections lead the &quot;Three conditions, three kits&quot; row. Leave all unchecked to show every
            active collection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 p-3">
            {collections.length === 0 ? (
              <p className="text-sm text-gray-400">No collections yet.</p>
            ) : (
              collections.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={config.featured_collection_slugs.includes(c.slug)}
                    onCheckedChange={(checked) => toggleFeaturedCollection(c.slug, !!checked)}
                  />
                  {c.name}
                </label>
              ))
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Each collection&apos;s homepage image is its own <strong>Collection image</strong>, set in{' '}
            <a href="/admin/collections" className="underline">Collections</a>.
          </p>
        </CardContent>
      </Card>

      {/* Featured categories */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Choose Your Essentials tiles</CardTitle>
          <CardDescription>
            Which tiles fill the &quot;Choose Your Essentials&quot; row, in the order you tick them.
            Leave all unchecked and the row falls back to every category that has products in it —
            tick some and those are shown as given, reading &quot;Coming soon&quot; until they are stocked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 p-3">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400">No categories yet.</p>
            ) : (
              categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={config.featured_category_slugs.includes(c.slug)}
                    onCheckedChange={(checked) => toggleFeaturedCategory(c.slug, !!checked)}
                  />
                  {c.name}
                </label>
              ))
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Each tile&apos;s picture is the category&apos;s own image, set in{' '}
            <a href="/admin/categories" className="underline">Categories</a>.
          </p>
        </CardContent>
      </Card>

      {/* Trails */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Trails section</CardTitle>
              <CardDescription>
                The golden-hour row under &quot;The journey starts before the trail&quot;. Add as many
                routes as you like — the row scrolls sideways on a phone and lays out four across on a
                laptop. The first route&apos;s photograph is also the section&apos;s full-width backdrop.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addTrail} className="flex-shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Add route
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {trails.length === 0 && (
            <p className="text-sm text-gray-400">
              No routes — the Trails section hides itself entirely rather than showing an empty row.
            </p>
          )}
          {trails.map((trail, i) => (
            <div key={trail.slug} className="space-y-3 rounded-md border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  {String(i + 1).padStart(2, '0')}
                  {i === 0 && ' — also the section backdrop'}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => moveTrail(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => moveTrail(i, 1)} disabled={i === trails.length - 1} aria-label="Move down">
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeTrail(i)} aria-label="Remove route">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input value={trail.name} onChange={(e) => updateTrail(i, { name: e.target.value })} placeholder="Kedarkantha" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Altitude</Label>
                  <Input value={trail.altitude} onChange={(e) => updateTrail(i, { altitude: e.target.value })} placeholder="3,800m" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Difficulty</Label>
                  <Input value={trail.difficulty} onChange={(e) => updateTrail(i, { difficulty: e.target.value })} placeholder="Easy–Moderate" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Days</Label>
                  <Input value={trail.duration} onChange={(e) => updateTrail(i, { duration: e.target.value })} placeholder="4–6 days" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">When to go</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MONTHS.map((m) => {
                    const on = trail.bestMonths.includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleTrailMonth(i, m, !on)}
                        aria-pressed={on}
                        className={`rounded px-2.5 py-1 text-xs transition-colors ${
                          on ? 'bg-black text-white' : 'border border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Writeup</Label>
                <Textarea
                  value={trail.season}
                  onChange={(e) => updateTrail(i, { season: e.target.value })}
                  rows={2}
                  placeholder="A winter trail first and foremost — deep snow from late December through March."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Photograph URL</Label>
                <Input
                  value={trail.image}
                  onChange={(e) => updateTrail(i, { image: e.target.value })}
                  placeholder="https://images.unsplash.com/photo-…"
                />
                <p className="text-xs text-gray-400">
                  Must be on a host allowed in <code>next.config.ts</code> — currently Unsplash and this
                  store&apos;s own Supabase storage. Anything else will not render.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Guide slug</Label>
                <Input
                  value={trail.slug}
                  onChange={(e) => updateTrail(i, { slug: e.target.value })}
                  placeholder="kedarkantha"
                />
                <p className="text-xs text-gray-400">
                  Match a route in the /treks guide and the card links straight to it; anything else
                  links to the guide&apos;s front page.
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Showcase rails */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Product rails</CardTitle>
          <CardDescription>
            Extra rows of products on the homepage and in the mobile apps. These are worked out live from the
            catalogue — a rail with nothing to show hides itself, and fills in on its own as products and orders
            arrive. Nothing here needs pinning to specific items.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.showcase.map((rail, i) => (
            <div key={rail.id} className="space-y-3 rounded-md border border-gray-200 p-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={rail.enabled}
                  onCheckedChange={(c) => updateRail(i, { enabled: !!c })}
                  aria-label="Show this rail"
                />
                <Input
                  value={rail.title}
                  onChange={(e) => updateRail(i, { title: e.target.value })}
                  placeholder="Rail heading"
                  className="flex-1"
                />
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => moveRail(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveRail(i, 1)} disabled={i === config.showcase.length - 1} aria-label="Move down">
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeRail(i)} aria-label="Remove rail">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Source</Label>
                  <Select
                    value={rail.kind}
                    onValueChange={(v) =>
                      updateRail(i, { kind: v as HomeShowcaseKind, category_slug: null, collection_slug: null })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RAIL_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {rail.kind === 'category' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select value={rail.category_slug ?? ''} onValueChange={(v) => updateRail(i, { category_slug: v })}>
                      <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {rail.kind === 'collection' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Collection</Label>
                    <Select value={rail.collection_slug ?? ''} onValueChange={(v) => updateRail(i, { collection_slug: v })}>
                      <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                      <SelectContent>
                        {collections.map((c) => (
                          <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Max products</Label>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={rail.limit}
                    onChange={(e) => updateRail(i, { limit: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">{RAIL_KINDS.find((k) => k.value === rail.kind)?.hint}</p>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRail}>
            <Plus className="w-4 h-4 mr-1.5" /> Add rail
          </Button>
        </CardContent>
      </Card>

      {/* Numbers band */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Numbers band</CardTitle>
          <CardDescription>
            The counting figures near the bottom of the homepage. Empty by default and hidden while empty — only add
            numbers you can stand behind, since these are public claims.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.stats.length === 0 && (
            <p className="text-sm text-gray-400">No numbers set — the band is hidden on the homepage.</p>
          )}
          {config.stats.map((stat, i) => (
            <div key={i} className="grid grid-cols-[120px_90px_1fr_auto_auto] gap-3 items-end rounded-md border border-gray-200 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Value</Label>
                <Input
                  type="number"
                  value={stat.value}
                  onChange={(e) => updateStat(i, { value: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Suffix</Label>
                <Input value={stat.suffix} onChange={(e) => updateStat(i, { suffix: e.target.value })} placeholder="+" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Label</Label>
                <Input
                  value={stat.label}
                  onChange={(e) => updateStat(i, { label: e.target.value })}
                  placeholder="Trekkers geared up"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-xs text-gray-600">
                <Checkbox checked={stat.plain} onCheckedChange={(c) => updateStat(i, { plain: !!c })} />
                Plain
              </label>
              <Button variant="ghost" size="icon" onClick={() => removeStat(i)} aria-label="Remove number">
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addStat}>
            <Plus className="w-4 h-4 mr-1.5" /> Add number
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
