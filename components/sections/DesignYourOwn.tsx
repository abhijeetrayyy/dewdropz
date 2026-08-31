import SectionHeader from '@/components/SectionHeader'
import Link from 'next/link'
import DesignYourOwnConfigurator from '@/components/customize/DesignYourOwnConfigurator'
import { ContourLines } from '@/components/ui/ContourLines'
import type { ProductWithCollection } from '@/types/database'

// The studio showcase — "we make blanks you can print yourself." Renders
// whatever is actually flagged customizable in the catalogue rather than a
// hardcoded list of three, so turning a fourth blank on in admin surfaces it
// here with no code change. Renders nothing at all if none are configured.
//
// The interactive part lives in DesignYourOwnConfigurator (a client component)
// so this section stays a server component and the homepage only ships client
// JS for the one piece that actually needs it.
// It takes no chapter: a statement carries no eyebrow, so there is nothing here
// for one to name. The stop still exists in lib/trail.ts and still wraps this
// section in app/page.tsx — this component simply stopped printing it.
export default function DesignYourOwn({
  products,
}: {
  products: ProductWithCollection[]
  /** Agreed with its wrapper already; takes the prop anyway so it cannot
   *  start disagreeing later. That is the whole point of one source. */
}) {
  const blanks = products.filter((p) => p.is_customizable && (p.customization_config?.colors?.length ?? 0) > 0)
  if (blanks.length === 0) return null
  // `--paper-deep`, the third step of the ladder, for two reasons. The run
  // reads paper → paper-warm → paper-deep as a descent instead of paper,
  // warm, paper as a stutter. And ShopByCategory above renders NOTHING when
  // no category has stock — which is its live state — so on the real site
  // CollectionsRow's `--paper` met this band's `--paper` at 1.00:1 with no
  // seam at all. A ground that only obeys the law while its neighbour
  // happens to exist is not obeying it.

  return (
    // 14:30 on the page's clock — strong afternoon light. The section stays
    // warm daylight (the surrounding sections run #F6F0E2 → #F4EBD7, and going
    // dark here would break that arc), but it's layered rather than flat:
    // a warm gradient, a low sun-glow, and the brand's topographic contours.
    // The contrast people actually notice comes from the dark workbench panel
    // sitting on top of it.
    <section className="relative overflow-hidden bg-snow border-t border-rule px-6 py-20 md:px-10 md:py-28">
      {/* Low warm glow, as if the light is coming across the bench. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-1/4 top-0 h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle,rgba(215,169,106,0.20)_0%,transparent_70%)]"
      />
      <ContourLines className="opacity-[0.13]" />

      <div className="relative mx-auto max-w-measure">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            {/* "CUSTOM STUDIO (Make the Font a bit bigger)". The words come
                from the stop's label — renamed from "The workbench" in
                lib/trail.ts so the trail HUD and this eyebrow cannot drift
                apart — and the size goes 10px → 13px, the same +30% the hero's
                own THE STUDIO eyebrow was given. */}
            {/* STATEMENT — the heading IS the argument here, so it runs at
                roughly twice the stamp's scale and carries no eyebrow. The mono
                label that used to sit above it said the same words the section
                below already says, at 13px, for the third time on the page. A
                statement that needs announcing is not a statement. */}
            <SectionHeader
              species="statement"
              title={<>Go on — make it yours.</>}
              lede="Build every detail before it goes to print."
              className="mb-0 md:mb-0"
            />

            {/* THE TWO DOORS.
                Per the brief, the section has to say that there are two ways
                in — our library, or your own artwork — and it never did. The
                page sold "upload your design" exclusively, which quietly told
                everybody without a design that this part of the shop was not
                for them. Each is a real link: the library goes to the studio
                with its design picker already open. */}
            <dl className="mt-8 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="font-body text-[11px] uppercase tracking-[0.14em] text-forest">
                  <Link href="/customize?start=library" className="border-b border-forest/30 pb-0.5 transition-colors duration-300 hover:border-forest">
                    Browse the library
                  </Link>
                </dt>
                <dd className="mt-2 font-body text-[13px] leading-relaxed text-mid">
                  Choose from our DEWDROPZ design collections.
                </dd>
              </div>
              <div>
                <dt className="font-body text-[11px] uppercase tracking-[0.14em] text-forest">
                  <Link href="/customize?start=blank" className="border-b border-forest/30 pb-0.5 transition-colors duration-300 hover:border-forest">
                    Create your own
                  </Link>
                </dt>
                <dd className="mt-2 font-body text-[13px] leading-relaxed text-mid">
                  Start with a blank canvas or upload your own artwork.
                </dd>
              </div>
            </dl>
          </div>
          <Link
            href="/customize"
            className="group flex-shrink-0 font-body text-[11px] uppercase tracking-[0.14em] text-forest transition-colors duration-300 hover:text-forest-mid"
          >
            Open the studio{' '}
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">↗</span>
          </Link>
        </div>

        <DesignYourOwnConfigurator products={blanks} />

        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-forest/15 pt-7 sm:grid-cols-3">
          {[
            ['Printed in Dehradun', 'Same room the samples get made in.'],
            ['A run of exactly one', 'Nobody else walks up with your jacket on.'],
            ['Ships in 8–10 days', 'Made to order — COD available across India.'],
          ].map(([title, body]) => (
            <div key={title}>
              <div className="font-body text-[11px] uppercase tracking-[0.14em] text-forest">{title}</div>
              <p className="mt-1.5 font-body text-[13px] leading-relaxed text-mid">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
