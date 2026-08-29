'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { ProductWithCollection } from '@/types/database'

// The workbench itself — a dark, focused work surface sitting on the warm
// daylight section around it. Pick a blank, a colour and a size here, then hand
// off into the real studio (fabric.js canvas, front/back artwork, live
// composite preview) with all three already chosen.
export default function DesignYourOwnConfigurator({ products }: { products: ProductWithCollection[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const product = products[Math.min(activeIndex, products.length - 1)]

  return (
    <div className="mt-10 md:mt-14 rounded-[var(--r-panel)] bg-[#0F1410] p-4 sm:p-6 md:p-8 shadow-[0_30px_80px_-40px_rgba(12,16,13,0.7)]">
      {/* Garment tabs, thumbnail-led — reads as picking up a garment off the
          bench rather than clicking a text tab. Driven off the real catalogue,
          so a fourth blank flagged customizable in admin appears here too. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
        {products.map((p, i) => {
          const thumb = p.customization_config?.colors?.find((c) => c.available)?.front?.mockupImage ?? p.images?.[0]
          const active = i === activeIndex
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-pressed={active}
              className={`group flex w-full items-center gap-3 rounded-[var(--r-input)] border py-2 pl-2 pr-4 transition-all duration-300 sm:w-auto ${
                active
                  ? 'border-sage/70 bg-sage/10'
                  : 'border-paper/10 hover:border-paper/30 hover:bg-paper/[0.04]'
              }`}
            >
              <span className="relative h-11 w-9 flex-shrink-0 overflow-hidden rounded-[var(--r-input)] bg-paper/10">
                {thumb && (
                  <Image
                    src={thumb}
                    alt=""
                    fill
                    sizes="36px"
                    className={`object-cover transition-[opacity,scale] duration-300 group-hover:scale-110 ${active ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'}`}
                  />
                )}
              </span>
              <span className="text-left">
                <span className={`block font-body text-[10px] tracking-[0.16em] uppercase transition-colors ${active ? 'text-sage' : 'text-paper/35'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={`block font-body text-[13px] leading-tight transition-colors ${active ? 'text-paper' : 'text-paper/60'}`}>
                  {p.name}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Keyed on product.id so switching garments resets colour/size by
          remounting, rather than an effect reaching back to clear stale state. */}
      <ProductPanel key={product.id} product={product} />
    </div>
  )
}

function ProductPanel({ product }: { product: ProductWithCollection }) {
  const allColors = product.customization_config?.colors ?? []
  const colors = allColors.filter((c) => c.available && (c.front || c.back))
  const [colorName, setColorName] = useState(colors[0]?.name)
  const color = colors.find((c) => c.name === colorName) ?? colors[0]

  const variants = product.variants ?? []
  const [variantId, setVariantId] = useState(variants[0]?.id)
  const variant = variants.find((v) => v.id === variantId) ?? variants[0]

  const [side, setSide] = useState<'front' | 'back'>('front')
  const shownZone = color?.[side] ?? color?.front ?? color?.back
  const previewImage = shownZone?.mockupImage ?? product.images?.[0]
  const price = product.price + (variant?.price_adjustment ?? 0)

  const params = new URLSearchParams()
  if (color?.name) params.set('color', color.name)
  if (variant?.id) params.set('variant', variant.id)
  const studioHref = `/products/${product.slug}/customize${params.toString() ? `?${params}` : ''}`

  return (
    <div className="mt-5 sm:mt-6 grid grid-cols-1 lg:grid-cols-[0.82fr_1fr] gap-5 lg:gap-8">
      {/* The lit stage — product photography on its own light surface, the way
          a garment sits under a lamp on a dark bench. */}
      <div className="relative overflow-hidden rounded-[var(--r-input)] bg-[#D9D9D7]">
        <div className="relative aspect-[4/5]">
          {previewImage && (
            <Image
              key={previewImage}
              src={previewImage}
              alt={`${product.name}, ${side}, in ${color?.name ?? 'default colour'}`}
              fill
              sizes="(max-width: 1024px) 100vw, 52vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover"
            />
          )}
        </div>

        {/* Front/back toggle sits on the stage itself — flipping the garment is
            part of looking at it, not a separate form field. */}
        {color?.front && color?.back && (
          <div className="absolute left-3 top-3 flex gap-1 rounded-[var(--r-input)] bg-ink/70 p-1 backdrop-blur-sm">
            {(['front', 'back'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                aria-pressed={side === s}
                className={`rounded-[2px] px-2.5 py-1 font-body text-[9px] tracking-[0.15em] uppercase transition-colors duration-300 ${
                  side === s ? 'bg-paper text-ink' : 'text-paper/70 hover:text-paper'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <span className="absolute right-3 top-3 rounded-[var(--r-input)] bg-ink/70 px-2.5 py-1 font-body text-[9px] tracking-[0.15em] uppercase text-paper backdrop-blur-sm">
          Your canvas
        </span>
      </div>

      {/* Options */}
      <div className="flex flex-col pt-1">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-display text-2xl md:text-[28px] leading-tight text-paper">{product.name}</h3>
          <span className="flex-shrink-0 font-body text-lg text-sage tabular-nums">{formatPrice(price)}</span>
        </div>
        {product.short_description && (
          <p className="mt-2 font-body text-[13px] leading-relaxed text-paper/50">{product.short_description}</p>
        )}

        {allColors.length > 0 && (
          <div className="mt-7">
            <Step n="01" label="Pick your colour" value={color?.name} />
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {allColors.map((c) => {
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
                    className={`relative h-8 w-8 rounded-full border transition-all duration-300 ${
                      selected
                        ? 'border-sage ring-2 ring-sage ring-offset-2 ring-offset-[#0F1410]'
                        : selectable
                        ? 'border-paper/25 hover:border-paper/60'
                        : 'cursor-not-allowed border-paper/10 opacity-30'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {/* A diagonal bar reads as "not orderable yet" without
                        relying on colour alone — on a control that *is* a colour. */}
                    {!selectable && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="block h-px w-full rotate-45 bg-paper/50" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {variants.length > 0 && (
          <div className="mt-7">
            <Step n="02" label="Pick your size" value={variant?.name} />
            <div className="mt-3 flex flex-wrap gap-2">
              {variants.map((v) => {
                const oos = (v.inventory_quantity ?? 0) <= 0
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={oos}
                    onClick={() => setVariantId(v.id)}
                    className={`min-w-[46px] rounded-[var(--r-input)] border px-3 py-2 font-body text-xs uppercase tracking-[0.06em] transition-colors duration-300 ${
                      variant?.id === v.id
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
          </div>
        )}

        <div className="mt-7">
          <Step n="03" label="Add your artwork" value="next, in the studio" />
          <ul className="mt-3 space-y-1.5">
            {[
              'Drop in a photo, a logo, or something you drew',
              'Or set type — our fonts, your words',
              'Front, back, or go loud and do both',
            ].map((line) => (
              <li key={line} className="flex gap-2.5 font-body text-[13px] leading-relaxed text-paper/55">
                <span aria-hidden className="text-sage">✦</span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto pt-7">
          <Link
            href={studioHref}
            className="group flex w-full items-center justify-center gap-2.5 rounded-[var(--r-input)] bg-sage px-6 py-4 font-body text-[11px] uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:bg-paper"
          >
            Customize
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
          <p className="mt-3 text-center font-body text-[10px] leading-relaxed text-paper/35">
            Opens the studio with this blank, colour and size already loaded.
          </p>
        </div>
      </div>
    </div>
  )
}

function Step({ n, label, value }: { n: string; label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-paper/10 pb-2">
      <span className="font-body text-[10px] uppercase tracking-[0.2em] text-paper/40">
        <span className="text-sage">{n}</span> — {label}
      </span>
      {value && <span className="font-body text-[11px] text-paper/70">{value}</span>}
    </div>
  )
}
