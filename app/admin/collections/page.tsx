'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getAllCollectionsAdmin, createCollection, updateCollection, deleteCollection } from '@/actions/collections'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { TableSkeleton } from '@/components/admin/TableSkeleton'
import type { Collection } from '@/types/database'

const PAGE_SIZE = 20

type Row = Collection & { products: { count: number }[] }

const emptyForm = { slug: '', name: '', tagline: '', description: '', gradient: '', image_url: '', sort_order: '0', is_active: true }

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { collections: rows, total: t } = await getAllCollectionsAdmin({
        search: debouncedSearch || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      })
      setCollections(rows)
      setTotal(t)
    } catch { toast.error('Failed to load collections') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [debouncedSearch, page])

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(c: Row) {
    setEditingId(c.id)
    setForm({
      slug: c.slug, name: c.name, tagline: c.tagline ?? '', description: c.description ?? '',
      gradient: c.gradient ?? '', image_url: c.image_url ?? '', sort_order: String(c.sort_order ?? 0),
      is_active: c.is_active,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.slug) { toast.error('Name and slug are required'); return }
    setSaving(true)
    try {
      const input = {
        slug: form.slug, name: form.name,
        tagline: form.tagline || undefined, description: form.description || undefined,
        gradient: form.gradient || undefined, image_url: form.image_url || undefined,
        sort_order: parseInt(form.sort_order) || 0, is_active: form.is_active,
      }
      if (editingId) await updateCollection(editingId, input)
      else await createCollection(input)
      toast.success(editingId ? 'Collection updated' : 'Collection created')
      setDialogOpen(false)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save collection') }
    finally { setSaving(false) }
  }

  async function handleDelete(c: Row) {
    const productCount = c.products?.[0]?.count ?? 0
    const warning = productCount > 0
      ? `Delete "${c.name}"? ${productCount} product${productCount === 1 ? '' : 's'} will become uncategorized.`
      : `Delete "${c.name}"?`
    if (!confirm(warning)) return
    try { await deleteCollection(c.id); toast.success('Collection deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight text-black">Collections</h2><p className="text-sm text-gray-500 mt-1">{total} collection{total === 1 ? '' : 's'}</p></div>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Collection</Button>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or slug..." className="pl-8" />
      </div>

      {loading ? (
        <TableSkeleton columns={5} rows={6} />
      ) : collections.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-1">No collections found</p>
            <p className="text-sm text-gray-500 max-w-sm mb-4">You haven&apos;t added any collections yet, or none match your search criteria.</p>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Create a collection</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collection</TableHead>
                  <TableHead>Tagline</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-gray-900">
                      <div className="flex items-center gap-2">{c.name}<span className="text-gray-400 text-xs">{c.slug}</span></div>
                    </TableCell>
                    <TableCell className="text-gray-500">{c.tagline || '—'}</TableCell>
                    <TableCell className="text-right">{c.products?.[0]?.count ?? 0}</TableCell>
                    <TableCell>{c.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page + 1} of {pageCount}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Collection' : 'Add Collection'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            </div>
            <div><Label>Tagline</Label><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div>
              <Label>Image</Label>
              <div className="mt-1">
                <ImageUploader
                  bucket="COLLECTIONS"
                  multiple={false}
                  value={form.image_url ? [form.image_url] : []}
                  onChange={(urls) => setForm({ ...form, image_url: urls[0] ?? '' })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Gradient (CSS)</Label><Input value={form.gradient} onChange={(e) => setForm({ ...form, gradient: e.target.value })} placeholder="linear-gradient(...)" /></div>
              <div><Label>Sort Order</Label><Input value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} type="number" /></div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} /><span className="text-sm">Active</span></label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
