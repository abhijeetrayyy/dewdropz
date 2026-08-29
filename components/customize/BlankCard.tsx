import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { ProductWithCollection } from '@/types/database'

// One customizable blank, on the /customize index. Styled as a dark card on a
// light stage — the same pairing the studio and the homepage configurator use
// (garment photography needs a lit surface; the brand chrome around it is
// dark) — so clicking through from here into the actual studio doesn't feel
// like landing on a different, unrelated tool.
export default function BlankCard({
  product,
  start,
}: {
  product: ProductWithCollection
  /** Carried through from /customize?start=… so the studio knows to open the
   *  DEWDROPZ library rather than a blank canvas. Undefined is the blank
   *  canvas, which is what this card has always led to. */
  start?: 'library'
}) {
  const colors = product.customization_config?.colors ?? []
  const availableCount = colors.filter((c) => c.available).length

  return (
    <Link
      href={`/products/${product.slug}/customize${start ? `?start=${start}` : ''}`}
      className="group block overflow-hidden rounded-[var(--r-input)] bg-[#131A15] ring-1 ring-paper/10 transition-all duration-300 hover:ring-sage/50"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#D9D9D7]">
        {product.images?.[0] && (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
          />
        )}
        <span className="absolute left-3 top-3 rounded-[var(--r-input)] bg-ink/70 px-2.5 py-1 font-body text-[9px] tracking-[0.15em] uppercase text-paper backdrop-blur-sm">
          Front &amp; back
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {/* Name and price stack instead of sharing a row — sharing one (the
            original layout) let a wrapped name and a flex-shrink-0 price both
            fight for the same line at narrow card widths, and the price lost:
            it was pushed outside the card, invisibly absorbed by the grid gap
            in most columns but visibly clipped past the edge in the last one. */}
        <h3 className="font-display text-base sm:text-lg text-paper leading-snug">{product.name}</h3>
        <span className="mt-0.5 block font-body text-xs sm:text-sm text-sage tabular-nums">{formatPrice(product.price)}</span>
        {product.short_description && (
          <p className="mt-1.5 font-body text-xs leading-relaxed text-paper/45">{product.short_description}</p>
        )}

        {colors.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {colors.map((c) => (
              <span
                key={c.name}
                title={c.available ? c.name : `${c.name} — coming soon`}
                className={`relative h-4 w-4 rounded-full border ${
                  c.available ? 'border-paper/25' : 'border-paper/10 opacity-40'
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {!c.available && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="block h-px w-full rotate-45 bg-paper/60" />
                  </span>
                )}
              </span>
            ))}
            <span className="ml-1 font-body text-[10px] text-paper/35">{availableCount} available</span>
          </div>
        )}

        <div className="mt-5 flex items-center gap-1.5 border-t border-paper/10 pt-4 font-body text-[10px] uppercase tracking-[0.16em] text-sage">
          Customize
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  )
}
