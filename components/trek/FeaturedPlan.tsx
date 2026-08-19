import Link from 'next/link'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import { formatPrice } from '@/lib/utils'
import { DIFFICULTY_LABEL, lightForTime } from '@/lib/trek'
import Cover from './ui/Cover'
import Avatar from './ui/Avatar'
import SeatMeter from './ui/SeatMeter'
import HourPill from './ui/HourPill'
import { Tag } from './ui/Bits'

/** IST — the board is in India even when the server is not. */
function dateLine(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// One walk given the whole width.
//
// Chosen, not curated: the soonest walk that still has room and has a
// photograph to give. Nothing here is editorially promoted, because there is
// no editor — and a "featured" slot that quietly meant "we picked this" would
// be the first untrue thing on the board.
//
// The scrim runs sideways rather than down, because the type sits on the left
// third and the photograph should keep the other two. That part was right and
// it stays.
//
// Three things were not. The hour sat top-left as a fully saturated lozenge in
// the hour's own colour — the biggest painted swatch anywhere on the board, on
// the one card already carrying a photograph — so it is now the neutral
// HourPill every other surface uses, a coloured dot and a legible time. The
// place name was Newsreader at 300 across 46px, which is a fashion masthead
// and not a walk. And the facts underneath were three uppercase mono strings
// at 10px, which is the weight you give a caption, not the weight you give
// "difficult" or "women only" — those are now the same tags the plan cards
// carry, and the two that decide whether a person may or should come are
// stated rather than implied.
export default function FeaturedPlan({ plan }: { plan: TrekPlanRow }) {
  const light = lightForTime(plan.start_time)

  return (
    <Link
      href={`/trek-buddy/${plan.id}`}
      className="group relative flex min-h-[340px] items-end overflow-hidden rounded-[var(--r-panel)] bg-ink shadow-[0_24px_60px_-24px_rgba(12,16,13,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage md:min-h-[380px]"
    >
      {/* Cover is `position: relative` by design — it is a frame, and a frame
          that could be told to go absolute would need every caller to get the
          stacking right. So the absolute positioning lives on a wrapper. */}
      <div className="absolute inset-0">
        <Cover
          src={plan.cover_urls?.[0] ?? null}
          light={light}
          place={plan.place}
          distanceKm={plan.distance_km}
          gainM={plan.gain_m}
          sizes="(min-width: 1024px) 1200px, 100vw"
          priority
          scrimFrom={70}
          className="h-full w-full"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(12,16,13,0.86) 0%, rgba(12,16,13,0.42) 55%, rgba(12,16,13,0.06) 100%)',
        }}
      />

      {plan.start_time ? (
        <HourPill
          time={plan.start_time}
          light={light}
          withLabel
          ground="dark"
          className="absolute left-5 top-5"
        />
      ) : (
        <span className="trek-glass-sm absolute left-5 top-5 rounded-full px-3 py-1.5 font-body text-[11px] font-medium leading-none text-paper">
          Multi-day
        </span>
      )}

      <div className="relative max-w-xl p-6 md:p-10">
        <p className="font-mono text-[14px] text-paper/75 tabular-nums">
          {dateLine(plan.starts_at)}
        </p>
        <h2 className="trek-h1 mt-2.5 text-paper">{plan.place}</h2>
        <p className="mt-3 line-clamp-2 font-body text-sm leading-relaxed text-paper/75">
          {plan.note?.trim() ||
            `${plan.activity_label} from ${plan.meet_area}${
              plan.distance_km ? ` · ${plan.distance_km} km` : ''
            }${plan.gain_m ? ` · ${plan.gain_m} m of climb` : ''}.`}
        </p>

        {/* Difficulty and cost stay quiet on the dark ground; women-only and
            senior-friendly take the light chips, because on the one card the
            board gives full width to, the person who needs to know a walk is
            women-only should not have to open it to find out. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <span className="flex items-center gap-2">
            <Avatar name={plan.host_name} id={plan.host_id} size={26} ground="dark" role="host" />
            <span className="font-body text-[13px] text-paper/80">{plan.host_name}</span>
          </span>
          <Tag tone="ondark">{DIFFICULTY_LABEL[plan.difficulty] ?? plan.difficulty}</Tag>
          <Tag tone="ondark">
            {plan.cost_paise ? `${formatPrice(plan.cost_paise)} share` : 'No cost'}
          </Tag>
          {plan.women_only && <Tag tone="clay">Women only</Tag>}
          {plan.senior_friendly && <Tag tone="sage">Senior friendly</Tag>}
        </div>

        <SeatMeter
          taken={plan.going_count}
          capacity={plan.capacity}
          light={light}
          ground="dark"
          className="mt-5 max-w-[280px]"
        />
      </div>
    </Link>
  )
}
