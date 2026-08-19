import Link from 'next/link'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import { DIFFICULTY_LABEL, hourInk, lightForTime } from '@/lib/trek'
import { formatPrice } from '@/lib/utils'
import Countdown from './Countdown'
import Cover from './ui/Cover'
import Avatar from './ui/Avatar'
import SeatMeter from './ui/SeatMeter'
import { Tag } from './ui/Bits'
import HourPill from './ui/HourPill'

/** IST, because the walk happens in India and the server does not. */
function istParts(iso: string) {
  const d = new Date(iso)
  const f = (o: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...o })
  return { day: f({ day: '2-digit' }), month: f({ month: 'short' }), weekday: f({ weekday: 'short' }) }
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)

// One walk.
//
// The card already led with a photograph, and that was right. What it did not
// do was tell you anything you could act on without reading: capacity was the
// string "3/8" in 10px grey, the host was an initial in a circle nobody else
// on the product used, and the three facts that actually decide whether you
// can go — how far, how much, how hard — were either absent or set at the same
// weight as the month.
//
// So the foot of the card is rebuilt as an instrument panel:
//
//   THE DATE is a torn calendar corner, top left, on paper — because a date is
//     a physical thing you circle, and it survives any photograph behind it.
//   THE HOUR is a filled pill in its own colour, top right, so a board scanned
//     at speed reads as a day passing: amber at first light, green through the
//     middle, indigo before dawn, pale blue after dark.
//   THE SEATS are drawn as seats. Eight segments with three filled is a thing
//     you know without arithmetic; "3/8" is a thing you have to work out.
//   THE HOST is the same avatar they wear everywhere else on the product, so
//     you can recognise somebody across screens without reading a name.
//
// And when there is no photograph — which on a young board is most walks — the
// field is the hour's own colour with a contour sketch drawn from the walk's
// real distance and climb. A board of coverless walks still looks composed.
export default function TrekPlanCard({
  plan,
  priority = false,
}: {
  plan: TrekPlanRow
  priority?: boolean
}) {
  const light = lightForTime(plan.start_time)
  const { day, month, weekday } = istParts(plan.starts_at)
  const full = plan.spots_left <= 0
  const cancelled = plan.status === 'cancelled'
  const nights = Math.round(
    (new Date(plan.ends_on).getTime() - new Date(plan.starts_on).getTime()) / 86400000
  )
  const cover = plan.cover_urls?.[0] ?? null

  return (
    <Link
      href={`/trek-buddy/${plan.id}`}
      className={`trek-card trek-liftable group flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
        cancelled ? 'opacity-60' : ''
      }`}
    >
      <Cover
        src={cover}
        light={light}
        place={plan.place}
        distanceKm={plan.distance_km}
        gainM={plan.gain_m}
        priority={priority}
        className="aspect-[16/10] w-full"
      >
        {/* The date, torn off a calendar. */}
        <span className="absolute left-3 top-3 flex flex-col items-center rounded-[var(--r-input)] bg-paper/95 px-2.5 py-1.5 leading-none">
          <span className="trek-label-xs text-mid">{weekday}</span>
          <span className="mt-1 font-display text-[19px] font-medium text-text tabular-nums">
            {day}
          </span>
          <span className="mt-1 trek-label-xs text-mid">{month}</span>
        </span>

        {/* The hour, in its own colour. */}
        {plan.start_time ? (
          <HourPill time={plan.start_time} light={light} className="absolute right-3 top-3" />
        ) : (
          <span className="trek-glass-sm absolute right-3 top-3 rounded-full px-2.5 py-1.5 font-mono text-[11px] font-medium leading-none text-paper tabular-nums">
            {nights + 1} days
          </span>
        )}

        {/* The nudge, and the two states that change what you can do.
            Bottom-left, and nothing else shares the line with it — the place
            name lives in the body where it has the full width, which is the
            difference between "Nag Tibba" and "Nagtibba to Pantwari trav…". */}
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
          {cancelled ? (
            <span className="trek-glass-sm rounded-full px-2.5 py-1 text-[11px] font-medium text-[#C09A85]">
              Called off
            </span>
          ) : full ? (
            <span className="trek-glass-sm rounded-full px-2.5 py-1 text-[11px] font-medium text-paper/85">
              Waitlist open
            </span>
          ) : (
            <Countdown
              iso={plan.starts_at}
              prefix="Leaves in"
              className="trek-glass-sm rounded-full px-2.5 py-1 font-mono text-[11px] font-medium text-paper tabular-nums"
            />
          )}
        </div>
      </Cover>

      {/* The instrument panel. Kept off the photograph, because type on a
          picture is a poster and a poster cannot be read at a glance. */}
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3.5">
        <div className="min-w-0">
          <p className="trek-label-xs" style={{ color: hourInk(light, 'light') }}>
            {plan.activity_label} · {plan.start_time ? light.label : 'On the hill'}
          </p>
          <h3 className="trek-h3 mt-2 text-text">{plan.place}</h3>
          <p className="mt-1.5 truncate font-body text-[13px] text-mid">
            From {plan.meet_area}
            {nights > 0
              ? ` · ${nights + 1} days`
              : plan.back_by
                ? ` · back ${hhmm(plan.back_by)}`
                : ''}
            {plan.distance_km ? ` · ${plan.distance_km} km` : ''}
            {plan.gain_m ? ` · ${plan.gain_m} m up` : ''}
          </p>
        </div>

        <SeatMeter
          taken={plan.going_count}
          capacity={plan.capacity}
          light={light}
          captionClassName="text-mid"
        />

        <div className="mt-auto flex items-center gap-2 border-t border-rule-soft pt-3">
          <Avatar name={plan.host_name} id={plan.host_id} size={24} />
          <span className="min-w-0 truncate font-body text-[13px] text-mid">{plan.host_name}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* A cost is a fact about the walk, not a clock running out on the
                reader. In amber it sat in the same register as "leaving in two
                hours" and read as a warning about money; neutral, it reads as
                what it is. "Free" keeps sage, because free is genuinely good
                news rather than merely a number. */}
            {plan.cost_paise ? (
              <Tag tone="outline">{formatPrice(plan.cost_paise)}</Tag>
            ) : (
              <Tag tone="sage">Free</Tag>
            )}
            <Tag tone="outline">{DIFFICULTY_LABEL[plan.difficulty] ?? plan.difficulty}</Tag>
            {plan.women_only && <Tag tone="clay">Women only</Tag>}
            {!plan.women_only && plan.senior_friendly && <Tag tone="sage">Senior ok</Tag>}
          </span>
        </div>
      </div>
    </Link>
  )
}
