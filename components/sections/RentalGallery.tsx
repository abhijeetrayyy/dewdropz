'use client'

import { useState } from 'react'
import Image from 'next/image'

/**
 * The photographs of one piece of gear.
 *
 * Rental items carry several shots — the tent pitched, the tent's inside, the
 * tent at night — and the page was rendering `images[0]` and silently dropping
 * the rest. For something a person is deciding whether to trust with a weekend
 * in the mountains, the second and third photographs are the ones that answer
 * the real question.
 *
 * A single-photograph item renders as a plain frame with no thumbnail rail, and
 * an item with none says so rather than showing an empty grey box that reads as
 * a failed load.
 */
export default function RentalGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0)
  const shown = images[active] ?? images[0]

  if (!images.length) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-[var(--r-card)] border border-rule bg-paper-deep/60">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mid">
          Photograph to come
        </span>
      </div>
    )
  }

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--r-card)] bg-paper-deep">
        <Image
          key={shown}
          src={shown}
          alt={name}
          fill
          sizes="(min-width:1024px) 520px, 90vw"
          className="object-cover"
          priority
        />
      </div>

      {images.length > 1 && (
        <ul className="mt-3 flex gap-3">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${name}, photograph ${i + 1} of ${images.length}`}
                aria-current={i === active}
                className={`relative block h-20 w-16 overflow-hidden rounded-[var(--r-card)] bg-paper-deep transition-opacity ${
                  i === active ? 'ring-2 ring-forest ring-offset-2 ring-offset-paper' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <Image src={src} alt="" fill sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
