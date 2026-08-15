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
export default function DesignYourOwn({ products }: { products: ProductWithCollection[] }) {
  const blanks = products.filter((p) => p.is_customizable && (p.customization_config?.colors?.length ?? 0) > 0)
  if (blanks.length === 0) return null

  return (
    // 14:30 on the page's clock — strong afternoon light. The section stays
    // warm daylight (the surrounding sections run #F6F0E2 → #F4EBD7, and going
    // dark here would break that arc), but it's layered rather than flat:
    // a warm gradient, a low sun-glow, and the brand's topographic contours.
    // The contrast people actually notice comes from the dark workbench panel
    // sitting on top of it.
    <section className="relative overflow-hidden bg-paper border-t border-rule px-6 py-20 md:px-10 md:py-28">
      {/* Low warm glow, as if the light is coming across the bench. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-1/4 top-0 h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle,rgba(215,169,106,0.20)_0%,transparent_70%)]"
      />
      <ContourLines className="opacity-[0.13]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest">14:30 · The Workbench</div>
            <h2 className="mt-3 font-display text-[clamp(32px,5vw,54px)] leading-[1.03] text-text">
              Go on — make it yours.
            </h2>
            <p className="mt-5 max-w-xl font-body text-sm leading-relaxed text-mid md:text-[15px]">
              Three heavyweight blanks in an oversized unisex fit. Choose a colour and size right here, then throw
              your artwork on the front, the back, or both. You&apos;ll see exactly how it prints{' '}
              <span className="text-text">before you order a thing.</span>
            </p>
          </div>
          <Link
            href="/customize"
            className="group flex-shrink-0 font-body text-[11px] uppercase tracking-[0.14em] text-forest transition-colors duration-300 hover:text-forest-mid"
          >
            See every blank{' '}
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
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
