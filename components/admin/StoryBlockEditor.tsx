'use client'

import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/admin/ImageUploader'

export type StoryBlock = { images: string[]; heading: string; body: string }

// An ordered list of image-set + heading + body blocks — the admin-authored
// "what is this product about" storytelling section shown full-bleed on the
// product page, between Highlights and Specifications. Each block can carry
// up to 3 images so a single section can read as a real photoshoot spread
// (e.g. a model wearing the product from a few angles), not one small photo.
// Mirrors BulletListEditor's add/remove/reorder pattern.
export function StoryBlockEditor({
  value,
  onChange,
}: {
  value: StoryBlock[]
  onChange: (next: StoryBlock[]) => void
}) {
  function updateAt(i: number, patch: Partial<StoryBlock>) {
    const next = [...value]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {value.map((block, i) => (
        <div key={i} className="border border-gray-200 rounded-md p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col shrink-0 pt-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-300"
                aria-label="Move up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-300"
                aria-label="Move down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 space-y-2">
              <ImageUploader
                bucket="PRODUCTS"
                value={block.images}
                onChange={(urls) => updateAt(i, { images: urls })}
                maxFiles={3}
              />
              <p className="text-xs text-gray-400">Up to 3 images — shown side by side as one wide spread.</p>
              <Input
                value={block.heading}
                onChange={(e) => updateAt(i, { heading: e.target.value })}
                placeholder="e.g. Built for the descent"
              />
              <Textarea
                value={block.body}
                onChange={(e) => updateAt(i, { body: e.target.value })}
                rows={3}
                placeholder="A short paragraph about this aspect of the product..."
              />
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeAt(i)} aria-label="Remove block">
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { images: [], heading: '', body: '' }])}
      >
        <Plus className="h-4 w-4 mr-1" /> Add story block
      </Button>
    </div>
  )
}
