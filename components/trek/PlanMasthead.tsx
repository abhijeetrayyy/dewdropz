import Link from 'next/link'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import { DIFFICULTY_LABEL, lightForTime } from '@/lib/trek'
import { formatPrice } from '@/lib/utils'
import Avatar from './ui/Avatar'
import Cover from './ui/Cover'
import HourPill from './ui/HourPill'
import { FactRow, Tag } from './ui/Bits'

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)

function istLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long',
  })
}

// The masthead for one walk.
//
// It takes the colour of its own departure hour, so a 05:20 birding page and a
// 21:40 stargazing page do not look like the same page with different words in
// it — the page is lit the way the outing is. That is the board's hour rail
// scaled up to fill a screen, which is what makes the two feel like one product
// rather than a list and a detail view that happen to share a nav.
//
// The photograph now goes through `Cover`, which means a walk with no picture
// gets the hour field and the contour sketch drawn from its real distance and
// climb rather than a flat colour — the same fallback the board's cards use, so
// a coverless walk looks composed on both surfaces instead of only on one.
//
// THREE THINGS CHANGED IN THE RESET.
//
// THE HEADLINE. It was `clamp(40px, 5vw, 64px)` at `font-light`, which is
// Newsreader drawn as a hairline three inches tall — a fashion masthead, and
// the exact gesture the owner called "funky". It is `trek-h1` now: the same
// serif every other headline on the board uses, at weight 400, clamped 30→46.
// A place name is a name, not a poster.
//
// THE SCRIM. The photograph was carrying two of them — Cover's hour tint from
// 62% AND a three-stop black gradient that ran 0.55 at the top and 0.85 at the
// foot — so every walk's picture was a grey wash with the shape of a hill in
// it. There is now a genuine clear window through the middle of the frame and
// the darkness is only where the type actually lands. A picture a stranger
// cannot see is a megabyte spent on nothing.
//
// THE SAFETY FLAGS. Women-only and senior-friendly were on the board's cards
// and then vanished on the one screen where somebody actually commits to the
// day. They sit beside the hour now, in the same clay and sage the card uses,
// so a person who filtered for them on the board finds them again here rather
// than having to take it on trust that the filter worked.
//
// The facts row carries FIGURES ONLY. `FactRow` sets its values in monospace at
// 19px, which is right for a distance and wrong for the word "Moderate" —
// difficulty and languages used to be rendered through it and read as machine
// output. Difficulty is a tag here; languages are set as words in the walk's
// own terms panel. And the row still never renders "—": an unknown fact is not
// a fact, and the row is as long as the host's answers are.
export default function PlanMasthead({
  plan,
  hostVouches,
}: {
  plan: TrekPlanRow
  /** Counted in Postgres from completed walks. Omitted when nobody has. */
  hostVouches?: number | null
}) {
  const light = lightForTime(plan.start_time ?? '06:00')
  const cancelled = plan.status === 'cancelled'
  const overnight = plan.ends_on !== plan.starts_on

  const nights = Math.round(
    (new Date(plan.ends_on).getTime() - new Date(plan.starts_on).getTime()) / 86400000
  )
  const multiDay = nights > 0

  // Only what the host actually answered, and only what is genuinely a number.
  // A blank is more use than a figure somebody invented, because a stranger
  // plans their day around whatever this says — so every one of these is
  // guarded, and the row shrinks rather than filling itself with dashes.
  const facts: { k: string; v: string }[] = []
  if (plan.distance_km != null) facts.push({ k: 'Distance', v: `${plan.distance_km} km` })
  if (plan.gain_m != null) facts.push({ k: 'Climb', v: `${plan.gain_m.toLocaleString('en-IN')} m` })
  // "Shared", not "price". The board never takes money and this is a split of
  // fuel and permits — calling it a cost would make it a ticket.
  if (plan.cost_paise != null) {
    facts.push({
      k: 'Cost share',
      v: plan.cost_paise === 0 ? 'Nothing' : `${formatPrice(plan.cost_paise)} each`,
    })
  }
  if (multiDay) {
    facts.push({ k: 'Days out', v: String(nights + 1) })
  } else if (plan.back_by) {
    facts.push({ k: 'Back by', v: `${hhmm(plan.back_by)}${overnight ? ' +1' : ''}` })
  }

  return (
    <header className="relative isolate flex min-h-[440px] items-end overflow-hidden bg-ink">
      {/* Cover is `position: relative` by design — it is a frame, and a frame
          that could be told to go absolute would need every caller to get the
          stacking right. So the absolute positioning lives on a wrapper.

          A called-off walk loses most of its light rather than gaining a red
          band. The photograph is still there, because the walk was real; it is
          just no longer the thing you are being invited into. */}
      <div className={`absolute inset-0 ${cancelled ? 'opacity-40' : ''}`}>
        <Cover
          src={plan.cover_urls?.[0] ?? null}
          light={light}
          place={plan.place}
          distanceKm={plan.distance_km}
          gainM={plan.gain_m}
          sizes="100vw"
          priority
          scrimFrom={70}
          className="h-full w-full"
        />
      </div>

      {/* Four stops rather than three, and the two middle ones are the point:
          they hold a band of the frame at almost nothing so the photograph is
          actually a photograph somewhere. The top stop exists only to carry the
          fixed bar across the first forty pixels, and the bottom one is set at
          the lowest value the headline and the facts can be read over — which
          is what "as strong as the type needs" means in a number. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(12,16,13,0.5) 0%, rgba(12,16,13,0.06) 30%, rgba(12,16,13,0.06) 46%, rgba(12,16,13,0.8) 100%)',
        }}
      />

      <div className="trek-band relative w-full pb-8 pt-32 md:pt-36">
        <div className="trek-measure">
          <Link
            href="/trek-buddy"
            className="inline-block border-b border-paper/30 pb-0.5 font-body text-[13px] font-medium text-paper/70 transition-colors hover:border-paper hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage"
          >
            ← Discover
          </Link>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <HourPill time={plan.start_time} light={light} withLabel />
            <span className="font-body text-sm text-paper/80">
              {plan.activity_label} · {istLong(plan.starts_at)}
            </span>
          </div>

          {/* The three flags a cautious person is actually scanning for, in the
              same colours the board's cards give them. Clay is "who may come at
              all"; sage is "the host has thought about who this suits". */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tag tone="ondark">{DIFFICULTY_LABEL[plan.difficulty] ?? plan.difficulty}</Tag>
            {plan.women_only && <Tag tone="clay">Women only</Tag>}
            {plan.senior_friendly && <Tag tone="sage">Senior friendly</Tag>}
            {cancelled && <Tag tone="clay">Called off</Tag>}
          </div>

          <h1 className="trek-h1 mt-4 max-w-[820px] text-balance text-paper">{plan.place}</h1>

          <p className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-body text-sm text-paper/75">
            <span>{plan.meet_area} · hosted by</span>
            <Link
              href={`/trek-buddy/people/${plan.host_id}`}
              className="inline-flex items-center gap-2 text-paper underline decoration-paper/40 underline-offset-4 transition-colors hover:decoration-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage"
            >
              <Avatar name={plan.host_name} id={plan.host_id} size={24} ground="dark" role="host" />
              {plan.host_name}
            </Link>
            {/* Mono on the count, because it is a count. Not on the word after
                it, because that is a word. */}
            {typeof hostVouches === 'number' && hostVouches > 0 && (
              <span className="font-body text-[13px] text-sage">
                <span className="font-mono tabular-nums">{hostVouches}</span> vouched for them
              </span>
            )}
          </p>

          <FactRow facts={facts} tone="dark" className="mt-7" />
        </div>
      </div>
    </header>
  )
}
