'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { CustomizationZone } from '@/types/database'

// Every zone is authored in this same coordinate space regardless of the
// mockup's actual pixel dimensions — the studio scales it uniformly at
// display time (see CanvasStage.tsx). This editor works in the identical
// space so a zone drawn here lines up exactly with what shoppers see.
const CANONICAL_WIDTH = 800
const DISPLAY_WIDTH = 380
const SCALE = DISPLAY_WIDTH / CANONICAL_WIDTH
const MIN_SIZE = 40

const DEFAULT_ZONE_PX = { x: 250, y: 280, widthPx: 300, heightPx: 360 }

type DragMode = { kind: 'move'; startX: number; startY: number; zoneX: number; zoneY: number } | { kind: 'resize'; startX: number; startY: number; zoneW: number; zoneH: number }

export function ZoneEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: CustomizationZone | null
  onChange: (zone: CustomizationZone | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragMode | null>(null)

  const clampX = useCallback((x: number, w: number) => Math.min(Math.max(0, x), CANONICAL_WIDTH - w), [])

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag || !value) return
      const dx = (e.clientX - drag.startX) / SCALE
      const dy = (e.clientY - drag.startY) / SCALE
      if (drag.kind === 'move') {
        onChange({
          ...value,
          x: clampX(drag.zoneX + dx, value.widthPx),
          y: Math.max(0, drag.zoneY + dy),
        })
      } else {
        onChange({
          ...value,
          widthPx: Math.max(MIN_SIZE, drag.zoneW + dx),
          heightPx: Math.max(MIN_SIZE, drag.zoneH + dy),
        })
      }
    },
    [drag, value, onChange, clampX]
  )

  const endDrag = useCallback(() => setDrag(null), [])

  useEffect(() => {
    if (!drag) return
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
    }
  }, [drag, onPointerMove, endDrag])

  function startMove(e: React.PointerEvent) {
    if (!value) return
    e.preventDefault()
    setDrag({ kind: 'move', startX: e.clientX, startY: e.clientY, zoneX: value.x, zoneY: value.y })
  }

  function startResize(e: React.PointerEvent) {
    if (!value) return
    e.stopPropagation()
    e.preventDefault()
    setDrag({ kind: 'resize', startX: e.clientX, startY: e.clientY, zoneW: value.widthPx, zoneH: value.heightPx })
  }

  function handleMockupChange(urls: string[]) {
    const mockupImage = urls[0]
    if (!mockupImage) {
      onChange(null)
      return
    }
    onChange({
      mockupImage,
      x: value?.x ?? DEFAULT_ZONE_PX.x,
      y: value?.y ?? DEFAULT_ZONE_PX.y,
      widthPx: value?.widthPx ?? DEFAULT_ZONE_PX.widthPx,
      heightPx: value?.heightPx ?? DEFAULT_ZONE_PX.heightPx,
      widthIn: value?.widthIn ?? 10,
      heightIn: value?.heightIn ?? 12,
    })
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label} mockup</Label>
      <ImageUploader
        bucket="PRODUCTS"
        value={value?.mockupImage ? [value.mockupImage] : []}
        onChange={handleMockupChange}
        multiple={false}
      />

      {value && (
        <>
          <p className="text-xs text-gray-400">
            Drag the box to position the print area, drag the corner to resize it. This is exactly what shoppers see in the
            studio.
          </p>
          <div
            ref={containerRef}
            className="relative select-none"
            style={{ width: DISPLAY_WIDTH }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.mockupImage} alt="" className="w-full h-auto block rounded-sm" draggable={false} />
            <div
              onPointerDown={startMove}
              className="absolute border-2 border-forest bg-forest/10 cursor-move"
              style={{
                left: value.x * SCALE,
                top: value.y * SCALE,
                width: value.widthPx * SCALE,
                height: value.heightPx * SCALE,
              }}
            >
              <div
                onPointerDown={startResize}
                className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 rounded-full bg-forest border-2 border-white cursor-nwse-resize"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">Print width (in)</Label>
              <Input
                type="number"
                min={1}
                step={0.5}
                value={value.widthIn}
                onChange={(e) => onChange({ ...value, widthIn: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Print height (in)</Label>
              <Input
                type="number"
                min={1}
                step={0.5}
                value={value.heightIn}
                onChange={(e) => onChange({ ...value, heightIn: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
