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
import type { HomeConfig, ProductWithCollection, Collection } from '@/types/database'

// The homepage's two product-showcase sections (Season Kit, The Climb) and its
// featured-collections row all read from store_settings.home_config now
// instead of a hardcoded catalogue snapshot — see migration
// 025_home_config.sql. This is the one place that config gets edited.
export function HomepageEngine() {
  const [config, setConfig] = useState<HomeConfig | null>(null)
  const [products, setProducts] = useState<ProductWithCollection[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [settings, productList, collectionList] = await Promise.all([
          getStoreSettings(),
          getProducts(),
          getCollections(),
        ])
        setConfig(settings.home_config)
        setProducts(productList)
        setCollections(collectionList)
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
      await updateStoreSettings({ home_config: config })
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
        </CardContent>
      </Card>
    </div>
  )
}
