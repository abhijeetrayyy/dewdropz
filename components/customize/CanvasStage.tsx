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
export default function CanvasStage({
  zone,
  active,
  onReady,
}: {
  zone: CustomizationZone
  active: boolean
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

  useEffect(() => {
    fabricRef.current?.setDimensions(
      { width: zone.widthPx * scale, height: zone.heightPx * scale },
      { cssOnly: true }
    )
  }, [scale, zone.widthPx, zone.heightPx])

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[800px] mx-auto"
      style={{ display: active ? 'block' : 'none' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={zone.mockupImage}
        alt=""
        className="w-full h-auto block select-none pointer-events-none"
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
  )
}
