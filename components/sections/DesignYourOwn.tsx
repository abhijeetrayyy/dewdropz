import Link from 'next/link'
import BlankCard from '@/components/customize/BlankCard'
import type { ProductWithCollection } from '@/types/database'

// The studio showcase — "we make blanks you can print yourself." Renders
// whatever is actually flagged customizable in the catalogue rather than a
// hardcoded list of three, so turning a fourth blank on in admin surfaces it
// here with no code change. Renders nothing at all if none are configured.
export default function DesignYourOwn({ products }: { products: ProductWithCollection[] }) {
  const blanks = products.filter((p) => p.is_customizable && (p.customization_config?.colors?.length ?? 0) > 0)
  if (blanks.length === 0) return null

  return (
    // Mid-afternoon on the page's clock, between Pack Check (#F6F0E2) and The
    // Way Down (#F4EBD7) — this sits between them so the light keeps warming.
    <section className="bg-[#F5EEDD] px-6 md:px-10 py-20 md:py-28">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 md:mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-xl">
            <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">14:30 · The Workbench</div>
            <h2 className="font-display text-[clamp(30px,4.4vw,46px)] text-text mt-2 leading-[1.1]">
              Put your own mark on it.
            </h2>
            <p className="font-body text-sm text-mid mt-4 leading-relaxed">
              Heavyweight blanks in an oversized unisex fit — tee, sweatshirt, hoodie. Drop in your artwork or set some
              type, front and back, and see it on the garment before you order.
            </p>
          </div>
          <Link
            href="/customize"
            data-cursor="view"
            data-cursor-text="Design"
            className="flex-shrink-0 inline-flex items-center gap-2 bg-forest text-paper px-6 py-3.5 font-body text-[11px] tracking-[0.14em] uppercase rounded-sm hover:bg-forest-mid transition-colors duration-300"
          >
            Open the studio →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {blanks.map((p) => (
            <BlankCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
