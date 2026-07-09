'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getCategoryTree, createCategory, updateCategory, deleteCategory, reorderCategories } from '@/actions/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, FolderPlus, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { TableSkeleton } from '@/components/admin/TableSkeleton'
import type { Category, CategoryWithChildren } from '@/types/database'

type FlatCategory = Category & { depth: number }

function flatten(cats: CategoryWithChildren[], depth = 0): FlatCategory[] {
  const r: FlatCategory[] = []
  for (const c of cats) {
    const { children, ...rest } = c
    r.push({ ...rest, depth })
    r.push(...flatten(children, depth + 1))
  }
  return r
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ parent_id: '', slug: '', name: '', description: '', is_primary_eligible: false, is_active: true })
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try { setCategories(await getCategoryTree()) } catch { /* */ }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function open(parentId?: string) {
    setEditingId(null)
    setForm({ parent_id: parentId ?? '', slug: '', name: '', description: '', is_primary_eligible: false, is_active: true })
    setDialogOpen(true)
  }

  function edit(c: FlatCategory) {
    setEditingId(c.id)
    setForm({ parent_id: c.parent_id ?? '', slug: c.slug, name: c.name, description: c.description ?? '', is_primary_eligible: c.is_primary_eligible, is_active: c.is_active })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.name || !form.slug) { toast.error('Name and slug are required'); return }
    setSaving(true)
    try {
      if (editingId) { await updateCategory(editingId, form); toast.success('Category updated') }
      else { await createCategory({ ...form, parent_id: form.parent_id || null, sort_order: 0 }); toast.success('Category created') }
      setDialogOpen(false)
      await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this category? Children will move up one level.')) return
    try { await deleteCategory(id); toast.success('Category deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  async function moveDown(flatIndex: number) {
    const flat = flatten(categories)
    if (flatIndex >= flat.length - 1) return
    const ids = flat.map((c) => c.id)
      ;[ids[flatIndex], ids[flatIndex + 1]] = [ids[flatIndex + 1], ids[flatIndex]]
    await reorderCategories(ids)
    toast.success('Reordered')
    load()
  }

  async function moveUp(flatIndex: number) {
    if (flatIndex <= 0) return
    const flat = flatten(categories)
    const ids = flat.map((c) => c.id)
      ;[ids[flatIndex], ids[flatIndex - 1]] = [ids[flatIndex - 1], ids[flatIndex]]
    await reorderCategories(ids)
    toast.success('Reordered')
    load()
  }

  const flat = flatten(categories)
  const topLevel = categories.filter((c) => !c.parent_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Categories</h2>
          <p className="text-sm text-gray-500 mt-1">Organize your product taxonomy</p>
        </div>
        <Button onClick={() => open()} size="sm"><Plus className="h-4 w-4 mr-1" /> Primary Category</Button>
      </div>

      {loading ? (
        <TableSkeleton columns={5} rows={8} />
      ) : flat.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-1">No categories</p>
            <p className="text-sm text-gray-500 max-w-sm mb-4">Organize your products with categories up to 3 levels deep.</p>
            <Button onClick={() => open()}><Plus className="h-4 w-4 mr-2" /> Add Primary Category</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[220px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flat.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-gray-900">
                    <span style={{ paddingLeft: `${c.depth * 24}px` }} className="flex items-center gap-2">
                      {c.depth > 0 && <span className="text-gray-300">└</span>}
                      {c.name}
                      {c.is_primary_eligible && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{c.slug}</TableCell>
                  <TableCell>
                    {c.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => moveUp(i)} title="Move up"><ChevronUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => moveDown(i)} title="Move down"><ChevronDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => open(c.id)} title="Add child"><FolderPlus className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => edit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(c.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Parent Category</Label>
              <Select value={form.parent_id || 'none'} onValueChange={(v) => setForm({ ...form, parent_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {topLevel.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-1">Max 3 levels: Primary → Category → Subcategory</p>
            </div>
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Base Layers" /></div>
            <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="base-layers" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={form.is_primary_eligible} onCheckedChange={(v) => setForm({ ...form, is_primary_eligible: !!v })} /><span className="text-sm">Primary eligible</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} /><span className="text-sm">Active</span></label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
