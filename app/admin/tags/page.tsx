'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getTags, createTag, updateTag, deleteTag } from '@/actions/tags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Tag } from '@/types/database'

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  async function load() { try { setTags(await getTags()) } catch { /* */ } }
  useEffect(() => { load() }, [])

  function open() { setEditingId(null); setName(''); setSlug(''); setDialogOpen(true) }
  function edit(t: Tag) { setEditingId(t.id); setName(t.name); setSlug(t.slug); setDialogOpen(true) }

  async function save() {
    if (!name || !slug) { toast.error('Name and slug are required'); return }
    setSaving(true)
    try {
      if (editingId) { await updateTag(editingId, { name, slug }); toast.success('Tag updated') }
      else { await createTag({ name, slug }); toast.success('Tag created') }
      setDialogOpen(false); await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this tag?')) return
    try { await deleteTag(id); toast.success('Tag deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Tags</h2>
          <p className="text-sm text-gray-500 mt-1">Cross-cutting product labels</p>
        </div>
        <Button onClick={open} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Tag</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-8">No tags yet</TableCell></TableRow>
              ) : tags.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-gray-900">{t.name}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{t.slug}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => edit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(t.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Tag' : 'Add Tag'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => { setName(e.target.value); if (!editingId) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) }} placeholder="waterproof" />
            </div>
            <div><Label>Slug *</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="waterproof" /></div>
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
