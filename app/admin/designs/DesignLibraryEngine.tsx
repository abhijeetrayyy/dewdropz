'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2, Upload, Trash2 } from 'lucide-react'
import {
  getAllDesigns,
  createLibraryDesign,
  updateLibraryDesign,
  deleteLibraryDesign,
  getBlanksForDesignScoping,
} from '@/actions/designLibrary'
import type { LibraryDesign } from '@/types/database'

/**
 * The one place the DEWDROPZ design library is edited.
 *
 * Each row saves on its own — there is no page-wide Save button — because the
 * only page-wide thing here is a list, and a list of independent records with
 * one shared Save is how you lose four edits to one failed upload.
 */
export function DesignLibraryEngine() {
  const [designs, setDesigns] = useState<LibraryDesign[] | null>(null)
  const [name, setName] = useState('')
  const [collection, setCollection] = useState('DEWDROPZ')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // The garments a design can be restricted to. Loaded alongside the library
  // because the scope control is useless without it, and an empty list is a
  // meaningful state (no blanks configured) rather than a loading one.
  const [blanks, setBlanks] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    Promise.all([getAllDesigns(), getBlanksForDesignScoping()])
      .then(([rows, bs]) => { setDesigns(rows); setBlanks(bs) })
      .catch(() => {
        toast.error('Could not load the design library')
        setDesigns([])
      })
  }, [])

  async function handleAdd() {
    if (!file) {
      toast.error('Choose an image first')
      return
    }
    setUploading(true)
    try {
      const result = await createLibraryDesign({
        name,
        collection,
        // New designs go to the end of the shelf. Reordering is the `sort`
        // field on each row below.
        sort: (designs?.length ?? 0) * 10 + 10,
        file,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setDesigns((prev) => [...(prev ?? []), result.design])
      setName('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      toast.success(`Added “${result.design.name}” to the library`)
    } finally {
      setUploading(false)
    }
  }

  async function patch(id: string, changes: Partial<LibraryDesign>) {
    // Optimistic: the row is a handful of scalars and the server is the only
    // thing that can reject it, so showing the change and rolling back on
    // failure beats a spinner on every keystroke.
    const before = designs
    setDesigns((prev) => (prev ?? []).map((d) => (d.id === id ? { ...d, ...changes } : d)))
    const result = await updateLibraryDesign(id, changes)
    if (!result.ok) {
      setDesigns(before)
      toast.error(result.error)
    }
  }

  async function remove(id: string, designName: string) {
    if (!confirm(`Delete “${designName}”? Designs already on a customer's saved order are unaffected.`)) return
    const before = designs
    setDesigns((prev) => (prev ?? []).filter((d) => d.id !== id))
    const result = await deleteLibraryDesign(id)
    if (!result.ok) {
      setDesigns(before)
      toast.error(result.error)
      return
    }
    toast.success('Deleted')
  }

  if (designs === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the library…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Add a design</CardTitle>
          <CardDescription>
            PNG with a transparent background is what the studio wants — it goes onto black,
            sage and sand garments alike. Up to 10MB. Aim for at least 2000px on the long
            edge so it still prints at 300 DPI across a chest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ridge line"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label>Design collection</Label>
              <Input
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="DEWDROPZ"
              />
              <p className="text-xs text-gray-400">
                Groups the design in the studio&apos;s picker. Reuse the same word across
                designs to build a collection.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Artwork</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/webp,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
          <Button onClick={handleAdd} disabled={uploading || !file || !name.trim()}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Add to library
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">In the library</CardTitle>
          <CardDescription>
            {designs.length === 0
              ? 'Nothing yet. Until a design is added, the studio shows only the upload door.'
              : `${designs.length} design${designs.length === 1 ? '' : 's'}. Lower sort numbers come first.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {designs.map((d) => (
            <div key={d.id} className="space-y-3 rounded-md border border-gray-200 p-3">
            <div className="grid grid-cols-[64px_1fr_auto] items-start gap-4 sm:grid-cols-[64px_1fr_1fr_90px_auto_auto]">
              {/* Checkerboard behind the thumbnail — a transparent PNG on a
                  white admin card is an invisible PNG. */}
              <div
                className="relative h-16 w-16 overflow-hidden rounded border border-gray-200"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg,#e9e9e9 25%,transparent 25%,transparent 75%,#e9e9e9 75%),linear-gradient(45deg,#e9e9e9 25%,transparent 25%,transparent 75%,#e9e9e9 75%)',
                  backgroundSize: '12px 12px',
                  backgroundPosition: '0 0, 6px 6px',
                }}
              >
                <Image src={d.image_url} alt={d.name} fill sizes="64px" className="object-contain p-1" />
              </div>

              <Input
                value={d.name}
                onChange={(e) => patch(d.id, { name: e.target.value })}
                maxLength={80}
              />
              <Input
                value={d.collection}
                onChange={(e) => patch(d.id, { collection: e.target.value })}
              />
              <Input
                type="number"
                value={d.sort}
                onChange={(e) => patch(d.id, { sort: Number(e.target.value) })}
              />
              <label className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-600">
                <Checkbox checked={d.active} onCheckedChange={(c) => patch(d.id, { active: !!c })} />
                Live
              </label>
              <Button variant="ghost" size="sm" onClick={() => remove(d.id, d.name)} aria-label={`Delete ${d.name}`}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>

            {/* Which garments this artwork is offered on.
                EMPTY MEANS EVERY GARMENT, and the control says so rather than
                rendering as "none selected" — that ambiguity is the whole reason
                to spell it out here instead of leaving a bare multi-select. */}
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500">Offered on</span>
              <button
                type="button"
                onClick={() => patch(d.id, { blank_ids: [] })}
                aria-pressed={(d.blank_ids?.length ?? 0) === 0}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  (d.blank_ids?.length ?? 0) === 0
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                Every garment
              </button>
              {blanks.map((b) => {
                const on = d.blank_ids?.includes(b.id) ?? false
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const cur = d.blank_ids ?? []
                      patch(d.id, { blank_ids: on ? cur.filter((x) => x !== b.id) : [...cur, b.id] })
                    }}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      on
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {b.name}
                  </button>
                )
              })}
              {blanks.length === 0 && (
                <span className="text-xs text-amber-700">
                  No customizable blanks are set up, so there is nothing to restrict this to.
                </span>
              )}
            </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
