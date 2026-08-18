import Link from 'next/link'
import Image from 'next/image'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import { DIFFICULTY_LABEL, lightForTime } from '@/lib/trek'
import { BLUR_DATA_URL } from '@/lib/constants'
import Countdown from './Countdown'

/** IST, because the walk happens in India and the server does not. */
function istParts(iso: string) {
  const d = new Date(iso)
  const f = (o: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...o })
  return { day: f({ day: '2-digit' }), month: f({ month: 'short' }), weekday: f({ weekday: 'short' }) }
}

/** start_time and back_by are nullable — a six-day trek need not name an hour. */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)

// One walk, led by a photograph.
//
// The card used to be text on paper with a coloured rail down the side. Every
// fact was there and it still read as a row in a spreadsheet, because a board
// of strangers only becomes a place people go when you can see where they are
// going. So the picture is the card now, and the type sits in it.
//
// The departure hour still governs: it tints the scrim, colours the time, and
// names the light. That was the best idea in the old card and it survives
// intact — a board scanned quickly still reads as a day passing.
//
// WHEN THERE IS NO PHOTOGRAPH. Most walks will not have one for a while, and a
// grey box with a broken-image icon would be worse than what this replaces. The
// fallback is a deep field in the hour's own colour with the place name set
// large in it — deliberately handsome rather than apologetic, so a board of
// coverless walks still looks composed and a host is tempted rather than shamed
// into adding a picture.
export default function TrekPlanCard({ plan }: { plan: TrekPlanRow }) {
  // A trek with no stated hour still needs a colour; 06:00 reads as a morning
  // departure, which is what a multi-day trek almost always is.
  const light = lightForTime(plan.start_time ?? '06:00')
  const { day, month, weekday } = istParts(plan.starts_at)
  const full = plan.spots_left <= 0
  const nights = Math.round(
    (new Date(plan.ends_on).getTime() - new Date(plan.starts_on).getTime()) / 86400000
  )
  const cover = plan.cover_urls?.[0] ?? null

  return (
    <Link
      href={`/trek-buddy/${plan.id}`}
      className="trek-card group relative flex flex-col bg-ink transition-transform duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dawn"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: `linear-gradient(155deg, ${light.bar} 0%, #0C100D 82%)`,
            }}
          >
            {/* The place, set as the picture. Big, low-contrast, cropped by the
                frame — an absent photograph made into a deliberate one. */}
            <span className="absolute -bottom-2 left-4 right-4 truncate font-display text-[42px] leading-none text-paper/15">
              {plan.place}
            </span>
          </div>
        )}

        {/* Scrim, shaped to the type below it rather than a flat wash. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(12,16,13,0.55) 0%, rgba(12,16,13,0.05) 38%, rgba(12,16,13,0.86) 100%)',
          }}
        />

        {/* The date, top left — a torn calendar corner, as before. */}
        <div className="absolute left-4 top-3.5 flex items-baseline gap-1.5">
          <span className="font-display text-2xl leading-none text-paper tabular-nums">{day}</span>
          <span className="trek-label font-mono text-paper/75">
            {month} · {weekday}
          </span>
        </div>

        {/* The nudge, top right. */}
        <Countdown
          iso={plan.starts_at}
          className="trek-label absolute right-3.5 top-3.5 rounded-full bg-ink/75 px-3 py-1.5 font-mono text-paper backdrop-blur-sm tabular-nums"
        />

        {/* Departure hour and its light, over the dark foot of the picture. */}
        <div className="absolute inset-x-4 bottom-3">
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono text-sm tabular-nums"
              style={{ color: light.onDark }}
            >
              {hhmm(plan.start_time) ?? `${nights + 1} days`}
            </span>
            <span className="trek-label font-mono text-paper/70">
              {plan.start_time ? light.label : 'On the hill'}
            </span>
          </div>
          <h3 className="mt-0.5 truncate font-display text-xl leading-tight text-paper">
            {plan.place}
          </h3>
        </div>
      </div>

      {/* The facts, on paper. Keeping them off the photograph is what stops the
          card turning into a poster nobody can read. */}
      <div className="flex flex-1 flex-col gap-2 bg-paper px-4 pb-4 pt-3.5">
        <p className="flex items-center gap-1.5 font-body text-xs text-mid">
          <span
            aria-hidden="true"
            className="grid h-4 w-4 place-items-center rounded-full bg-forest/12 font-mono text-[8px] text-forest"
          >
            {plan.host_name.trim().charAt(0).toUpperCase()}
          </span>
          {plan.host_name}
          <span className="text-rule">·</span>
          {plan.activity_label}
        </p>

        <p className="font-body text-xs text-mid">
          From {plan.meet_area}
          {nights > 0 ? ` · ${nights + 1} days` : plan.back_by ? ` · back ${hhmm(plan.back_by)}` : ''}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          <span className="trek-label font-mono text-mid tabular-nums">
            {plan.going_count}/{plan.capacity}
          </span>
          <span
            className={`trek-label font-mono ${
              full ? 'text-clay' : 'text-forest'
            }`}
          >
            {full ? 'Full' : `${plan.spots_left} space${plan.spots_left === 1 ? '' : 's'}`}
          </span>
          <span className="trek-label font-mono text-mid">
            {DIFFICULTY_LABEL[plan.difficulty] ?? plan.difficulty}
          </span>
          {plan.women_only && (
            <span className="rounded-full border border-clay/50 px-2 py-0.5 trek-label-xs font-mono text-clay">
              Women only
            </span>
          )}
          {plan.senior_friendly && (
            <span className="rounded-full border border-forest/40 px-2 py-0.5 trek-label-xs font-mono text-forest">
              Senior friendly
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
