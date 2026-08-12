'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check } from 'lucide-react'
import { Logo } from '@/components/Logo'
import type { Canvas } from 'fabric'
import { toast } from 'sonner'
import CanvasStage from './CanvasStage'
import Toolbar from './Toolbar'
import { useCart } from '@/providers/CartProvider'
import { uploadCustomerImage } from '@/actions/media'
import { saveCustomDesign } from '@/actions/designs'
import { compositePreview, dataUrlToFile } from '@/lib/customize/compositePreview'
import { exportPrintArtwork, PREVIEW_MULTIPLIER } from '@/lib/customize/printExport'
import { formatPrice } from '@/lib/utils'
import type { ProductWithCollection, Json } from '@/types/database'

type Side = 'front' | 'back'

// The studio is laid out like the design tools people already know: a setup
// rail on the left (what garment am I making), the stage in the middle, and
// tools on the right (what am I putting on it). Dark chrome throughout, so the
// garment and the artwork are the only bright things on screen — the same
// reason every serious editor is dark.
export default function CustomizerStudio({
  product,
  initialVariantId,
  initialColorName,
}: {
  product: ProductWithCollection
  initialVariantId?: string
  initialColorName?: string
}) {
  const router = useRouter()
  const { addItem } = useCart()
  const config = product.customization_config
  const colorways = config?.colors ?? []
  const orderableColors = colorways.filter((c) => c.available && (c.front || c.back))

  const [colorName, setColorName] = useState(
    (initialColorName && orderableColors.find((c) => c.name === initialColorName)?.name) || orderableColors[0]?.name || ''
  )
  // `activeSide` drives two different things depending on viewport: on narrow
  // screens it's which single canvas is shown; on desktop, where both are
  // visible side by side, it's just which one the tools are pointed at.
  const [activeSide, setActiveSide] = useState<Side>('front')
  const [frontCanvas, setFrontCanvas] = useState<Canvas | null>(null)
  const [backCanvas, setBackCanvas] = useState<Canvas | null>(null)
  const [saving, setSaving] = useState(false)

  const color = colorways.find((c) => c.name === colorName) ?? orderableColors[0] ?? null
  const sides = (['front', 'back'] as Side[]).filter((s) => color?.[s])
  const twoSided = sides.length > 1
  // Colourways can differ in which sides they support, so never trust
  // `activeSide` blindly after a colour switch.
  const effectiveSide: Side = sides.includes(activeSide) ? activeSide : sides[0] ?? 'front'

  const variants = product.variants ?? []
  const [variantId, setVariantId] = useState(
    (initialVariantId && variants.find((v) => v.id === initialVariantId)?.id) || variants[0]?.id || ''
  )
  const variant = variants.find((v) => v.id === variantId)
  const price = product.price + (variant?.price_adjustment ?? 0)

  const activeCanvas = effectiveSide === 'front' ? frontCanvas : backCanvas
  const zone = color?.[effectiveSide]

  function copyActiveDesignToOtherSide() {
    if (!twoSided) return
    const otherSide: Side = effectiveSide === 'front' ? 'back' : 'front'
    const fromCanvas = activeCanvas
    const toCanvas = otherSide === 'front' ? frontCanvas : backCanvas
    if (!fromCanvas || !toCanvas || fromCanvas.getObjects().length === 0) {
      toast.error(`Nothing on the ${effectiveSide} to copy yet.`)
      return
    }
    toCanvas.loadFromJSON(fromCanvas.toJSON()).then(() => toCanvas.renderAll())
    toast.success(`Copied to ${otherSide}`)
  }

  if (sides.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F0C] px-6 text-center">
        <p className="font-body text-paper/60">
          {colorways.length > 0
            ? 'None of this product’s colours are available to customize right now.'
            : 'This product isn’t set up for customization yet.'}
        </p>
      </div>
    )
  }

  async function handleContinue() {
    const hasContent = (frontCanvas?.getObjects().length ?? 0) > 0 || (backCanvas?.getObjects().length ?? 0) > 0
    if (!hasContent) {
      toast.error('Add some text or an image before continuing.')
      return
    }
    if (variants.length > 0 && !variantId) {
      toast.error('Pick a size first.')
      return
    }

    setSaving(true)
    try {
      const payload: {
        front_design?: Json
        back_design?: Json
        front_preview_url?: string
        back_preview_url?: string
        front_print_url?: string
        back_print_url?: string
      } = {}
      let cartImage = product.images?.[0] ?? ''
      let lowestDpi = Infinity

      for (const side of sides) {
        const canvas = side === 'front' ? frontCanvas : backCanvas
        const sideZone = color?.[side]
        if (!canvas || !sideZone || canvas.getObjects().length === 0) continue

        // Two different exports on purpose: a print-resolution file derived
        // from the zone's real inches, and a light composite for the cart
        // thumbnail. Exporting one file for both jobs is what left every
        // print at 18 DPI.
        const print = exportPrintArtwork(canvas, sideZone)
        lowestDpi = Math.min(lowestDpi, print.dpi)

        const previewArtwork = canvas.toDataURL({ format: 'png', multiplier: PREVIEW_MULTIPLIER })
        const previewDataUrl = await compositePreview(sideZone, previewArtwork)

        const [printUrl, previewUrl] = await Promise.all([
          uploadCustomerImage(dataUrlToFile(print.dataUrl, `${side}-print.png`)),
          uploadCustomerImage(dataUrlToFile(previewDataUrl, `${side}-preview.png`)),
        ])

        payload[`${side}_design`] = canvas.toJSON() as unknown as Json
        payload[`${side}_print_url`] = printUrl
        payload[`${side}_preview_url`] = previewUrl
        if (side === sides[0]) cartImage = previewUrl
      }

      const result = await saveCustomDesign({
        product_id: product.id,
        variant_id: variantId || null,
        color_name: color?.name ?? null,
        color_hex: color?.hex ?? null,
        ...payload,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      addItem(
        {
          slug: product.slug,
          name: product.name,
          price,
          image: cartImage,
          // Display label only — customized lines are matched by
          // customDesignId, so folding the colour in here is safe.
          size: [variant?.name, color?.name].filter(Boolean).join(' · '),
          productId: product.id,
          variantId: variantId || null,
          customDesignId: result.designId,
        },
        1
      )

      // A design that had to be exported below print standard is worth saying
      // out loud rather than discovering on the finished garment.
      if (lowestDpi < 150) {
        toast.warning(`Added — but your artwork exports at ${lowestDpi} DPI. A larger source image will print sharper.`)
      } else {
        toast.success('Added your design to the bag')
      }
      router.push('/cart')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your design')
    } finally {
      setSaving(false)
    }
  }

  // Colour / size / print spec. Rendered once, placed twice: the left rail on
  // desktop, the "Blank" tab of the bottom sheet on a phone. A phone has no
  // room for a permanent setup rail — it was costing ~200px of vertical space
  // above the garment for controls you touch once at the start.
  const setupContent = (
    <div className="flex flex-col gap-6 lg:gap-7">
      {colorways.length > 0 && (
        <section className="min-w-0">
          <RailLabel n="01" label="Colour" value={color?.name} />
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {colorways.map((c) => {
              const selectable = c.available && !!(c.front || c.back)
              const selected = color?.name === c.name
              return (
                <button
                  key={c.name}
                  type="button"
                  disabled={!selectable}
                  onClick={() => setColorName(c.name)}
                  title={selectable ? c.name : `${c.name} — coming soon`}
                  aria-label={selectable ? c.name : `${c.name}, coming soon`}
                  aria-pressed={selected}
                  className={`relative h-8 w-8 rounded-full border transition-all duration-300 lg:h-7 lg:w-7 ${
                    selected
                      ? 'border-sage ring-2 ring-sage ring-offset-2 ring-offset-[#0B0F0C]'
                      : selectable
                      ? 'border-paper/25 hover:border-paper/60'
                      : 'cursor-not-allowed border-paper/10 opacity-30'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {/* A diagonal bar reads as "not orderable yet" without
                      relying on colour alone — on a colour control. */}
                  {!selectable && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="block h-px w-full rotate-45 bg-paper/50" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {variants.length > 0 && (
        <section className="min-w-0">
          <RailLabel n="02" label="Size" value={variant?.name} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {variants.map((v) => {
              const oos = (v.inventory_quantity ?? 0) <= 0
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={oos}
                  onClick={() => setVariantId(v.id)}
                  className={`min-w-[44px] rounded-sm border px-3 py-2 font-body text-[11px] uppercase tracking-[0.05em] transition-colors duration-300 lg:min-w-[40px] lg:px-2.5 lg:py-1.5 ${
                    variantId === v.id
                      ? 'border-sage bg-sage/15 text-paper'
                      : oos
                      ? 'cursor-not-allowed border-paper/10 text-paper/20 line-through'
                      : 'border-paper/20 text-paper/60 hover:border-paper/50 hover:text-paper'
                  }`}
                >
                  {v.name}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* The print spec is the honest bit people can't see by looking —
          what area they're actually designing into, and at what quality
          it goes to the printer. */}
      {zone && (
        <section>
          <RailLabel n="03" label="Print area" />
          <dl className="mt-3 space-y-1.5">
            <SpecRow k="Size" v={`${zone.widthIn} × ${zone.heightIn} in`} />
            <SpecRow k="Output" v="300 DPI PNG" />
            <SpecRow k="Sides" v={twoSided ? 'Front & back' : 'Front only'} />
          </dl>
          <p className="mt-3 font-body text-[10px] leading-relaxed text-paper/30">
            Anything past the dashed edge is trimmed off the print.
          </p>
        </section>
      )}
    </div>
  )

  return (
    // Fixed to the viewport rather than min-h-screen: this is an editor, and
    // the page itself must never scroll — every panel manages its own overflow
    // so the garment can't be scrolled out from under the tools. 100dvh (not
    // vh) so mobile browser chrome collapsing doesn't leave the tab bar cut off.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0B0F0C]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      {/* This is the one screen in the app that could be mistaken for a
          bolted-on third-party widget — full-bleed dark chrome, no nav, no
          footer. The mark anchors it as ours, the same way a browser tab
          favicon does; without it there's nothing on screen saying DEWDROPZ
          made this tool. */}
      <header className="sticky top-0 z-30 flex flex-shrink-0 items-center justify-between gap-3 border-b border-paper/10 bg-[#0B0F0C]/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 flex-shrink-0 items-center gap-3 sm:gap-4">
          <Logo
            markHeight={20}
            wordmarkClassName="hidden sm:inline-block font-display text-xs tracking-[0.28em] text-paper"
          />
          <span className="hidden h-5 w-px bg-paper/15 sm:block" aria-hidden />
          <Link
            href={`/products/${product.slug}`}
            className="flex flex-shrink-0 items-center gap-1.5 font-body text-xs text-paper/50 transition-colors hover:text-paper"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </div>

        <div className="min-w-0 text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-sage">The Studio</div>
          <h1 className="truncate font-display text-sm leading-tight text-paper sm:text-base">{product.name}</h1>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="hidden font-body text-sm text-paper/70 tabular-nums sm:block">{formatPrice(price)}</span>
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-sm bg-sage px-4 py-2.5 font-body text-[10px] font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-paper disabled:opacity-60 sm:px-5"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {saving ? 'Saving…' : 'Add to bag'}
          </button>
        </div>
      </header>

      {/* min-h-0 on every flex level: without it a flex child refuses to
          shrink below its content height, which is exactly what let the
          garment overflow the viewport instead of scaling down. */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── Setup rail — desktop only ────────────────────────────────── */}
        <aside className="hidden flex-shrink-0 overflow-y-auto border-paper/10 lg:block lg:w-60 lg:border-r lg:px-5 lg:py-6">
          {setupContent}
        </aside>

        {/* ── Stage ────────────────────────────────────────────────────── */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {twoSided && (
            <div className="flex flex-shrink-0 justify-center gap-1 border-b border-paper/10 px-4 py-2">
              {sides.map((s) => {
                const filled = (s === 'front' ? frontCanvas : backCanvas)?.getObjects().length ?? 0
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveSide(s)}
                    aria-pressed={effectiveSide === s}
                    className={`flex items-center gap-2 rounded-sm px-5 py-1.5 font-body text-[10px] uppercase tracking-[0.12em] transition-colors duration-300 ${
                      effectiveSide === s ? 'bg-sage text-ink' : 'text-paper/50 hover:text-paper'
                    }`}
                  >
                    {s}
                    {/* A dot on the side you're not looking at is the only cue
                        that there's work over there — without it, a design on
                        the back is invisible from the front. */}
                    {filled > 0 && (
                      <span className={`h-1.5 w-1.5 rounded-full ${effectiveSide === s ? 'bg-ink/40' : 'bg-sage'}`} />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* The stage is just a box; CanvasStage fits the garment into
              whatever it measures here. Open a tool panel and this box gets
              shorter, so the garment scales down and stays wholly visible. */}
          <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-5 lg:p-6">
            {color?.front && (
              <CanvasStage
                zone={color.front}
                side="front"
                isActive={effectiveSide === 'front'}
                onFocus={() => setActiveSide('front')}
                onReady={setFrontCanvas}
              />
            )}
            {color?.back && (
              <CanvasStage
                zone={color.back}
                side="back"
                isActive={effectiveSide === 'back'}
                onFocus={() => setActiveSide('back')}
                onReady={setBackCanvas}
              />
            )}
          </div>
        </main>

        {/* ── Tools ────────────────────────────────────────────────────── */}
        <Toolbar
          canvas={activeCanvas}
          zone={zone}
          activeSide={effectiveSide}
          twoSided={twoSided}
          garmentHex={color?.hex}
          onCopyToOtherSide={copyActiveDesignToOtherSide}
          setupPanel={setupContent}
        />
      </div>
    </div>
  )
}

function RailLabel({ n, label, value }: { n: string; label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-paper/10 pb-1.5">
      <span className="font-body text-[10px] uppercase tracking-[0.18em] text-paper/40">
        <span className="text-sage">{n}</span> {label}
      </span>
      {value && <span className="truncate font-body text-[11px] text-paper/70">{value}</span>}
    </div>
  )
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="font-body text-[11px] text-paper/35">{k}</dt>
      <dd className="font-mono text-[10px] text-paper/60">{v}</dd>
    </div>
  )
}
