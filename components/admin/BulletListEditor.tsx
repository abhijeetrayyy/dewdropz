'use client'

import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// A small, generic ordered short-text list editor — built for product
// "Highlights" but written generically enough to reuse anywhere an admin
// needs to author an ordered list of short strings (e.g. FAQ bullets later).
export function BulletListEditor({
  value,
  onChange,
  placeholder = 'e.g. Waterproof shell',
  addLabel = 'Add highlight',
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  addLabel?: string
}) {
  function updateAt(i: number, text: string) {
    const next = [...value]
    next[i] = text
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
    <div className="space-y-2">
      {value.map((line, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="flex flex-col shrink-0">
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
          <Input value={line} onChange={(e) => updateAt(i, e.target.value)} placeholder={placeholder} />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeAt(i)} aria-label="Remove">
            <X className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ''])}>
        <Plus className="h-4 w-4 mr-1" /> {addLabel}
      </Button>
    </div>
  )
}
