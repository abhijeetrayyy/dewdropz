import { SITE } from '@/lib/constants'

// A real Google Maps embed of the real address already in SITE.address — the
// basic `output=embed` iframe needs no API key and geocodes live, so nothing
// here is fabricated. No business hours shown: we don't have real ones to
// give, and inventing them would be the same "dummy thing" this pass is
// specifically fixing elsewhere on the form.
export default function VisitStudio() {
  const mapQuery = encodeURIComponent(SITE.address)

  return (
    <section className="bg-paper px-6 md:px-10 py-20 md:py-28">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-12 items-center">
        <div>
          <div className="font-body text-[10px] tracking-[0.3em] text-forest uppercase">Visit The Studio</div>
          <h2 className="mt-4 font-display font-light text-[clamp(28px,4vw,40px)] text-text leading-[1.1]">
            Where the gear gets made.
          </h2>
          <p className="mt-6 font-body text-sm text-mid leading-relaxed max-w-sm">{SITE.address}</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="view"
            data-cursor-text="Map"
            className="mt-6 inline-block font-body text-xs text-forest tracking-[0.1em] uppercase hover:text-forest-mid transition-colors duration-300 border-b border-forest/40 pb-0.5"
          >
            Get Directions →
          </a>
        </div>

        <div className="relative aspect-[4/3] md:aspect-[16/10] rounded-lg overflow-hidden border border-rule">
          <iframe
            src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
            title="DEWDROPZ studio location"
            className="absolute inset-0 w-full h-full grayscale-[15%] contrast-[1.05]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  )
}
