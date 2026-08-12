'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { BLUR_DATA_URL, SITE } from '@/lib/constants'
import type { FeaturedReview } from '@/actions/reviews'

const ROTATE_INTERVAL = 7000

// One field report at a time: the customer's own words, the product they
// actually bought, and whether the purchase was verified.
//
// This used to render four fabricated customers — invented names, treks,
// altitudes and quotes, each stamped "✓ Verified buyer". That is fake social
// proof on a live storefront, so it's gone. The section now reads approved rows
// from the `reviews` table and renders NOTHING until real ones exist, rather
// than holding a shape with invented content. Every field below maps to a real
// column; nothing is synthesised.
export default function Community({ reviews }: { reviews: FeaturedReview[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const count = reviews.length

  useEffect(() => {
    if (paused || count < 2) return
    const timer = setInterval(() => setActive((a) => (a + 1) % count), ROTATE_INTERVAL)
    return () => clearInterval(timer)
  }, [paused, count])

  if (count === 0) return null

  const report = reviews[Math.min(active, count - 1)]
  const authorName = report.user?.full_name?.trim() || 'DEWDROPZ customer'
  const initials =
    authorName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'DZ'
  const productImage = report.product?.images?.[0]

  return (
    // Late afternoon on the page's clock — the warmest paper of the day, before
    // the final sections go to night.
    <section className="bg-[#F4EBD7] px-6 md:px-10 py-24 md:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 md:mb-16 flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">16:30 · The Way Down</div>
            <h2 className="mt-3 font-display font-light text-[clamp(30px,4.5vw,48px)] text-text leading-[1.1]">
              Worn. Tested. Reported back.
            </h2>
          </div>
          <p className="hidden md:block font-body text-sm text-mid max-w-[240px] text-right leading-relaxed">
            Every word here was written by someone who bought the piece and used it.
          </p>
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-10 lg:gap-16 items-center"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* The report */}
          <div className="order-2 lg:order-1 flex flex-col min-h-[320px]">
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={report.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1"
              >
                {report.title && (
                  <div className="mb-4 font-body text-[11px] tracking-[0.14em] text-forest uppercase">
                    {report.title}
                  </div>
                )}
                <p className="font-display font-light italic text-[clamp(20px,2.6vw,30px)] text-text leading-[1.45]">
                  &ldquo;{report.content}&rdquo;
                </p>

                <div className="mt-8 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 bg-forest">
                    <span className="font-body text-[11px] font-medium text-paper">{initials}</span>
                  </div>
                  <div>
                    <div className="font-body text-sm text-text font-medium">
                      {authorName}
                      {/* Only shown when the purchase was actually matched to an
                          order — see is_verified in createReview(). */}
                      {report.is_verified && (
                        <span className="ml-2 font-body text-[9px] tracking-[0.1em] text-sage uppercase">
                          ✓ Verified buyer
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-mid mt-0.5">
                      {'★'.repeat(report.rating)}
                      <span className="text-light">{'★'.repeat(5 - report.rating)}</span>
                      {report.product && <> · on the {report.product.name}</>}
                    </div>
                  </div>
                </div>
              </motion.blockquote>
            </AnimatePresence>

            {/* Pagination — report index, not dots */}
            {count > 1 && (
              <div className="mt-10 flex items-center gap-5">
                {reviews.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Read report ${i + 1}`}
                    // p-3/-m-3 grows the tap target to ~40px for thumbs without
                    // shifting the visual layout; the underline lives on the span.
                    className="p-3 -m-3"
                  >
                    <span
                      className={`font-mono text-[11px] tracking-[0.1em] pb-1 border-b transition-colors duration-300 ${
                        i === active
                          ? 'text-forest border-forest'
                          : 'text-light border-transparent hover:text-mid'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </button>
                ))}
                <div className="flex-1 h-px bg-rule" />
                <span className="font-mono text-[11px] text-light">
                  {String(count).padStart(2, '0')} reports
                </span>
              </div>
            )}
          </div>

          {/* The evidence — the product that was actually reviewed. Falls back
              to a flat panel when the product has no photo yet, rather than
              borrowing a stock trek shot to stand in for it. */}
          <div className="order-1 lg:order-2 relative">
            <div className="relative aspect-[4/5] max-h-[520px] w-full rounded-sm overflow-hidden bg-[#E4DAC4]">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  {productImage && (
                    <Image
                      src={productImage}
                      alt={report.product?.name ?? ''}
                      fill
                      sizes="(max-width: 1024px) 100vw, 45vw"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      className="object-cover"
                    />
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent pointer-events-none" />

              <div className="absolute top-4 left-4 bg-ink/70 backdrop-blur-sm rounded-sm px-3 py-2">
                <div className="font-mono text-[13px] text-paper tabular-nums">{report.rating}.0</div>
                <div className="font-body text-[8px] tracking-[0.18em] text-paper/60 uppercase mt-0.5">
                  Rated out of 5
                </div>
              </div>

              {report.product && (
                <Link
                  href={`/products/${report.product.slug}`}
                  className="absolute bottom-4 left-4 font-mono text-[10px] tracking-[0.08em] text-paper/80 uppercase hover:text-paper transition-colors"
                >
                  {report.product.name} →
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="mt-20 flex items-center justify-between border-t border-rule pt-8">
          <div className="font-body text-[10px] tracking-[0.2em] text-forest uppercase">Spotted on the Trail</div>
          <a
            href={SITE.instagram}
            data-cursor="magnetic"
            className="font-body text-xs text-mid hover:text-forest transition-colors"
          >
            Tag <span className="text-forest">@dewdropz.shop</span> to be featured →
          </a>
        </div>
      </div>
    </section>
  )
}
