import Link from 'next/link'
import Image from 'next/image'
import type { RecapCard } from '@/actions/trekRecap'
import { SectionLabel } from '@/components/trek/ui/Bits'
import { BLUR_DATA_URL } from '@/lib/constants'
import { coverlessField, lightForTime } from '@/lib/trek'

// "It happened. Here is the proof."
//
// The board's hardest problem is that everything on it is a promise. A walk
// with a date is an intention; a walk with photographs and a paragraph written
// afterwards is the only thing here that could not have been posted by somebody
// who never left the house.
//
// So this sits under the board rather than above it: you come for what is on,
// and this is what tells you it is worth asking. It renders nothing at all when
// there is nothing — a section headed "recently out" over an empty row would
// say precisely the opposite of what it is for.
//
// THE DRIFTING CONTACT SHEET IS GONE. It was a full-bleed marquee: every
// photograph from every recap, cropped to 300×220, sliding past for sixty
// seconds a lap. Three things were wrong with it. A picture that is moving
// cannot be looked at, and these are the only pictures on the product that are
// evidence rather than atmosphere. The strip had to be `aria-hidden` and inert
// because a marquee full of links is a keyboard trap that moves, so the actual
// reading happened in a row of monospace place names underneath — which meant
// the proof and the way to reach it were two different objects. And a thing
// that drifts on its own is the visual language of a promotion, on the one
// section of the board whose entire job is to be believed.
//
// It is a plain grid now. One card per walk, the photograph still at full
// clarity with no scrim over it, the caption underneath where a caption goes,
// and the whole card is the link. Nothing moves.
export default function RecentRecaps({ recaps }: { recaps: RecapCard[] }) {
  if (recaps.length === 0) return null

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })

  return (
    <section className="trek-band py-14">
      <div className="trek-measure">
        <SectionLabel>It happened</SectionLabel>
        <p className="mt-3 max-w-lg font-body text-[14px] leading-relaxed text-mid">
          Walks that have been and gone, written up afterwards by the people who led them. This
          is the only part of the board that could not have been posted by somebody who stayed at
          home.
        </p>

        <ul className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {recaps.map((r) => {
            // RecapCard carries the departure moment but not the clock time, so
            // the hour is read back out of it in the board's own timezone — a
            // walk with no photograph still gets its own hour's field rather
            // than a grey box, because it happened too.
            const hhmm = new Date(r.starts_at).toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
            })
            const light = lightForTime(hhmm)
            const shot = r.photo_urls[0] ?? null

            return (
              <li key={r.plan_id}>
                <Link
                  href={`/trek-buddy/${r.plan_id}`}
                  className="trek-card trek-liftable flex h-full flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  <figure className="m-0 flex flex-1 flex-col">
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink">
                      {shot ? (
                        <Image
                          src={shot}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 92vw"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                          className="object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0"
                          style={{ background: coverlessField(light) }}
                        />
                      )}
                      {/* More than one came back with the walk. Said as a
                          count rather than by cropping four frames out of it,
                          which is what the strip used to do — and which made
                          one walk look like four. */}
                      {r.photo_urls.length > 1 && (
                        <span className="trek-glass-sm absolute bottom-2.5 left-2.5 rounded-[var(--r-stamp)] px-2 py-1 font-body text-[11px] font-medium leading-none text-paper">
                          <span className="font-mono tabular-nums">{r.photo_urls.length}</span>{' '}
                          photographs
                        </span>
                      )}
                    </div>

                    <figcaption className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                      <p className="font-body text-[12px] text-mid">
                        <span className="font-mono tabular-nums">{day(r.starts_at)}</span>
                        {' · '}
                        <span className="font-mono tabular-nums">{r.going}</span>{' '}
                        {r.going === 1 ? 'person' : 'people'}
                      </p>
                      <h3 className="trek-h3 mt-1.5 text-text">{r.place}</h3>
                      {r.body && (
                        <p className="mt-2 line-clamp-3 font-body text-[13.5px] leading-relaxed text-mid">
                          {r.body}
                        </p>
                      )}
                      <p className="mt-auto pt-3 font-body text-[12px] text-light">
                        Written by {r.host_name} after the walk.
                      </p>
                    </figcaption>
                  </figure>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
