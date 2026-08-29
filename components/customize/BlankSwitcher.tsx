'use client'

import Image from 'next/image'
import { Shirt } from 'lucide-react'
import type { Product } from '@/types/database'

/**
 * Change garment without leaving the studio.
 *
 * Until now the only way from the tee to the hoodie was: leave the studio, go
 * to the shop, find the other blank, open it — four navigations, and the design
 * in progress was gone by the second one. So people did not explore garments;
 * they picked one at the door and lived with it.
 *
 * This is a rail of the other blanks, in the studio, next to the colour
 * swatches — the two things that change what you are printing on, together.
 * Switching carries the work across (see lib/customize/carryDesign.ts), which
 * is the whole reason this is worth building rather than just linking.
 *
 * It renders nothing when there is only one blank in the catalogue: a picker
 * with one option is furniture.
 */
export default function BlankSwitcher({
  blanks,
  currentSlug,
  onSwitch,
}: {
  blanks: Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'images'>[]
  currentSlug: string
  /** Given the destination slug. The studio owns saving the carry and navigating. */
  onSwitch: (slug: string) => void
}) {
  const others = blanks.filter((b) => b.slug !== currentSlug)
  if (others.length === 0) return null

  return (
    <div>
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--st-ink-3)]">
        <Shirt className="h-3 w-3" aria-hidden="true" />
        Print it on something else
      </p>
      {/* A grid, not a scroller. The studio rail is ~207px wide and two 104px
          cards plus their gap need 216px, so a horizontal list clipped the
          second garment against the rail edge and read as a broken layout
          rather than a scrollable one. There are two or three blanks; they fit. */}
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {others.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onSwitch(b.slug)}
              className="group flex w-full flex-col gap-1.5 rounded-[var(--r-input)] border border-[var(--st-rule)] bg-[var(--st-raise)] p-1.5 text-left transition-colors hover:border-[var(--st-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--st-accent)]"
            >
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[var(--r-input)] bg-[var(--st-well)]">
                {b.images?.[0] ? (
                  <Image src={b.images[0]} alt="" fill sizes="110px" className="object-cover" />
                ) : null}
              </span>
              <span className="block px-0.5 text-[11px] leading-tight text-[var(--st-ink)] group-hover:text-[var(--st-accent)]">
                {b.name}
              </span>
              <span className="block px-0.5 font-mono text-[10px] text-[var(--st-ink-3)]">
                ₹{(b.price / 100).toLocaleString('en-IN')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
