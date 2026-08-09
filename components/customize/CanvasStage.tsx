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
// Desktop shows both sides at once (side-by-side), so `isActiveOnMobile`
// only controls the show/hide toggle on narrow screens where there isn't
// room for two — `lg:!block` always wins above that breakpoint. `focused`
// is a separate, purely visual concern: which side the Toolbar is currently
// pointed at, so a two-canvas layout doesn't feel ambiguous about where
// "Add Text" will land.
export default function CanvasStage({
  zone,
  side,
  isActiveOnMobile,
  focused,
  onFocus,
  onReady,
}: {
  zone: CustomizationZone
  side: 'front' | 'back'
  isActiveOnMobile: boolean
  focused: boolean
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
      className={`relative w-full max-w-[800px] mx-auto rounded-md transition-shadow ${
        isActiveOnMobile ? 'block' : 'hidden'
      } lg:!block ${focused ? 'ring-2 ring-forest ring-offset-2 ring-offset-paper' : ''}`}
    >
      <div className="absolute left-3 top-3 z-10 rounded-sm bg-ink/70 px-2.5 py-1 text-[10px] font-body uppercase tracking-[0.15em] text-paper">
        {side === 'front' ? 'Front' : 'Back'}
      </div>
      <div ref={containerRef} className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={zone.mockupImage}
          alt=""
          className="w-full h-auto block select-none pointer-events-none rounded-md"
          draggable={false}
        />
        <div
          className="absolute border border-dashed border-forest/50"
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
