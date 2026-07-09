'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct } from '@/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Save, PackagePlus, Loader2, PackageOpen, Layers, Hash, Sparkles, Boxes, Lock } from 'lucide-react'
import { toast } from 'sonner'

function LockedTab({ label }: { label: string }) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <Lock className="h-6 w-6 text-gray-300" />
        <p className="text-sm font-medium text-gray-700">Save the product first</p>
        <p className="text-sm text-gray-400 max-w-sm">
          {label} need a real product to attach to — this unlocks the moment you hit
          &ldquo;Create Product&rdquo; below, no page change required.
        </p>
      </CardContent>
    </Card>
  )
}

export default function NewProductPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [desc, setDesc] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [price, setPrice] = useState('')
  const [comparePrice, setComparePrice] = useState('')
  const [sku, setSku] = useState('')
  const [weight, setWeight] = useState('')
  const [featured, setFeatured] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Auto-generate slug from name
  const handleNameChange = (val: string) => {
    setName(val)
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''))
    }
  }

  async function handleSave() {
    if (!name || !slug || !price) {
      toast.error('Name, slug, and price are required')
      return
    }

    setSaving(true)
    try {
      const product = await createProduct({
        name,
        slug,
        description: desc || undefined,
        short_description: shortDesc || undefined,
        price: Math.round(parseFloat(price) * 100),
        compare_at_price: comparePrice ? Math.round(parseFloat(comparePrice) * 100) : undefined,
        sku: sku || undefined,
        weight: weight ? parseFloat(weight) : undefined,
        is_featured: featured,
        is_active: isActive,
        images,
      })

      toast.success('Product created — now add variants, categories, and tags')
      router.push(`/admin/products/${product.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create product')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl pb-20">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3 mb-2 text-gray-500">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Products
          </Button>
          <h2 className="text-2xl font-bold tracking-tight text-black flex items-center gap-2">
            <PackagePlus className="h-6 w-6" /> Create New Product
          </h2>
          <p className="text-sm text-gray-500 mt-1">Add the name, price, and photos — everything else unlocks once it&apos;s saved.</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !name || !slug || !price} className="bg-black hover:bg-black/90 px-6">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Create Product
        </Button>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="basic" className="data-[state=active]:bg-black data-[state=active]:text-white"><PackageOpen className="h-4 w-4 mr-1" /> Basic</TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-black data-[state=active]:text-white"><Layers className="h-4 w-4 mr-1" /> Categories</TabsTrigger>
          <TabsTrigger value="tags" className="data-[state=active]:bg-black data-[state=active]:text-white"><Hash className="h-4 w-4 mr-1" /> Tags</TabsTrigger>
          <TabsTrigger value="attributes" className="data-[state=active]:bg-black data-[state=active]:text-white"><Sparkles className="h-4 w-4 mr-1" /> Attributes</TabsTrigger>
          <TabsTrigger value="variants" className="data-[state=active]:bg-black data-[state=active]:text-white"><Boxes className="h-4 w-4 mr-1" /> Variants</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle>General Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Product Name *</Label>
                    <Input id="name" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Signature Cotton Tee" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="desc">Full Description</Label>
                    <Textarea id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={6} placeholder="Describe the product details, fit, and materials..." className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="short_desc">Short Description</Label>
                    <Input id="short_desc" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="A quick summary for product cards" className="mt-1" />
                  </div>
                  <div>
                    <Label>Images</Label>
                    <div className="mt-1">
                      <ImageUploader bucket="PRODUCTS" value={images} onChange={setImages} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle>Pricing & Inventory Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price">Price (₹) *</Label>
                      <Input id="price" value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="0.00" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="compare">Compare-at Price (₹)</Label>
                      <Input id="compare" value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} type="number" placeholder="0.00" className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <Label htmlFor="sku">SKU (Stock Keeping Unit)</Label>
                      <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="weight">Weight (grams)</Label>
                      <Input id="weight" value={weight} onChange={(e) => setWeight(e.target.value)} type="number" className="mt-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle>Organization & Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                      <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(!!v)} />
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Active Product</div>
                        <div className="text-xs text-gray-500">Available on storefront</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                      <Checkbox checked={featured} onCheckedChange={(v) => setFeatured(!!v)} />
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Featured</div>
                        <div className="text-xs text-gray-500">Show on homepage</div>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle>Search Engine Optimization</CardTitle>
                  <CardDescription>How this product appears in Google</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="slug">URL Handle (Slug) *</Label>
                    <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 text-gray-600 bg-gray-50 font-mono text-sm" />
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <Label htmlFor="meta_title" className="text-xs text-gray-500">Meta Title (optional)</Label>
                    <Input id="meta_title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Max 70 chars" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="meta_desc" className="text-xs text-gray-500">Meta Description (optional)</Label>
                    <Textarea id="meta_desc" value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} placeholder="Max 160 chars" rows={3} className="mt-1 text-sm resize-none" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-4"><LockedTab label="Categories" /></TabsContent>
        <TabsContent value="tags" className="mt-4"><LockedTab label="Tags" /></TabsContent>
        <TabsContent value="attributes" className="mt-4"><LockedTab label="Attributes" /></TabsContent>
        <TabsContent value="variants" className="mt-4"><LockedTab label="Variants" /></TabsContent>
      </Tabs>
    </div>
  )
}
