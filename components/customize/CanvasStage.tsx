'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas } from 'fabric'
import type { CustomizationZone } from '@/types/database'

// The coordinate space every print zone is authored in — the mockup always
// renders at this reference width and everything (canvas position/size)
// scales uniformly from it, so zone geometry never needs to change per
// viewport.
const CANONICAL_WIDTH = 800

// One side (front or back) of the studio: the mockup photo with a Fabric
// canvas overlaid exactly on the print-safe area. The canvas's own edges
// *are* the print boundary — objects dragged past them are simply clipped,
// so there's no separate "you've gone outside the zone" warning to build.
//
// Only the active side is shown, at every breakpoint. Showing front and back
// side by side halved the garment's width, and since the print zone is only
// ~27% of that, it left a ~130px box to actually design in. The inactive side
// stays mounted (just hidden) so its Fabric canvas keeps the work on it.
export default function CanvasStage({
  zone,
  side,
  isActive,
  onFocus,
  onReady,
}: {
  zone: CustomizationZone
  side: 'front' | 'back'
  isActive: boolean
  onFocus: () => void
  onReady: (canvas: Canvas) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!canvasElRef.current) return
    const canvas = new Canvas(canvasElRef.current, {
      width: zone.widthPx,
      height: zone.heightPx,
      selection: true,
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas
    onReady(canvas)
    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
    // Fabric instance is created once per mounted stage — zone/onReady are
    // stable for the lifetime of a stage (front and back never swap zones).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setScale(w / CANONICAL_WIDTH)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Switching colourway swaps the zone without remounting (so the shopper's
  // work survives the switch), which means the backing store has to be
  // re-synced too — otherwise a colourway with a differently-sized print
  // area would keep exporting at the previous colour's resolution.
  useEffect(() => {
    fabricRef.current?.setDimensions(
      { width: zone.widthPx, height: zone.heightPx },
      { backstoreOnly: true }
    )
  }, [zone.widthPx, zone.heightPx])

  useEffect(() => {
    fabricRef.current?.setDimensions(
      { width: zone.widthPx * scale, height: zone.heightPx * scale },
      { cssOnly: true }
    )
  }, [scale, zone.widthPx, zone.heightPx])

  // A click anywhere on the stage — the mockup photo, empty canvas space, or
  // an object — points the Toolbar at this side. Capture phase so it fires
  // before Fabric's own mousedown handling, and before any bubbling that
  // might get intercepted by an object's own listeners.
  return (
    <div
      onPointerDownCapture={onFocus}
      className={`relative mx-auto w-full overflow-hidden rounded-md ring-1 ring-paper/10 ${
        isActive ? 'block' : 'hidden'
      }`}
    >
      <div className="absolute left-3 top-3 z-10 rounded-sm bg-ink/70 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.18em] text-paper backdrop-blur-sm">
        {side === 'front' ? 'Front' : 'Back'}
      </div>
      <div ref={containerRef} className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={zone.mockupImage}
          alt=""
          className="block h-auto w-full select-none pointer-events-none"
          draggable={false}
        />
        {/* The dashed rule *is* the print boundary — anything dragged past it
            is clipped in the preview and in the print file, so it needs to
            read clearly against a mid-grey garment shot. */}
        <div
          className="absolute border border-dashed border-sage/70"
          style={{
            left: zone.x * scale,
            top: zone.y * scale,
            width: zone.widthPx * scale,
            height: zone.heightPx * scale,
          }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>
    </div>
  )
}
