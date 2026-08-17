'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import { Textbox, FabricImage } from 'fabric'
import {
  Type, ImagePlus, Trash2, Copy, Undo2, Redo2, Bold, Italic,
  FlipHorizontal2, Layers as LayersIcon, ChevronDown, ArrowUp, ArrowDown, Loader2,
  Plus, SlidersHorizontal, Shirt,
} from 'lucide-react'
import { toast } from 'sonner'
import { uploadCustomerImage } from '@/actions/media'
import { useCanvasHistory } from '@/hooks/useCanvasHistory'
import type { CustomizationZone } from '@/types/database'

const FONTS = ['Inter', 'Fraunces', 'Georgia', 'Arial', 'Courier New']

// A few inks that actually look good on a garment, so nobody has to fight a
// native colour picker to get a decent result. The picker is still there.
const SWATCHES = ['#FFFFFF', '#1A1A1A', '#7BA46F', '#B8826B', '#D7A96A', '#5A7A96', '#B23B3B', '#E8DFC8']

// Ink that will actually be legible on the chosen blank. Without this, new
// text defaults to near-black and lands invisibly on the black garment —
// which is the default colourway, so it hit every shopper.
function defaultInkFor(garmentHex: string | undefined): string {
  if (!garmentHex) return '#1A1A1A'
  const m = /^#?([0-9a-f]{6})$/i.exec(garmentHex.trim())
  if (!m) return '#1A1A1A'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  // Rec. 709 relative luminance — good enough to pick black vs white ink.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.5 ? '#1A1A1A' : '#FFFFFF'
}

// Which single panel the phone layout is showing. Exactly one is open at a
// time, and `none` is a legitimate resting state — that's the whole point of
// the mobile redesign: the stage is the default, tools are transient.
type MobileTab = 'none' | 'add' | 'edit' | 'layers' | 'setup'

export default function Toolbar({
  canvas,
  zone,
  activeSide,
  twoSided,
  garmentHex,
  onCopyToOtherSide,
  setupPanel,
}: {
  canvas: Canvas | null
  // New objects are positioned against the zone's canonical size, never
  // against canvas.getWidth() — that reports the *CSS* width, which is
  // whatever the viewport happens to make it (94px on a phone, 162px on a
  // laptop). Centring off it put new text at a negative x on small screens,
  // so the first characters fell outside the print area and were clipped out
  // of the exported print file.
  zone: CustomizationZone | undefined
  activeSide: 'front' | 'back'
  twoSided: boolean
  garmentHex?: string
  onCopyToOtherSide: () => void
  // Colour / size / print-spec markup, owned by CustomizerStudio. On desktop
  // it lives in the left rail; on a phone there is no room for a permanent
  // rail, so it becomes the "Blank" tab of this one shared sheet. Passing it
  // in keeps a single sheet with a single open/closed state, instead of two
  // components each trying to own the bottom of the screen.
  setupPanel?: React.ReactNode
}) {
  const [selected, setSelected] = useState<FabricObject | null>(null)
  const [layers, setLayers] = useState<FabricObject[]>([])
  const [uploading, setUploading] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('none')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { undo, redo, canUndo, canRedo } = useCanvasHistory(canvas)
  const [, bump] = useState(0)

  useEffect(() => {
    if (!canvas) return
    // Selection drives the phone sheet too: picking something up points the
    // sheet at Edit (tapping an object then hunting for its controls is the
    // studio's most common action), and dropping it retires Edit rather than
    // leaving an empty inspector holding a third of the screen. Done here, in
    // the Fabric event callbacks, rather than in an effect on `selected` —
    // this is an external system telling React what changed.
    const syncTabToSelection = (obj: FabricObject | null) =>
      setMobileTab((t) => {
        if (obj) return t === 'none' || t === 'add' ? 'edit' : t
        return t === 'edit' ? 'none' : t
      })
    const onSelect = () => {
      const obj = canvas.getActiveObject() ?? null
      setSelected(obj)
      syncTabToSelection(obj)
    }
    const onClear = () => {
      setSelected(null)
      syncTabToSelection(null)
    }
    const refreshLayers = () => setLayers([...canvas.getObjects()].reverse())
    // With two canvases sharing one Toolbar, `canvas` swaps identity whenever
    // focus moves between front and back — without this, `selected` would keep
    // pointing at an object on the canvas we just left, silently editing the
    // wrong side's design.
    onSelect()
    refreshLayers()
    canvas.on('selection:created', onSelect)
    canvas.on('selection:updated', onSelect)
    canvas.on('selection:cleared', onClear)
    canvas.on('object:added', refreshLayers)
    canvas.on('object:removed', refreshLayers)
    canvas.on('object:modified', refreshLayers)
    // object:modified doesn't fire per keystroke while editing a Textbox's
    // content — text:changed does, which keeps the layer label live.
    canvas.on('text:changed', refreshLayers)
    return () => {
      canvas.off('selection:created', onSelect)
      canvas.off('selection:updated', onSelect)
      canvas.off('selection:cleared', onClear)
      canvas.off('text:changed', refreshLayers)
      canvas.off('object:added', refreshLayers)
      canvas.off('object:removed', refreshLayers)
      canvas.off('object:modified', refreshLayers)
    }
  }, [canvas])

  const addText = useCallback(() => {
    if (!canvas || !zone) return
    // Fabric v6 defaults originX/originY to 'center', so left/top ARE the
    // centre point — the old code subtracted half the box on top of that and
    // pushed roughly half of every new text object outside the print area,
    // where it was silently clipped out of the exported print file.
    const boxWidth = Math.min(160, zone.widthPx * 0.8)
    const text = new Textbox('Your text', {
      left: zone.widthPx / 2,
      top: zone.heightPx / 2,
      fontFamily: 'Inter',
      fontSize: 24,
      fill: defaultInkFor(garmentHex),
      width: boxWidth,
      textAlign: 'center',
    })
    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.renderAll()
  }, [canvas, zone, garmentHex])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !canvas || !zone) return
      setUploading(true)
      try {
        const url = await uploadCustomerImage(file)
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
        // Same origin rule as addText: left/top are the centre point in
        // Fabric v6, so this is just the middle of the print area.
        const maxDim = Math.min(zone.widthPx, zone.heightPx) * 0.7
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        img.scale(scale)
        img.set({ left: zone.widthPx / 2, top: zone.heightPx / 2 })
        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.renderAll()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not upload that image')
      } finally {
        setUploading(false)
      }
    },
    [canvas, zone]
  )

  const deleteSelected = useCallback(() => {
    if (!canvas || !selected) return
    canvas.remove(selected)
    canvas.discardActiveObject()
    canvas.renderAll()
  }, [canvas, selected])

  const duplicateSelected = useCallback(async () => {
    if (!canvas || !selected) return
    const clone = await selected.clone()
    clone.set({ left: (selected.left ?? 0) + 12, top: (selected.top ?? 0) + 12 })
    canvas.add(clone)
    canvas.setActiveObject(clone)
    canvas.renderAll()
  }, [canvas, selected])

  const reorder = useCallback(
    (dir: 'forward' | 'backward') => {
      if (!canvas || !selected) return
      if (dir === 'forward') canvas.bringObjectForward(selected)
      else canvas.sendObjectBackwards(selected)
      canvas.renderAll()
      // Stacking order is part of the design, so it belongs in undo history —
      // Fabric doesn't emit object:modified for a z-order change on its own.
      canvas.fire('object:modified', { target: selected })
    },
    [canvas, selected]
  )

  const updateText = useCallback(
    (patch: Partial<Textbox>) => {
      if (!canvas || !selected) return
      selected.set(patch)
      canvas.renderAll()
      // .set() is silent, so without this a font/size/colour change was
      // invisible to undo — you could never take a styling change back.
      canvas.fire('object:modified', { target: selected })
      bump((n) => n + 1)
    },
    [canvas, selected]
  )

  const selectLayer = useCallback(
    (obj: FabricObject) => {
      if (!canvas) return
      canvas.setActiveObject(obj)
      canvas.renderAll()
    },
    [canvas]
  )

  const isText = selected?.type === 'textbox'
  const textbox = isText ? (selected as Textbox) : null

  // ── Shared pieces, rendered into both the desktop rail and the mobile sheet ──

  const addActions = (
    <div className="flex gap-2">
      <ToolButton onClick={addText} className="flex-1">
        <Type className="h-3.5 w-3.5" /> Text
      </ToolButton>
      <ToolButton onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex-1">
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        {uploading ? 'Uploading…' : 'Image'}
      </ToolButton>
    </div>
  )

  const historyActions = (
    <div className="flex gap-1.5">
      <IconButton onClick={undo} disabled={!canUndo} label="Undo">
        <Undo2 className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton onClick={redo} disabled={!canRedo} label="Redo">
        <Redo2 className="h-3.5 w-3.5" />
      </IconButton>
      {twoSided && (
        <button
          type="button"
          onClick={onCopyToOtherSide}
          className="ml-auto flex items-center gap-1.5 rounded-sm border border-[var(--st-edge)] bg-[var(--st-raise)] px-3 py-2 font-body text-[11px] text-[var(--st-ink-2)] transition-colors hover:border-[var(--st-line)] hover:text-[var(--st-ink)]"
        >
          <FlipHorizontal2 className="h-3 w-3" />
          Copy to {activeSide === 'front' ? 'back' : 'front'}
        </button>
      )}
    </div>
  )

  const inspector = selected && (
    <div className="space-y-3">
      <SectionLabel>{isText ? 'Text' : 'Image'}</SectionLabel>

      {textbox && (
        <>
          <select
            value={textbox.fontFamily ?? 'Inter'}
            onChange={(e) => updateText({ fontFamily: e.target.value })}
            className="w-full rounded-sm border border-[var(--st-edge)] bg-[var(--st-raise)] px-2.5 py-2 font-body text-[12px] text-[var(--st-ink)] outline-none transition-colors focus:border-[var(--st-accent)]"
          >
            {FONTS.map((f) => (
              <option key={f} value={f} className="bg-[#171E19]">
                {f}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-sm border border-[var(--st-edge)] bg-[var(--st-raise)] px-2.5 py-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--st-ink-3)]">Size</span>
              <input
                type="number"
                min={8}
                max={200}
                value={Math.round(textbox.fontSize ?? 24)}
                onChange={(e) => updateText({ fontSize: Number(e.target.value) })}
                className="w-full bg-transparent font-mono text-[12px] text-[var(--st-ink)] outline-none tabular-nums"
              />
            </label>
            <IconButton
              onClick={() => updateText({ fontWeight: textbox.fontWeight === 'bold' ? 'normal' : 'bold' })}
              label="Bold"
              active={textbox.fontWeight === 'bold'}
            >
              <Bold className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              onClick={() => updateText({ fontStyle: textbox.fontStyle === 'italic' ? 'normal' : 'italic' })}
              label="Italic"
              active={textbox.fontStyle === 'italic'}
            >
              <Italic className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--st-ink-3)]">Ink</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => updateText({ fill: hex })}
                  aria-label={`Ink ${hex}`}
                  className={`h-6 w-6 rounded-full border transition-all ${
                    (textbox.fill as string)?.toUpperCase() === hex
                      ? 'border-sage ring-1 ring-sage ring-offset-1 ring-offset-[#131A15]'
                      : 'border-paper/20 hover:border-paper/50'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-[var(--st-line)] hover:border-[var(--st-ink-2)]">
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)' }}
                />
                <input
                  type="color"
                  value={(textbox.fill as string) ?? '#000000'}
                  onChange={(e) => updateText({ fill: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Custom ink colour"
                />
              </label>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton onClick={() => reorder('forward')}>
          <ArrowUp className="h-3.5 w-3.5" /> Forward
        </ToolButton>
        <ToolButton onClick={() => reorder('backward')}>
          <ArrowDown className="h-3.5 w-3.5" /> Back
        </ToolButton>
        <ToolButton onClick={duplicateSelected}>
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </ToolButton>
        <ToolButton onClick={deleteSelected} danger>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </ToolButton>
      </div>
    </div>
  )

  const layerList = (
    <div>
      <SectionLabel>Layers</SectionLabel>
      {layers.length === 0 ? (
        <p className="mt-2 font-body text-[12px] leading-relaxed text-[var(--st-ink-3)]">
          Nothing here yet — add some text or an image and it&apos;ll stack up here.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {layers.map((obj, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => selectLayer(obj)}
                className={`flex w-full items-center gap-2 truncate rounded-sm px-2.5 py-2 text-left font-body text-[12px] transition-colors ${
                  selected === obj ? 'bg-sage/15 text-paper' : 'text-paper/50 hover:bg-paper/5 hover:text-paper/80'
                }`}
              >
                {obj.type === 'textbox' ? <Type className="h-3 w-3 flex-shrink-0" /> : <ImagePlus className="h-3 w-3 flex-shrink-0" />}
                <span className="truncate">
                  {obj.type === 'textbox' ? (obj as Textbox).text?.slice(0, 24) || '(empty)' : 'Image'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Desktop rail ───────────────────────────────────────────────── */}
      <aside className="hidden w-[300px] flex-shrink-0 space-y-5 overflow-y-auto border-l border-[var(--st-rule)] bg-[var(--st-panel)] p-5 lg:block">
        {addActions}
        {historyActions}
        {inspector && <div className="border-t border-[var(--st-edge)] pt-5">{inspector}</div>}
        <div className="border-t border-[var(--st-edge)] pt-5">{layerList}</div>
      </aside>

      {/* ── Mobile: one tool at a time ──────────────────────────────────────
          The previous layout dumped the whole inspector plus the add/history
          rows into a permanently-open block pinned over the canvas. On a phone
          that ate ~45% of the screen and clipped the print zone off the bottom
          edge — you were editing artwork you could no longer see, and the
          keyboard made it worse.

          Now: a tab bar picks exactly one panel, the panel is capped and
          scrolls internally, and — because this whole element is a normal
          flex-shrink-0 sibling of the stage rather than an overlay — opening
          one SHRINKS the garment to fit the space that's left instead of
          covering it. Tapping the open tab again returns the stage to full
          height. Nothing the studio can do ever hides the artwork. ────────── */}
      <div className="flex-shrink-0 border-t border-[var(--st-rule)] bg-[var(--st-panel)] lg:hidden">
        {mobileTab !== 'none' && (
          <div className="max-h-[38vh] overflow-y-auto border-b border-[var(--st-edge)] p-4">
            {mobileTab === 'add' && (
              <div className="space-y-3">
                <SectionLabel>Add to your design</SectionLabel>
                {addActions}
                {twoSided && (
                  <button
                    type="button"
                    onClick={onCopyToOtherSide}
                    className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-[var(--st-edge)] bg-[var(--st-raise)] px-3 py-2.5 font-body text-[12px] text-[var(--st-ink-2)] transition-colors hover:border-[var(--st-line)] hover:text-[var(--st-ink)]"
                  >
                    <FlipHorizontal2 className="h-3.5 w-3.5" />
                    Copy this side to the {activeSide === 'front' ? 'back' : 'front'}
                  </button>
                )}
              </div>
            )}
            {mobileTab === 'edit' &&
              (inspector ?? (
                <p className="font-body text-[12px] leading-relaxed text-[var(--st-ink-3)]">
                  Tap something on the garment to edit it.
                </p>
              ))}
            {mobileTab === 'layers' && layerList}
            {mobileTab === 'setup' && setupPanel}
          </div>
        )}

        <div className="flex items-stretch gap-1 p-2">
          <MobileTabButton
            tab="setup"
            current={mobileTab}
            onSelect={setMobileTab}
            icon={<Shirt className="h-4 w-4" />}
            label="Blank"
          />
          <MobileTabButton
            tab="add"
            current={mobileTab}
            onSelect={setMobileTab}
            icon={<Plus className="h-4 w-4" />}
            label="Add"
          />
          <MobileTabButton
            tab="edit"
            current={mobileTab}
            onSelect={setMobileTab}
            icon={<SlidersHorizontal className="h-4 w-4" />}
            label="Edit"
            dimmed={!selected}
          />
          <MobileTabButton
            tab="layers"
            current={mobileTab}
            onSelect={setMobileTab}
            icon={<LayersIcon className="h-4 w-4" />}
            label={layers.length > 0 ? `Layers ${layers.length}` : 'Layers'}
          />

          {/* Undo/redo stay out of the panels on purpose — they're the one pair
              you reach for mid-gesture, and burying them behind a tab would
              mean opening a panel (and shrinking the garment) just to undo. */}
          <div className="ml-1 flex items-center gap-1 border-l border-[var(--st-edge)] pl-2">
            <IconButton onClick={undo} disabled={!canUndo} label="Undo">
              <Undo2 className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={redo} disabled={!canRedo} label="Redo">
              <Redo2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>
    </>
  )
}

// Tab targets are 56px tall — comfortably past the 44px minimum, because this
// bar is the studio's primary navigation on a phone and sits in the thumb zone.
function MobileTabButton({
  tab, current, onSelect, icon, label, dimmed,
}: {
  tab: MobileTab
  current: MobileTab
  onSelect: (updater: (t: MobileTab) => MobileTab) => void
  icon: React.ReactNode
  label: string
  dimmed?: boolean
}) {
  const active = current === tab
  return (
    <button
      type="button"
      // Toggling: tapping the open tab closes it and hands the height back to
      // the garment.
      onClick={() => onSelect((t) => (t === tab ? 'none' : tab))}
      aria-pressed={active}
      className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-sm transition-colors duration-200 ${
        active
          ? 'bg-[var(--st-raise)] text-[var(--st-accent)] shadow-[inset_0_0_0_1px_var(--st-edge)]'
          : dimmed
          ? 'text-[var(--st-ink-3)]/60'
          : 'text-[var(--st-ink-2)] hover:bg-[var(--st-raise)] hover:text-[var(--st-ink)]'
      }`}
    >
      {icon}
      <span className="flex items-center gap-0.5 truncate font-body text-[10px] uppercase tracking-[0.1em]">
        {label}
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${active ? '' : 'rotate-180'}`} />
      </span>
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--st-ink-3)]">
      {children}
    </div>
  )
}

function ToolButton({
  children, onClick, disabled, className = '', danger,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string; danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // A control you can see: a real surface and a real edge, not a hairline
      // at 15% over the same black the panel is painted in.
      className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 font-body text-[12px] transition-colors duration-200 disabled:opacity-35 ${
        danger
          ? 'border-[var(--st-edge)] bg-[var(--st-raise)] text-[#E09A9A] hover:border-[#E09A9A]/60 hover:bg-[#E09A9A]/12'
          : 'border-[var(--st-edge)] bg-[var(--st-raise)] text-[var(--st-ink-2)] hover:border-[var(--st-line)] hover:bg-[var(--st-hover)] hover:text-[var(--st-ink)]'
      } ${className}`}
    >
      {children}
    </button>
  )
}

function IconButton({
  children, onClick, disabled, label, active,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string; active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-sm border transition-colors duration-200 disabled:opacity-30 ${
        active
          ? 'border-[var(--st-accent)] bg-[var(--st-accent)]/18 text-[var(--st-ink)]'
          : 'border-[var(--st-edge)] bg-[var(--st-raise)] text-[var(--st-ink-2)] hover:border-[var(--st-line)] hover:bg-[var(--st-hover)] hover:text-[var(--st-ink)]'
      }`}
    >
      {children}
    </button>
  )
}
