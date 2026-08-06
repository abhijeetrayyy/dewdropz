'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import { Textbox, FabricImage } from 'fabric'
import { Type, ImagePlus, Trash2, Copy, Undo2, Redo2, Bold, Italic } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uploadCustomerImage } from '@/actions/media'
import { useCanvasHistory } from '@/hooks/useCanvasHistory'

const FONTS = ['Inter', 'Fraunces', 'Georgia', 'Arial', 'Courier New']

export default function Toolbar({ canvas }: { canvas: Canvas | null }) {
  const [selected, setSelected] = useState<FabricObject | null>(null)
  const [layers, setLayers] = useState<FabricObject[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { undo, redo, canUndo, canRedo } = useCanvasHistory(canvas)
  const [, bump] = useState(0)

  useEffect(() => {
    if (!canvas) return
    const onSelect = () => setSelected(canvas.getActiveObject() ?? null)
    const onClear = () => setSelected(null)
    const refreshLayers = () => setLayers([...canvas.getObjects()].reverse())
    refreshLayers()
    canvas.on('selection:created', onSelect)
    canvas.on('selection:updated', onSelect)
    canvas.on('selection:cleared', onClear)
    canvas.on('object:added', refreshLayers)
    canvas.on('object:removed', refreshLayers)
    canvas.on('object:modified', refreshLayers)
    // object:modified doesn't fire per keystroke while editing a Textbox's
    // content — text:changed does, which is what keeps the layer label
    // (and the font-size input, etc.) live while typing.
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
    if (!canvas) return
    const text = new Textbox('Your text', {
      left: canvas.getWidth() / 2 - 60,
      top: canvas.getHeight() / 2 - 15,
      fontFamily: 'Inter',
      fontSize: 24,
      fill: '#1a1a1a',
      width: 160,
    })
    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.renderAll()
  }, [canvas])

  const handleImagePick = useCallback(() => fileInputRef.current?.click(), [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !canvas) return
      setUploading(true)
      try {
        const url = await uploadCustomerImage(file)
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
        const maxDim = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.7
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        img.scale(scale)
        img.set({
          left: (canvas.getWidth() - img.getScaledWidth()) / 2,
          top: (canvas.getHeight() - img.getScaledHeight()) / 2,
        })
        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.renderAll()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not upload that image')
      } finally {
        setUploading(false)
      }
    },
    [canvas]
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

  const bringForward = useCallback(() => {
    if (!canvas || !selected) return
    canvas.bringObjectForward(selected)
    canvas.renderAll()
  }, [canvas, selected])

  const sendBackward = useCallback(() => {
    if (!canvas || !selected) return
    canvas.sendObjectBackwards(selected)
    canvas.renderAll()
  }, [canvas, selected])

  const updateText = useCallback(
    (patch: Partial<Textbox>) => {
      if (!canvas || !selected) return
      selected.set(patch)
      canvas.renderAll()
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

  return (
    <div className="border-l border-rule p-5 space-y-6 overflow-y-auto">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addText} className="flex-1">
          <Type className="h-4 w-4 mr-1.5" /> Text
        </Button>
        <Button variant="outline" size="sm" onClick={handleImagePick} disabled={uploading} className="flex-1">
          <ImagePlus className="h-4 w-4 mr-1.5" /> {uploading ? 'Uploading…' : 'Image'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {selected && (
        <div className="space-y-3 border-t border-rule pt-4">
          <div className="text-xs uppercase tracking-wide text-mid">Selected</div>

          {textbox && (
            <>
              <select
                value={textbox.fontFamily ?? 'Inter'}
                onChange={(e) => updateText({ fontFamily: e.target.value })}
                className="w-full border border-rule rounded-sm text-sm p-2 bg-paper"
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={8}
                  max={200}
                  value={textbox.fontSize ?? 24}
                  onChange={(e) => updateText({ fontSize: Number(e.target.value) })}
                  className="w-16"
                />
                <input
                  type="color"
                  value={(textbox.fill as string) ?? '#000000'}
                  onChange={(e) => updateText({ fill: e.target.value })}
                  className="h-9 w-9 rounded border border-rule cursor-pointer"
                  aria-label="Text color"
                />
                <Button
                  variant={textbox.fontWeight === 'bold' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => updateText({ fontWeight: textbox.fontWeight === 'bold' ? 'normal' : 'bold' })}
                  aria-label="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant={textbox.fontStyle === 'italic' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => updateText({ fontStyle: textbox.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  aria-label="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={bringForward} className="flex-1">
              Forward
            </Button>
            <Button variant="outline" size="sm" onClick={sendBackward} className="flex-1">
              Backward
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={duplicateSelected} className="flex-1">
              <Copy className="h-4 w-4 mr-1.5" /> Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={deleteSelected} className="flex-1 text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      <div className="border-t border-rule pt-4">
        <div className="text-xs uppercase tracking-wide text-mid mb-2">Layers</div>
        {layers.length === 0 ? (
          <p className="text-sm text-mid">Nothing here yet — add text or an image.</p>
        ) : (
          <ul className="space-y-1">
            {layers.map((obj, i) => (
              <li
                key={i}
                onClick={() => selectLayer(obj)}
                className={`truncate text-sm px-2 py-1.5 rounded-sm cursor-pointer transition-colors ${
                  selected === obj ? 'bg-forest/10 text-forest' : 'hover:bg-rule/40 text-text'
                }`}
              >
                {obj.type === 'textbox' ? `Text: ${(obj as Textbox).text?.slice(0, 24) || '(empty)'}` : 'Image'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
