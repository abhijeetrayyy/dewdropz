import Link from 'next/link'
import Image from 'next/image'
import type { RecapCard } from '@/actions/trekRecap'
import { BLUR_DATA_URL } from '@/lib/constants'

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
export default function RecentRecaps({ recaps }: { recaps: RecapCard[] }) {
  if (recaps.length === 0) return null

  return (
    <section className="mt-14">
      <h2 className="trek-label font-mono text-forest">
        It happened
      </h2>
      <p className="mt-2 max-w-lg font-body text-sm leading-relaxed text-mid">
        Walks that have been and gone, written up afterwards by the people who led them. This is
        the only part of the board that could not have been posted by somebody who stayed at home.
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {recaps.map((r) => (
          <li key={r.plan_id}>
            <Link
              href={`/trek-buddy/${r.plan_id}`}
              className="group block overflow-hidden rounded-[6px] border border-rule transition-colors hover:border-forest/50"
            >
              {r.photo_urls[0] ? (
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={r.photo_urls[0]}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 92vw"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                </div>
              ) : (
                <div aria-hidden="true" className="aspect-[4/3] bg-paper-warm" />
              )}
              <div className="p-3">
                <p className="trek-label font-mono text-mid">
                  {new Date(r.starts_at).toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
                  })}
                  {' · '}
                  {r.going} {r.going === 1 ? 'person' : 'people'}
                </p>
                <p className="mt-0.5 font-display text-base leading-tight text-text">{r.place}</p>
                <p className="mt-1 line-clamp-2 font-body text-xs leading-relaxed text-mid">
                  {r.body}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
