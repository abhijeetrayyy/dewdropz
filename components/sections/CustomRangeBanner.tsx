'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import type { Product } from '@/types/database'

type Blank = { id: string; slug: string; name: string }
type Card = Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'images'>

/**
 * "This one came out of the studio."
 *
 * A finished, already-printed garment is an ordinary product row, so nothing on
 * the page connected it to the studio it came from. A shopper who liked the
 * shirt but not the artwork had no way to discover the same garment takes
 * anything they want, and left.
 *
 * TWO STATES, ONE CARD. The tick in admin (`is_custom_range`) is what puts the
 * card here. Whether the garment itself is stocked as a blank is a separate
 * question, and the card answers it honestly rather than hiding:
 *
 *   · parent blank stocked  -> straight into the studio on that exact garment
 *   · not stocked           -> say so, and offer the blanks that ARE available
 *
 * The second case is the one worth getting right. Sending a shopper to a studio
 * that cannot make what they are looking at is worse than telling them plainly;
 * and hiding the offer altogether wastes the interest they have already shown.
 */
export default function CustomRangeBanner({
  blank,
  siblings,
  alternatives,
}: {
  /** The blank this was printed on, when we stock it. Null means we do not. */
  blank: Blank | null
  siblings: Card[]
  /** Blanks to offer instead, when `blank` is null. */
  alternatives: Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'images'>[]
}) {
  const [showAlternatives, setShowAlternatives] = useState(false)

  const studioHref = blank ? `/products/${blank.slug}/customize` : null
  const libraryHref = studioHref ? `${studioHref}?start=library` : null

  return (
    <section
      aria-labelledby="custom-range-heading"
      className="mt-8 rounded-[var(--r-panel)] border border-forest/20 bg-forest/[0.04] p-5 sm:p-6"
    >
      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-forest">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        From the design studio
      </p>

      <h2 id="custom-range-heading" className="mt-2 text-lg text-ink sm:text-xl">
        {blank ? (
          <>
            Printed on the <span className="font-medium">{blank.name}</span> — put your own
            artwork on the same garment.
          </>
        ) : (
          <>Want this with your own artwork on it?</>
        )}
      </h2>

      <p className="mt-2 max-w-prose text-sm text-mid">
        {blank
          ? 'Ours or yours, printed to order, front and back.'
          : 'We don’t stock this exact garment as a blank yet — but these ones we do print to order, front and back.'}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {blank ? (
          <>
            <Link
              href={libraryHref!}
              className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-forest-mid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Browse designs for this garment
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={studioHref!}
              className="inline-flex items-center gap-2 rounded-full border border-forest/30 px-5 py-2.5 text-sm font-medium text-forest transition-colors hover:bg-forest/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Upload your own
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowAlternatives(true)}
            disabled={alternatives.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-forest-mid disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {alternatives.length === 0 ? 'Nothing to design on yet' : 'See what you can design on'}
            {alternatives.length > 0 && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>

      {siblings.length > 0 && (
        <div className="mt-6 border-t border-forest/15 pt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mid">
            Already printed on this garment
          </p>
          {/* A rail, not a grid: the product page already has a related-products
              grid below, and a second grid reads as the same thing twice. */}
          <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-1">
            {siblings.map((s) => (
              <li key={s.id} className="w-[132px] shrink-0 snap-start">
                <Link href={`/products/${s.slug}`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--r-card)] bg-paper-deep">
                    {s.images?.[0] ? (
                      <Image src={s.images[0]} alt={s.name} fill sizes="132px"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-snug text-ink group-hover:text-forest">{s.name}</p>
                  <p className="font-mono text-[11px] text-mid">₹{(s.price / 100).toLocaleString('en-IN')}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The "not stocked" answer, given properly rather than as a dead end. */}
      {showAlternatives && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Garments you can design on"
          onClick={() => setShowAlternatives(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            // data-lenis-prevent, like every other scrollable overlay in this
            // app — Lenis is mounted app-wide and swallows wheel events, so
            // without it a long list here would simply refuse to scroll.
            data-lenis-prevent="true"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--r-shell)] bg-paper p-5 sm:rounded-[var(--r-panel)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg text-ink">This garment isn&apos;t in the studio yet</h3>
                <p className="mt-1 text-sm text-mid">
                  We print these to order instead — same press, same 300 DPI, front and back.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAlternatives(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-[var(--r-input)] p-2 text-mid transition-colors hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {alternatives.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/products/${b.slug}/customize?start=library`}
                    className="group block rounded-[var(--r-input)] border border-rule p-2 transition-colors hover:border-forest"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--r-card)] bg-paper-deep">
                      {b.images?.[0] ? (
                        <Image src={b.images[0]} alt="" fill sizes="160px" className="object-cover" />
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-snug text-ink group-hover:text-forest">{b.name}</p>
                    <p className="font-mono text-[11px] text-mid">
                      ₹{(b.price / 100).toLocaleString('en-IN')}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
