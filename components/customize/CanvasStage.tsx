'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
//
// Sizing fits the mockup to the box it's given — BOTH axes, not just width.
// Width-only scaling is what made the phone layout unusable: the garment is
// 4:5, so a full-width mockup was always taller than the space left over once
// a tool panel opened, and the print zone slid off the bottom of the screen
// exactly when you were trying to edit inside it. Fitting to height as well
// means opening a panel shrinks the garment instead of hiding it.
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
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const imgElRef = useRef<HTMLImageElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  // Natural height of the mockup expressed in canonical units — unknown until
  // the image decodes, so width-only scaling is used for the first paint.
  const [canonicalHeight, setCanonicalHeight] = useState<number | null>(null)

  // Read straight off the element rather than trusting `onLoad` alone: a
  // cached mockup is frequently already `complete` by the time React attaches
  // the handler, so the load event never fires and the stage would silently
  // fall back to width-only scaling — which is precisely the bug that let the
  // garment overflow its box and slide under the toolbar.
  const readMockupAspect = useCallback(() => {
    const img = imgElRef.current
    if (img && img.naturalWidth > 0) {
      setCanonicalHeight((CANONICAL_WIDTH * img.naturalHeight) / img.naturalWidth)
    }
  }, [])

  useEffect(() => {
    readMockupAspect()
  }, [readMockupAspect, zone.mockupImage])

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

  // Measured element is the flex box itself, whose size comes from the layout
  // rather than from this component's content — so growing the mockup can
  // never feed back into the measurement and oscillate.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale =
    box.w > 0 && canonicalHeight
      ? Math.min(box.w / CANONICAL_WIDTH, box.h / canonicalHeight)
      : box.w / CANONICAL_WIDTH

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
    if (scale <= 0) return
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
      ref={boxRef}
      onPointerDownCapture={onFocus}
      className={`h-full w-full items-center justify-center ${isActive ? 'flex' : 'hidden'}`}
    >
      {/* The garment is placed ON the stage, not floating in it. A drop
          shadow and a real edge are what make a bright mockup photo read as an
          object on a surface rather than as a rectangle pasted over a hole —
          which is what a 10%-opacity ring on a flat black ground gave. */}
      <div
        className="relative overflow-hidden rounded-lg shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)] ring-1 ring-[rgba(237,239,232,0.14)]"
        style={{ width: scale > 0 ? CANONICAL_WIDTH * scale : '100%' }}
      >
        <div className="absolute left-3 top-3 z-10 rounded-sm bg-[rgba(11,11,10,0.82)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#EDEFE8] backdrop-blur-sm">
          {side === 'front' ? 'Front' : 'Back'}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgElRef}
          src={zone.mockupImage}
          alt=""
          className="block h-auto w-full select-none pointer-events-none"
          draggable={false}
          onLoad={readMockupAspect}
        />
        {/* The dashed rule *is* the print boundary — anything dragged past it
            is clipped in the preview and in the print file, so it needs to
            read clearly against a mid-grey garment shot. */}
        <div
          className="absolute border border-dashed border-[#DAD5C7] shadow-[0_0_0_1px_rgba(11,11,10,0.45)]"
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
