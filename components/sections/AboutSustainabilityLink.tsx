import Link from 'next/link'

export default function AboutSustainabilityLink() {
  return (
    <section className="bg-paper px-6 md:px-10 pb-24 md:pb-32">
      <div className="max-w-3xl mx-auto border border-rule rounded-lg px-8 py-10 md:px-12 md:py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="font-body text-[10px] tracking-[0.3em] text-forest uppercase">Beyond The Gear</div>
          <p className="mt-3 font-display font-light text-xl md:text-2xl text-text leading-snug">
            Small batches, close to home — our commitment doesn&apos;t stop at the product.
          </p>
        </div>
        <Link
          href="/sustainability"
          data-cursor="view"
          data-cursor-text="Read"
          className="shrink-0 font-body text-xs tracking-[0.1em] text-forest uppercase hover:text-forest-mid transition-colors duration-300 border-b border-forest/40 pb-0.5 whitespace-nowrap"
        >
          Read Our Commitment →
        </Link>
      </div>
    </section>
  )
}
