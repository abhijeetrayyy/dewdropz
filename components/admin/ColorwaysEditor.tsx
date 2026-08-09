'use client'

import { Plus, Trash2 } from 'lucide-react'
import { ZoneEditor } from '@/components/admin/ZoneEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { CustomizationColorway } from '@/types/database'

// The garment colors DewDropz sells across all three blank types. Sourced
// from the product spec, not invented — a new color still has to be added
// here (or typed in per product) *and* given real mockup photos before it
// can be marked available.
const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#1A1A1A' },
  { name: 'Off-White', hex: '#F2EFE6' },
  { name: 'Navy Blue', hex: '#1F2A44' },
  { name: 'Light Blue', hex: '#A8C3D8' },
]

export function ColorwaysEditor({
  value,
  onChange,
}: {
  value: CustomizationColorway[]
  onChange: (colors: CustomizationColorway[]) => void
}) {
  function patch(index: number, next: Partial<CustomizationColorway>) {
    onChange(value.map((c, i) => (i === index ? { ...c, ...next } : c)))
  }

  function addColor(preset?: { name: string; hex: string }) {
    onChange([
      ...value,
      {
        name: preset?.name ?? '',
        hex: preset?.hex ?? '#000000',
        // A brand-new colorway has no mockups yet, so it can't be orderable
        // until an admin uploads them and ticks the box deliberately.
        available: false,
      },
    ])
  }

  const usedNames = new Set(value.map((c) => c.name))
  const unusedPresets = PRESET_COLORS.filter((p) => !usedNames.has(p.name))

  return (
    <div className="space-y-6">
      {value.length === 0 && (
        <p className="text-sm text-gray-500">
          No colorways yet. Add at least one — each needs its own front/back mockup photos, since the print zone is
          positioned against the actual garment image.
        </p>
      )}

      {value.map((color, i) => (
        <div key={i} className="border border-gray-200 rounded-md p-4 space-y-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div
              className="h-10 w-10 rounded-full border border-gray-300 flex-shrink-0 mt-5"
              style={{ backgroundColor: color.hex }}
              aria-hidden
            />
            <div className="flex-1 min-w-[140px]">
              <Label className="text-xs text-gray-500">Color name</Label>
              <Input
                value={color.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                placeholder="Black"
                className="mt-1"
              />
            </div>
            <div className="w-32">
              <Label className="text-xs text-gray-500">Swatch hex</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => patch(i, { hex: e.target.value })}
                  className="h-9 w-9 rounded border border-gray-300 cursor-pointer flex-shrink-0"
                  aria-label={`${color.name || 'Color'} swatch`}
                />
                <Input value={color.hex} onChange={(e) => patch(i, { hex: e.target.value })} className="font-mono text-xs" />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={color.available} onCheckedChange={(v) => patch(i, { available: !!v })} />
                <span className="text-xs text-gray-600">In stock</span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!color.available && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-2.5 py-1.5">
              Shown in the studio as a disabled swatch — shoppers can see the color is planned but can&apos;t design or
              order it yet.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 border-t border-gray-100">
            <ZoneEditor label="Front" value={color.front ?? null} onChange={(z) => patch(i, { front: z ?? undefined })} />
            <ZoneEditor label="Back" value={color.back ?? null} onChange={(z) => patch(i, { back: z ?? undefined })} />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 flex-wrap">
        {unusedPresets.map((p) => (
          <Button key={p.name} type="button" variant="outline" size="sm" onClick={() => addColor(p)}>
            <span className="h-3 w-3 rounded-full border border-gray-300 mr-1.5" style={{ backgroundColor: p.hex }} />
            {p.name}
          </Button>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => addColor()}>
          <Plus className="h-4 w-4 mr-1" /> Custom color
        </Button>
      </div>
    </div>
  )
}
