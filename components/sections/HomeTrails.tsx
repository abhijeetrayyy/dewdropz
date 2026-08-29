import { stopEyebrow, type TrailStop } from '@/lib/trail'
import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL, TRAILS } from '@/lib/constants'
import type { HomeTrail } from '@/types/database'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 15:30 — golden hour. The trails, on the front door.
//
// Two problems this solves at once.
//
// Structurally, the homepage ran five consecutive warm-paper sections through
// its middle. Even with the new paper ladder that's a long stretch of the same
// idea, and this is the point in the descent where the light goes gold — so this
// section is the page's one full-bleed photographic moment. Real mountains,
// nearly full width, under a warm scrim. It's the drama the middle of the page
// was missing.
//
// Commercially, this is the brand's actual reason to exist and it was buried on
// a page most visitors never reached. A gear company whose homepage only sells
// gear is a catalogue; one that tells you where to go is a guide you come back
// to. The month strip carries over from /treks because season is the single
// most consequential decision on any of these routes, and twelve cells say it
// faster than a paragraph.
export default function HomeTrails({ trails, stop }: { trails: HomeTrail[]; stop: TrailStop }) {
  // WHICH ROUTES, AND WHO DECIDES.
  //
  // It used to be four slugs written here and looked up in lib/constants —
  // "chosen for range rather than order: the beginner's snow summit, the valley
  // walk, the monsoon bloom, and the high pass." A good editorial call that
  // only a deploy could change. The brief asks for the DEWDROPZ team to be able
  // to add routes to this section themselves, so the list now arrives as data
  // from store_settings.home_config.trails (edited at /admin/homepage) and
  // those same four are its seeded default.
  const featured = trails

  if (featured.length === 0) return null
  // The first trail's photograph doubles as the section's full-bleed plate.
  const lead = featured[0]
  // A card deep-links into the guide when the guide actually has that route,
  // and falls back to the index when it does not — an admin can add a route
  // here that /treks has never heard of, and a link to a 404 is worse than a
  // link to the list it would have been on.
  const guideHref = (slug: string) =>
    TRAILS.some((t) => t.slug === slug) ? `/treks#${slug}` : '/treks'

  return (
    <section className="on-dark relative overflow-hidden bg-forest-deep">
      {/* ── The plate: a real ridge, held under a warm scrim so type survives on
             top of it. This is the page's only full-bleed photograph. ───────── */}
      <div className="absolute inset-0">
        <Image
          src={lead.image}
          alt=""
          fill
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover"
        />
        {/* Golden-hour light raking down the frame. The first stop was too
            transparent to hold type — a pale sky read straight through it and
            the eyebrow disappeared — so the top now carries a warm-but-dark
            wash rather than a tint, and the ramp reaches full depth by the time
            the cards start. */}
        <div className="absolute inset-0 bg-[linear-gradient(178deg,rgba(74,45,12,0.72)_0%,rgba(30,48,22,0.74)_40%,rgba(12,16,13,0.93)_100%)]" />
        {/* A second pass angled from the left, so the headline always has ground
            under it while the ridge stays visible on the right. Kept off the
            right third deliberately — the whole point of this section is that
            there is a real mountain behind it. */}
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(12,16,13,0.62)_0%,rgba(12,16,13,0.14)_52%,transparent_72%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">
        {/* ── Masthead ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[19ch] sm:max-w-2xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-dawn-soft">
              {stopEyebrow(stop)}
            </div>
            {/* The page's largest type after the hero — this is the site's second
                thesis and should look like it. Capped at 60px: at the old 74px
                the line broke to four ragged lines and the last word hung alone. */}
            <h2 className="mt-4 font-display text-[clamp(34px,4.8vw,60px)] font-light leading-[1.02] text-paper">
              The journey starts before the trail.
              <span className="mt-1 block italic text-dawn-soft">Here&apos;s where to begin.</span>
            </h2>
            {/* No longer "Eight Uttarakhand routes". The list is admin-editable
                now, so a hardcoded count would go wrong the first time somebody
                added a fifth card — the exact failure this section was changed
                to prevent. */}
            <p className="mt-6 max-w-xl font-body text-sm leading-relaxed text-paper/80 md:text-[15px]">
              Curated trails, seasonal insights, and practical notes to help you discover your
              next adventure — before you take the first step.
            </p>
          </div>

          <Link
            href="/treks"
            className="group flex-shrink-0 self-start font-body text-[11px] uppercase tracking-[0.14em] text-dawn transition-colors duration-300 hover:text-paper md:self-auto"
          >
            The full guide{' '}
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* ── The rail ─────────────────────────────────────────────────────────
               Horizontal on phones (four tall cards would otherwise be a
               four-screen column), a four-up grid from lg. ───────────────────── */}
        <ul className="mt-14 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-3 md:mx-0 md:px-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {featured.map((trail, i) => (
            <li key={trail.slug} className="w-[74vw] flex-shrink-0 snap-start sm:w-[46vw] lg:w-auto">
              <Link
                href={guideHref(trail.slug)}
                className="group flex h-full flex-col rounded-[var(--r-input)] border border-paper/15 bg-ink/45 p-4 backdrop-blur-md transition-colors duration-300 hover:border-dawn/50 hover:bg-ink/60"
              >
                <div className="relative aspect-[5/4] overflow-hidden rounded-[2px] bg-forest-deep">
                  <Image
                    src={trail.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 74vw, (max-width: 1024px) 46vw, 22vw"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
                  />
                  <span className="absolute left-2.5 top-2.5 rounded-[2px] bg-ink/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-dawn backdrop-blur-sm">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="absolute bottom-2.5 right-2.5 rounded-[2px] bg-ink/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-paper/85 backdrop-blur-sm tabular-nums">
                    {trail.altitude}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-xl leading-tight text-paper">{trail.name}</h3>
                <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper/45">
                  {trail.difficulty} · {trail.duration}
                </div>

                {/* The month strip — the section's one piece of real data, and
                    the device that makes this read as a guide rather than an ad. */}
                <div className="mt-4">
                  <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-paper/40">When to go</div>
                  <ul className="mt-1.5 flex gap-[3px]" aria-label={`Best months: ${trail.bestMonths.join(', ')}`}>
                    {MONTHS.map((m) => {
                      const good = trail.bestMonths.includes(m)
                      return (
                        <li
                          key={m}
                          // Colour can't carry this alone: in-season cells also
                          // take full-opacity type, and every cell is labelled.
                          className={`flex-1 rounded-[1px] py-1 text-center font-mono text-[8px] uppercase ${
                            good ? 'bg-dawn text-forest-deep' : 'bg-paper/[0.09] text-paper/30'
                          }`}
                        >
                          {m[0]}
                          <span className="sr-only">
                            {m}
                            {good ? ' — in season' : ' — out of season'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <p className="mt-3.5 font-body text-[12.5px] leading-relaxed text-paper/60">{trail.season}</p>
              </Link>
            </li>
          ))}
        </ul>

        {/* Restrictions exist on two of these routes. Even a homepage teaser
            shouldn't imply everything is freely walkable. */}
        <p className="mt-8 font-body text-[11.5px] leading-relaxed text-paper/45">
          Some routes need permits, and one is currently restricted by court order — the guide says which,
          and why, on every entry.
        </p>
      </div>
    </section>
  )
}
