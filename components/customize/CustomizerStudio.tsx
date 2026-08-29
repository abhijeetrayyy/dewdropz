'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check } from 'lucide-react'
import { Logo } from '@/components/Logo'
import type { Canvas } from 'fabric'
import { toast } from 'sonner'
import CanvasStage from './CanvasStage'
import BlankSwitcher from './BlankSwitcher'
import { saveCarry, takeCarry, applyCarry, type CarriedDesign } from '@/lib/customize/carryDesign'
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
  blanks = [],
  initialVariantId,
  initialColorName,
  openLibrary = false,
}: {
  product: ProductWithCollection
  /** The other customizable blanks, so the garment can be changed from inside
   *  the studio instead of by leaving it. */
  blanks?: Pick<ProductWithCollection, 'id' | 'slug' | 'name' | 'price' | 'images'>[]
  initialVariantId?: string
  initialColorName?: string
  /** Arrived through the "Browse the library" door (`?start=library`) rather
   *  than "Create your own". Passed straight through to the Toolbar, which
   *  owns the panel. */
  openLibrary?: boolean
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

  // Rehydrate a design carried in from another blank.
  //
  // Runs once per canvas, after the canvas exists — `takeCarry` clears the
  // handoff, so the ref is what stops the second side's mount from finding an
  // empty store and silently dropping the back of the design.
  const carriedRef = useRef<CarriedDesign | null | undefined>(undefined)
  useEffect(() => {
    if (carriedRef.current === undefined) carriedRef.current = takeCarry()
    const carried = carriedRef.current
    if (!carried) return

    let cancelled = false
    ;(async () => {
      let worstScale = 1
      for (const side of ['front', 'back'] as const) {
        const json = carried[side]
        const canvas = side === 'front' ? frontCanvas : backCanvas
        const sideZone = color?.[side]
        if (!json || !canvas || !sideZone || canvas.getObjects().length > 0) continue
        const k = await applyCarry(canvas, json, carried.fromZone, sideZone)
        worstScale = Math.max(worstScale, k)
      }
      if (cancelled || worstScale === 1) return

      // Growing the artwork spreads the same pixels over more inches, so the
      // print gets softer. Say so rather than let it be discovered at delivery.
      if (worstScale > 1.02) {
        toast(`Brought over from the ${carried.fromName} and resized to fit.`, {
          description: 'This garment prints larger, so check the quality warning before adding to cart.',
        })
      } else {
        toast(`Brought over from the ${carried.fromName}.`)
      }
    })()
    return () => { cancelled = true }
  }, [frontCanvas, backCanvas, color])

  if (sides.length === 0) {
    return (
      <div className="studio flex min-h-screen items-center justify-center bg-[var(--st-well)] px-6 text-center">
        <p className="font-body text-[var(--st-ink-2)]">
          {colorways.length > 0
            ? 'None of this product’s colours are available to customize right now.'
            : 'This product isn’t set up for customization yet.'}
        </p>
      </div>
    )
  }

  /**
   * Change garment, keeping the work.
   *
   * The design is serialised here and re-fitted on arrival rather than being
   * re-fitted now: only the destination knows its own zone, and reading it
   * would mean fetching the other product just to decide how to scale.
   */
  function switchBlank(slug: string) {
    const front = frontCanvas?.getObjects().length ? frontCanvas.toJSON() : undefined
    const back = backCanvas?.getObjects().length ? backCanvas.toJSON() : undefined
    const basis = zone ?? color?.front ?? color?.back

    if ((front || back) && basis) {
      saveCarry({
        fromSlug: product.slug,
        fromName: product.name,
        fromZone: {
          widthPx: basis.widthPx, heightPx: basis.heightPx,
          widthIn: basis.widthIn, heightIn: basis.heightIn,
        },
        front, back,
      })
    }
    router.push(`/products/${slug}/customize`)
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
        front_print_dpi?: number
        back_print_dpi?: number
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
        payload[`${side}_print_dpi`] = print.dpi
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
                      ? 'border-[var(--st-accent)] ring-2 ring-[var(--st-accent)] ring-offset-2 ring-offset-[var(--st-panel)]'
                      : selectable
                      ? 'border-[var(--st-line)] hover:border-[var(--st-ink-2)]'
                      : 'cursor-not-allowed border-[var(--st-edge)] opacity-25'
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
                  className={`min-w-[44px] rounded-[var(--r-input)] border px-3 py-2 font-body text-[11px] uppercase tracking-[0.05em] transition-colors duration-300 lg:min-w-[40px] lg:px-2.5 lg:py-1.5 ${
                    variantId === v.id
                      ? 'border-[var(--st-accent)] bg-[var(--st-hover)] text-[var(--st-ink)]'
                      : oos
                      ? 'cursor-not-allowed border-[var(--st-edge)] text-[var(--st-ink-3)]/50 line-through'
                      : 'border-[var(--st-line)] bg-[var(--st-raise)] text-[var(--st-ink-2)] hover:border-[var(--st-ink-2)] hover:text-[var(--st-ink)]'
                  }`}
                >
                  {v.name}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {blanks.length > 1 && (
        <section>
          <RailLabel n="03" label="Garment" />
          <div className="mt-3">
            <BlankSwitcher blanks={blanks} currentSlug={product.slug} onSwitch={switchBlank} />
          </div>
        </section>
      )}

      {/* The print spec is the honest bit people can't see by looking —
          what area they're actually designing into, and at what quality
          it goes to the printer. */}
      {zone && (
        <section>
          <RailLabel n="04" label="Print area" />
          <dl className="mt-3 space-y-1.5">
            <SpecRow k="Size" v={`${zone.widthIn} × ${zone.heightIn} in`} />
            <SpecRow k="Output" v="300 DPI PNG" />
            <SpecRow k="Sides" v={twoSided ? 'Front & back' : 'Front only'} />
          </dl>
          <p className="mt-3 font-body text-[11px] leading-relaxed text-[var(--st-ink-3)]">
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
    <div className="studio flex h-[100dvh] flex-col overflow-hidden bg-[var(--st-well)] text-[var(--st-ink)]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      {/* This is the one screen in the app that could be mistaken for a
          bolted-on third-party widget — full-bleed dark chrome, no nav, no
          footer. The mark anchors it as ours, the same way a browser tab
          favicon does; without it there's nothing on screen saying DEWDROPZ
          made this tool. */}
      <header className="sticky top-0 z-30 flex flex-shrink-0 items-center justify-between gap-3 border-b border-[var(--st-rule)] bg-[var(--st-panel)] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-shrink-0 items-center gap-3 sm:gap-4">
          <Logo
            markHeight={20}
            wordmarkClassName="hidden sm:inline-block font-display text-xs tracking-[0.28em] text-[var(--st-ink)]"
          />
          <span className="hidden h-5 w-px bg-[var(--st-rule)] sm:block" aria-hidden />
          <Link
            href={`/products/${product.slug}`}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-[var(--r-input)] px-2 py-1.5 font-body text-xs text-[var(--st-ink-2)] transition-colors hover:bg-[var(--st-raise)] hover:text-[var(--st-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </div>

        <div className="min-w-0 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--st-ink-3)]">The Studio</div>
          <h1 className="truncate font-display text-sm leading-tight text-[var(--st-ink)] sm:text-base">{product.name}</h1>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="hidden font-mono text-sm text-[var(--st-ink-2)] tabular-nums sm:block">{formatPrice(price)}</span>
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="flex items-center gap-2 rounded-[var(--r-input)] bg-[var(--st-ink)] px-4 py-2.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--st-well)] transition-all duration-300 hover:bg-white disabled:opacity-50 sm:px-5"
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
        <aside data-lenis-prevent="true" className="hidden flex-shrink-0 overflow-y-auto bg-[var(--st-panel)] lg:block lg:w-[248px] lg:border-r lg:border-[var(--st-rule)] lg:px-5 lg:py-6">
          {setupContent}
        </aside>

        {/* ── Stage ────────────────────────────────────────────────────── */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {twoSided && (
            <div className="flex flex-shrink-0 justify-center gap-1 border-b border-[var(--st-rule)] bg-[var(--st-panel)] px-4 py-2">
              {sides.map((s) => {
                const filled = (s === 'front' ? frontCanvas : backCanvas)?.getObjects().length ?? 0
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveSide(s)}
                    aria-pressed={effectiveSide === s}
                    className={`flex items-center gap-2 rounded-[var(--r-input)] px-5 py-1.5 font-body text-[10px] uppercase tracking-[0.12em] transition-colors duration-300 ${
                      effectiveSide === s
                        ? 'bg-[var(--st-raise)] text-[var(--st-ink)] shadow-[inset_0_0_0_1px_var(--st-line)]'
                        : 'text-[var(--st-ink-3)] hover:bg-[var(--st-raise)] hover:text-[var(--st-ink-2)]'
                    }`}
                  >
                    {s}
                    {/* A dot on the side you're not looking at is the only cue
                        that there's work over there — without it, a design on
                        the back is invisible from the front. */}
                    {filled > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--st-ink)]" />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* The stage is just a box; CanvasStage fits the garment into
              whatever it measures here. Open a tool panel and this box gets
              shorter, so the garment scales down and stays wholly visible. */}
          <div className="studio-stage min-h-0 flex-1 overflow-hidden p-3 sm:p-5 lg:p-8">
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
          blankId={product.id}
          activeSide={effectiveSide}
          twoSided={twoSided}
          garmentHex={color?.hex}
          onCopyToOtherSide={copyActiveDesignToOtherSide}
          openLibraryOnMount={openLibrary}
          setupPanel={setupContent}
        />
      </div>
    </div>
  )
}

function RailLabel({ n, label, value }: { n: string; label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[var(--st-edge)] pb-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--st-ink-3)]">
        <span className="text-[var(--st-ink-2)]">{n}</span> {label}
      </span>
      {value && (
        <span className="truncate font-body text-[12px] text-[var(--st-ink)]">{value}</span>
      )}
    </div>
  )
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="font-body text-[12px] text-[var(--st-ink-3)]">{k}</dt>
      <dd className="font-mono text-[11px] text-[var(--st-ink-2)] tabular-nums">{v}</dd>
    </div>
  )
}
