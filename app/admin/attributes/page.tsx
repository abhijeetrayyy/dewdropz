'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getAttributes, createAttribute, updateAttribute, deleteAttribute, createAttributeValue, updateAttributeValue, deleteAttributeValue } from '@/actions/attributes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, List } from 'lucide-react'
import type { AttributeWithValues } from '@/types/database'

export default function AttributesPage() {
  const [attrs, setAttrs] = useState<AttributeWithValues[]>([])
  const [attrDialog, setAttrDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [inputType, setInputType] = useState('select')
  const [isVariant, setIsVariant] = useState(false)
  const [isFilterable, setIsFilterable] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Values management
  const [valuesDialog, setValuesDialog] = useState(false)
  const [selectedAttr, setSelectedAttr] = useState<AttributeWithValues | null>(null)
  const [valForm, setValForm] = useState({ id: '', value: '', slug: '' })
  const [editingValId, setEditingValId] = useState<string | null>(null)

  async function load() { try { setAttrs(await getAttributes() as AttributeWithValues[]) } catch { /* */ } }
  useEffect(() => { load() }, [])

  function openAttr(id?: string) {
    if (id && attrs.length) {
      const a = attrs.find((x) => x.id === id)
      if (a) {
        setEditingId(id); setName(a.name); setSlug(a.slug); setInputType(a.input_type); setIsVariant(a.is_variant_attribute); setIsFilterable(a.is_filterable)
      }
    } else {
      setEditingId(null); setName(''); setSlug(''); setInputType('select'); setIsVariant(false); setIsFilterable(false)
    }
    setError(''); setAttrDialog(true)
  }

  async function saveAttr() {
    if (!name || !slug) { setError('Name and slug required'); return }
    setSaving(true)
    try {
      if (editingId) { await updateAttribute(editingId, { name, slug, input_type: inputType, is_variant_attribute: isVariant, is_filterable: isFilterable }) }
      else { await createAttribute({ name, slug, input_type: inputType as 'select'|'text'|'multiselect'|'boolean'|'number', is_variant_attribute: isVariant, is_filterable: isFilterable }) }
      setAttrDialog(false); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  function openValues(a: AttributeWithValues) { setSelectedAttr(a); setValuesDialog(true) }
  async function refreshValues() { if (selectedAttr) { const ref = await getAttributes() as AttributeWithValues[]; const u = ref.find((x) => x.id === selectedAttr.id); if (u) setSelectedAttr(u) } }

  async function addValue() {
    if (!selectedAttr || !valForm.value || !valForm.slug) return
    setSaving(true)
    try {
      if (editingValId) { await updateAttributeValue(editingValId, { value: valForm.value, slug: valForm.slug }) }
      else { await createAttributeValue({ attribute_id: selectedAttr.id, value: valForm.value, slug: valForm.slug }) }
      setValForm({ id: '', value: '', slug: '' }); setEditingValId(null); await refreshValues()
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Attributes</h2>
          <p className="text-sm text-gray-500 mt-1">Define product attributes and variant options</p>
        </div>
        <Button onClick={() => openAttr()} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Attribute</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Values</TableHead>
                <TableHead className="w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attrs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">No attributes yet</TableCell></TableRow>
              ) : attrs.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {a.name}
                      {a.is_variant_attribute && <Badge variant="secondary">Variant</Badge>}
                      {a.is_filterable && <Badge variant="outline">Filterable</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500 uppercase text-xs">{a.input_type}</TableCell>
                  <TableCell className="text-gray-500">{a.values?.length ?? 0} values</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openValues(a)}><List className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openAttr(a.id)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={async () => { if (!confirm('Delete this attribute? This may affect products using it.')) return; await deleteAttribute(a.id); load() }} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Attribute Create/Edit Dialog */}
      <Dialog open={attrDialog} onOpenChange={setAttrDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Attribute' : 'Add Attribute'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Material" /></div>
            <div><Label>Slug *</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="material" /></div>
            <div>
              <Label>Input Type</Label>
              <Select value={inputType} onValueChange={setInputType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">Select (dropdown)</SelectItem>
                  <SelectItem value="multiselect">Multi Select</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={isVariant} onCheckedChange={(v) => setIsVariant(!!v)} /><span className="text-sm">Variant attribute</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={isFilterable} onCheckedChange={(v) => setIsFilterable(!!v)} /><span className="text-sm">Filterable</span></label>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttrDialog(false)}>Cancel</Button>
            <Button onClick={saveAttr} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Values Dialog */}
      <Dialog open={valuesDialog} onOpenChange={setValuesDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Values — {selectedAttr?.name}</DialogTitle></DialogHeader>
          {selectedAttr && (
            <div className="space-y-3">
              {selectedAttr.values && selectedAttr.values.length > 0 ? (
                selectedAttr.values.map((v) => (
                  <div key={v.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                    <span className="text-sm text-gray-900">{v.value} <span className="text-gray-400 ml-2 text-xs">({v.slug})</span></span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingValId(v.id); setValForm({ id: v.id, value: v.value, slug: v.slug }) }}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={async () => { if (!confirm('Delete this value? This may affect products using it.')) return; await deleteAttributeValue(v.id); refreshValues() }} className="text-red-600"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))
              ) : <p className="text-sm text-gray-400">No values defined yet</p>}
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">{editingValId ? 'Edit value' : 'Add value'}</p>
                <div className="flex gap-2 mb-2">
                  <Input value={valForm.value} onChange={(e) => setValForm({ ...valForm, value: e.target.value })} placeholder="Value (Merino Wool)" className="flex-1" />
                  <Input value={valForm.slug} onChange={(e) => setValForm({ ...valForm, slug: e.target.value })} placeholder="slug" className="w-32" />
                </div>
                <div className="flex justify-end gap-2">
                  {editingValId && <Button variant="ghost" size="sm" onClick={() => { setEditingValId(null); setValForm({ id: '', value: '', slug: '' }) }}>Cancel</Button>}
                  <Button size="sm" onClick={addValue} disabled={saving}>{editingValId ? 'Update' : 'Add'}</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
