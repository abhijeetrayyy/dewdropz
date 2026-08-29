'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useConsent } from '@/providers/ConsentProvider'

/**
 * The cookie choice, asked once.
 *
 * Two rules this is built around, both of them law rather than taste:
 *
 *   • Refusing must be as easy as agreeing. Two buttons, same size, same
 *     prominence — no greyed-out "manage preferences" hidden behind a link
 *     while a bright green ACCEPT ALL sits next to it.
 *   • Nothing loads until the answer is yes. The banner does not "confirm" a
 *     decision already taken; see ConsentProvider and AnalyticsProvider.
 *
 * It sits at the bottom on a dark ground so it reads as the site speaking
 * rather than an interruption pasted over the page, and it takes focus on
 * appearing so a keyboard or screen-reader user meets it in order rather than
 * discovering it after the whole page.
 */
export default function ConsentBanner() {
  const { consent, hydrated, grant, deny } = useConsent()
  const ref = useRef<HTMLDivElement>(null)

  const showing = hydrated && consent === 'unknown'

  useEffect(() => {
    if (showing) ref.current?.focus()
  }, [showing])

  if (!showing) return null

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink/95 backdrop-blur-sm outline-none"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex-1">
          <p id="consent-title" className="font-mono text-[10px] uppercase tracking-[0.16em] text-sage">
            Before we measure anything
          </p>
          <p className="mt-2 font-body text-[14px] leading-relaxed text-paper/80">
            We&apos;d like to use analytics cookies to see which pages people actually read, so we
            can make the shop better. Nothing is set unless you say yes, and you can change your
            mind any time.{' '}
            <Link href="/privacy" className="text-paper underline underline-offset-4 hover:text-sage">
              What we collect
            </Link>
            .
          </p>
        </div>

        {/* Equal weight, deliberately. Refusing is not the quiet option. */}
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={deny}
            className="flex-1 rounded-full border border-paper/30 px-6 py-2.5 font-body text-sm text-paper transition-colors hover:border-paper/60 sm:flex-none"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={grant}
            className="flex-1 rounded-full bg-paper px-6 py-2.5 font-body text-sm font-medium text-ink transition-colors hover:bg-white sm:flex-none"
          >
            That&apos;s fine
          </button>
        </div>
      </div>
    </div>
  )
}
