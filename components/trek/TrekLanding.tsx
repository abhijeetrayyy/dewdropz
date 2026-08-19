import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'
import {
  ACTIVITIES, BOARD_CHECKS, BOARD_LIMITS, DAY_PART_LABEL, SAFETY_NOTES,
  dotColor, lightForTime,
} from '@/lib/trek'
import JourneyRail from './ui/JourneyRail'
import { Datum } from './ui/Bits'

// The first page.
//
// What was here after the first pass was a lifestyle pitch — a 92vh drifting
// photograph, "Chase the light. Together." in hairline serif, a word marquee,
// an amber gradient card. It was competent and it was wrong, because it made
// an argument about how going outdoors FEELS to a person who already does it.
//
// The people this has to convince are not those people. They are somebody who
// has never walked further than a park and does not know whether they would be
// the slowest; a woman working out whether a 4am shared cab with five strangers
// is a thing she can do; somebody in their sixties who has been told "moderate"
// before and been left behind; and, yes, somebody with twenty years of
// expeditions who wants to know within about four seconds whether this is
// serious or whether it is a meetup group with a logo.
//
// All four are asking the same question — CAN I TRUST THIS — and none of them
// gets an answer from a photograph. So the page is an argument, in order:
//
//    1. what this is, said plainly, with the counts as they actually are
//    2. what it is NOT, said before anybody has to ask
//    3. who it is for, with the specific provision each person gets
//    4. how a walk actually works, end to end
//    5. what the platform ENFORCES, and — in the same width, in the same
//       type, deliberately impossible to skip — where that enforcement stops
//    6. how a reputation is built, and what it does and does not prove
//    7. what kinds of outing exist, with their real rules
//    8. the six things to do before you go
//    9. the questions people actually ask
//
// There is one photograph, it is quiet, and nothing on the page moves.

const PATHWAYS: {
  key: string
  who: string
  worry: string
  provisions: string[]
}[] = [
  {
    key: 'first',
    who: 'You have never done this before',
    worry: '“I will be the slowest, and everyone else will already know each other.”',
    provisions: [
      'Every walk states its difficulty, its distance and its climb before you ask to join — no walk on this board is allowed to be vague about how hard it is.',
      'Hosts write the day out hour by hour, so you can picture yourself inside it instead of guessing.',
      'Walks marked for a slower pace exist, and the filter for them is on the board, not buried.',
      'You ask; you are not added. If a host thinks a walk is wrong for you, they say so before the day, which is the kindest possible moment to find out.',
    ],
  },
  {
    key: 'women',
    who: 'You are a woman deciding whether this is safe',
    worry: '“Who is actually going to be there, and who has checked?”',
    provisions: [
      'Women-only walks are enforced in the database, not by a note asking politely: only a woman can post one and only women can ask to join.',
      'The exact meeting point is never on a public page. It reaches confirmed walkers only, and only once enough people are going.',
      'A host can require a verified phone number, or two vouches from people you have actually walked with, before anyone may even ask.',
      'Phone numbers, emails and handles are refused in every free-text field, so arrangements stay on the walk’s own page where they remain reviewable.',
      'You can report or block anybody, at any point, and you never have to explain why.',
    ],
  },
  {
    key: 'senior',
    who: 'You are older, or you walk at your own pace',
    worry: '“I have been told ‘easy’ before and then been left behind.”',
    provisions: [
      'Senior-friendly is a field a host sets deliberately, and it is a filter on the board.',
      'Pace is stated on a profile and on a walk, in words rather than in numbers nobody can calibrate.',
      'Distance, total climb and the hour you are expected back are all on the card, before you click.',
      'You can leave at any point on any walk. That is stated to everybody, on the walk itself, not only to you.',
    ],
  },
  {
    key: 'experienced',
    who: 'You have been going for years',
    worry: '“Is this serious, or is it a meetup group?”',
    provisions: [
      'Every number on this platform is counted from what happened — walks completed, people who vouched after being confirmed alongside you. None of it can be typed in.',
      'Overnight and after-dark outings carry their own rules: a larger minimum party, and a host who must write down how everyone gets back in the dark.',
      'Hosts get a real console — roster, waitlist in order, check-in at the meeting point, announcements, and a cost-share ledger at face value.',
      'You can host a walk you were going on anyway in about two minutes, and set the bar for who may ask.',
    ],
  },
]

const QUESTIONS: { q: string; a: string }[] = [
  {
    q: 'Does it cost anything?',
    a: 'No. Nobody pays for a place on a walk and DEWDROPZ takes no cut of anything. Some walks split real costs at face value — fuel, a permit, a shared cab — and when they do, the amount is shown on the card before you ask to join. The platform holds no money; the ledger in a host’s console is a shared memory, not a wallet.',
  },
  {
    q: 'Who is checking that these people are who they say they are?',
    a: 'Nobody, and that is stated everywhere rather than buried. The platform verifies actions, never identities: that a phone number is held, that a walk was completed, that a vouch came from somebody confirmed alongside you. It cannot verify a name, an age, or that somebody is fit for the day they signed up to. Everyone here is a stranger you met on the internet until you have walked together.',
  },
  {
    q: 'What stops somebody just turning up?',
    a: 'The exact meeting point is not on the public page. It is released to confirmed walkers only, and only once the walk has enough people going — so a walk nobody joins hands its address to nobody. A host confirms each person individually, and declining is silent.',
  },
  {
    q: 'Can I bring a friend?',
    a: 'Yes, and there is an invite card for exactly that. Anybody can open the public page of a walk; the meeting point stays hidden until the host confirms them, the same as for anyone else.',
  },
  {
    q: 'What happens if a walk is called off?',
    a: 'Everybody confirmed is told immediately, with the host’s reason. A cancelled walk leaves the board for everyone. Better a cancelled sunrise than a group waiting at a dark bus stand.',
  },
  {
    q: 'Is DEWDROPZ organising these?',
    a: 'No. DEWDROPZ makes and sells outdoor gear, and this board is a place its members use to find each other. Nobody from the company organises, leads, vets or supervises any of it, and no one is watching a screen while you are out. In an emergency, call 112.',
  },
]

export default function TrekLanding({
  openCount,
  weekendCount,
  peopleCount,
  activityCounts,
}: {
  openCount: number
  weekendCount: number
  peopleCount: number
  activityCounts: Record<string, number>
}) {
  return (
    <>
      {/* ── 1 · What this is ─────────────────────────────────────────────── */}
      {/* No full-bleed photograph behind the headline. A washed-out picture
          under a scrim is the house style of every travel brand, it costs a
          megabyte, and at the opacity that keeps type legible it stops being a
          picture at all. So the hero is TYPE, and the photograph is a framed
          panel beside it at full clarity with a caption — which is how a
          serious publication uses an image, and which lets it actually be
          looked at. */}
      <section className="trek-band bg-ink pb-16 pt-32 md:pb-20 md:pt-40">
        <div className="trek-measure">
          <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-16">
            <div>
              <p className="trek-eyebrow text-sage">
                A members’ noticeboard · Dehradun and the hills around it
              </p>

              <h1 className="trek-h1 mt-6 max-w-[20ch] text-balance text-paper">
                Nobody should have to choose between going alone and not going at all.
              </h1>

              <p className="mt-6 max-w-xl font-body text-[16.5px] leading-[1.7] text-paper/75">
                TrekBuddy is where DEWDROPZ members post the walk they are already going on — the
                place, the hour they leave, how hard it is — and other members ask to come. The
                host decides who joins them. The meeting point stays private until enough people
                are going. Nobody pays for a place, and nobody is being sold a tour.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/auth/login?redirect=/trek-buddy"
                  className="trek-pill trek-pill-lg trek-pill-actinv font-body"
                >
                  See what is on
                </Link>
                <a href="#how" className="trek-pill trek-pill-lg trek-pill-onink font-body">
                  How a walk works
                </a>
              </div>
            </div>

            <figure className="m-0">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--r-panel)]">
                <Image
                  src={DAY_ARC.theStart}
                  alt="Two walkers with packs on a trail heading toward a mountain range."
                  fill
                  priority
                  sizes="(min-width: 1024px) 400px, 92vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover"
                />
              </div>
              {/* The caption claims nothing about where this photograph was
                  taken, because it is stock and this is a page about not
                  overstating things. What it says instead is true of every
                  walk on the board. */}
              <figcaption className="mt-3.5 font-body text-[12.5px] leading-relaxed text-paper/45">
                Two on the same trail. Everything here starts with somebody deciding not to go on
                their own — almost always within three hours of Dehradun.
              </figcaption>
            </figure>
          </div>

          {/* The counts, as they actually are. A young board that says so is
              more believable than one that says "join thousands". */}
          <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-7 border-t border-paper/15 pt-8 sm:grid-cols-4">
            <Datum
              k={openCount === 1 ? 'walk on the board' : 'walks on the board'}
              v={openCount}
              tone="dark"
            />
            <Datum k="leaving this weekend" v={weekendCount} tone="dark" />
            <Datum k={peopleCount === 1 ? 'member' : 'members'} v={peopleCount} tone="dark" />
            <Datum k="kinds of outing" v={ACTIVITIES.length} tone="dark" />
          </dl>
        </div>
      </section>

      {/* ── 2 · What it is not ───────────────────────────────────────────── */}
      <section className="trek-band border-b border-rule bg-paper py-16 md:py-20">
        <div className="trek-measure grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <p className="trek-label text-forest">What this is</p>
            <ul className="mt-5 space-y-4">
              {[
                'A noticeboard between members of one shop, for outings around Dehradun.',
                'A way to see who is going, when they leave, and what the day involves — before you commit to it.',
                'A record of what actually happened, built from completed walks and from people vouching for each other afterwards.',
                'A set of rules enforced in the database, listed in full further down this page.',
              ].map((t) => (
                <li key={t} className="flex gap-3.5">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-forest"
                  />
                  <span className="font-body text-[15px] leading-relaxed text-text">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="trek-label text-clay-deep">What it is not</p>
            <ul className="mt-5 space-y-4">
              {[
                'Not a tour operator. Nobody from DEWDROPZ organises, leads or supervises any of this.',
                'Not a booking platform. There is no seat to buy, and the company holds no money.',
                'Not an identity check. A verified phone proves somebody holds that SIM — not their name, their age, or that they are who the profile says.',
                'Not a messaging app. There is no direct message outside a walk, on purpose: plans made on a walk’s own page stay reviewable.',
              ].map((t) => (
                <li key={t} className="flex gap-3.5">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-clay"
                  />
                  <span className="font-body text-[15px] leading-relaxed text-text">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 3 · Who it is for ────────────────────────────────────────────── */}
      <section className="trek-band bg-paper py-20 md:py-24">
        <div className="trek-measure">
          <p className="trek-eyebrow text-forest">Who this is for</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-text">
            Four people arrive at this page with four different fears. Here is what the platform
            does about each one.
          </h2>

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            {PATHWAYS.map((p) => (
              <article
                key={p.key}
                className="trek-card flex flex-col p-6 md:p-8"
              >
                <h3 className="trek-h3 text-text">{p.who}</h3>
                <p className="mt-3 border-l-2 border-rule-warm pl-4 font-body text-[14px] italic leading-relaxed text-mid">
                  {p.worry}
                </p>
                <ul className="mt-6 space-y-3.5 border-t border-rule-soft pt-5">
                  {p.provisions.map((t) => (
                    <li key={t} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-sage"
                      />
                      <span className="font-body text-[14px] leading-relaxed text-mid">{t}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4 · How a walk works ─────────────────────────────────────────── */}
      <section
        id="how"
        className="trek-band scroll-mt-20 border-y border-rule-warm bg-paper-warm py-20 md:py-24"
      >
        <div className="trek-measure">
          <p className="trek-eyebrow text-forest">End to end</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-text">
            One walk, from the moment you see it to the moment you vouch for the people you did it
            with.
          </h2>

          <div className="mt-12 rounded-[var(--r-panel)] border border-rule bg-surface p-6 md:p-9">
            <JourneyRail stage="vouched" showNotes />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [
                'You ask; you are not added',
                'Every walk is a person deciding who they will spend a day with, and that decision is the only vetting a board like this can honestly offer. Declining is silent — nobody owes anybody a reason.',
              ],
              [
                'The address arrives last',
                'The exact meeting point is withheld from the public page and released to confirmed walkers only, once the walk reaches its minimum party. A walk nobody joins hands its address to nobody.',
              ],
              [
                'And then it is written down',
                'After the day, the group adds photographs and vouches for each other. A vouch can only be written by somebody who was confirmed on a walk that has already happened — which is what stops two accounts vouching each other into credibility.',
              ],
            ].map(([t, d]) => (
              <div key={t} className="border-t-2 border-forest pt-5">
                <h3 className="trek-h3 text-text">{t}</h3>
                <p className="mt-2.5 font-body text-[14px] leading-relaxed text-mid">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5 · Enforced, and where it stops ─────────────────────────────── */}
      <section className="trek-band bg-paper py-20 md:py-24">
        <div className="trek-measure">
          <p className="trek-eyebrow text-forest">The safety model, in full</p>
          <h2 className="trek-h2 mt-4 max-w-3xl text-text">
            Six rules the database enforces, and four places where that enforcement stops. Both
            halves are here, in the same type, because only one of them is reassuring and you need
            the other one more.
          </h2>

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--r-panel)] border border-forest/20 bg-sage-soft/50 p-6 md:p-8">
              <p className="trek-label text-forest">Enforced, not promised</p>
              <p className="mt-2 font-body text-[13px] leading-relaxed text-mid">
                Every line here describes a rule that runs in Postgres. Nothing aspirational is on
                this list.
              </p>
              <ul className="mt-6 space-y-5">
                {BOARD_CHECKS.map((c) => (
                  <li key={c.title} className="border-t border-forest/12 pt-4 first:border-0 first:pt-0">
                    <p className="font-body text-[15px] font-medium leading-snug text-text">
                      {c.title}
                    </p>
                    <p className="mt-1.5 font-body text-[13.5px] leading-relaxed text-mid">
                      {c.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[var(--r-panel)] border border-clay/25 bg-clay-wash/60 p-6 md:p-8">
              <p className="trek-label text-clay-deep">And where it stops</p>
              <p className="mt-2 font-body text-[13px] leading-relaxed text-mid">
                This is not small print. Somebody deciding whether to rely on a badge needs to know
                exactly how far it reaches.
              </p>
              <ul className="mt-6 space-y-5">
                {BOARD_LIMITS.map((c) => (
                  <li key={c.title} className="border-t border-clay/20 pt-4 first:border-0 first:pt-0">
                    <p className="font-body text-[15px] font-medium leading-snug text-text">
                      {c.title}
                    </p>
                    <p className="mt-1.5 font-body text-[13.5px] leading-relaxed text-mid">
                      {c.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6 · How a record is built ────────────────────────────────────── */}
      <section className="trek-band bg-ink py-20 md:py-24">
        <div className="trek-measure">
          <p className="trek-eyebrow text-sage">Reputation</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-paper">Counted, never claimed.</h2>
          <p className="mt-5 max-w-2xl font-body text-[15px] leading-[1.7] text-paper/65">
            There are no stars here and no green ticks. What a profile carries is a count of things
            that happened: walks completed, walks hosted, and vouches written by people who were
            confirmed alongside you on a walk that has already taken place. None of it can be typed
            in. It is also, deliberately, a narrow claim — it says somebody turned up and behaved
            well enough that another walker would say so. It does not say they are experienced, or
            fit, or safe.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'A completed walk', 'Recorded when the day has passed and the host confirmed you were on it. This is the only unit the whole system is built from.'],
              ['02', 'A vouch', 'Written afterwards, by one confirmed walker about another. It cannot be written before the walk, and it cannot be written by somebody who was not there.'],
              ['03', 'A rung', 'What those two add up to. A host can require a rung before anybody may ask to join — so a reputation is not a badge, it is access.'],
            ].map(([n, t, d]) => (
              <div
                key={n}
                className="rounded-[var(--r-card)] border border-paper/12 bg-paper/[0.03] p-6"
              >
                <span className="font-mono text-[12px] text-sage tabular-nums">{n}</span>
                <h3 className="trek-h3 mt-3 text-paper">{t}</h3>
                <p className="mt-2.5 font-body text-[13.5px] leading-relaxed text-paper/60">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7 · Kinds of outing ──────────────────────────────────────────── */}
      <section className="trek-band bg-paper py-20 md:py-24">
        <div className="trek-measure">
          <p className="trek-eyebrow text-forest">What gets posted</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-text">
            Six kinds of outing, each with its own hours and its own rules.
          </h2>
          <p className="mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-mid">
            These are not categories on a form. The permitted departure window, the minimum number
            of people before the meeting point is released, and whether the host has to write down
            how everyone gets back in the dark are all different per kind — and all of them are
            checked when the walk is posted.
          </p>

          <div className="mt-12 overflow-hidden rounded-[var(--r-panel)] border border-rule bg-surface">
            <div className="hidden grid-cols-[1.6fr_1fr_1fr_0.8fr_1.4fr] gap-4 border-b border-rule bg-paper-warm/60 px-6 py-3.5 md:grid">
              {['Outing', 'Departs between', 'Usually', 'Live now', 'The rule it carries'].map((h) => (
                <span key={h} className="trek-label-xs text-mid">
                  {h}
                </span>
              ))}
            </div>

            <ul>
              {ACTIVITIES.map((a) => {
                const light = lightForTime(a.defaultStart)
                const n = activityCounts[a.key] ?? 0
                return (
                  <li
                    key={a.key}
                    className="grid gap-2 border-b border-rule-soft px-6 py-5 last:border-0 md:grid-cols-[1.6fr_1fr_1fr_0.8fr_1.4fr] md:items-center md:gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: dotColor(light, 'light') }}
                      />
                      <span>
                        <span className="block font-body text-[15px] font-medium text-text">
                          {a.label}
                        </span>
                        <span className="block font-body text-[13px] text-mid">{a.blurb}</span>
                      </span>
                    </div>

                    <span className="font-mono text-[13px] text-text tabular-nums">
                      {a.startMin}–{a.startMax}
                    </span>

                    <span className="font-mono text-[13px] text-mid tabular-nums">
                      {a.defaultStart} → {a.defaultBackBy}
                      {a.endsNextDay && <span className="ml-1 text-light">+1</span>}
                    </span>

                    <span
                      className={`font-mono text-[13px] tabular-nums ${
                        n > 0 ? 'text-forest' : 'text-light'
                      }`}
                    >
                      {n}
                    </span>

                    <span className="font-body text-[13px] leading-relaxed text-mid">
                      {DAY_PART_LABEL[a.dayPart]} · {a.minParty} people before the point is
                      released
                      {a.needsNightNote && ' · the host must say how everyone gets back in the dark'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 8 · Before you go ────────────────────────────────────────────── */}
      <section className="trek-band border-y border-rule-warm bg-paper-warm py-20 md:py-24">
        <div className="trek-measure">
          <p className="trek-eyebrow text-forest">Before you go</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-text">
            Six things that are your job, not the platform’s.
          </h2>

          <ol className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {SAFETY_NOTES.map((n, i) => (
              <li key={n.title} className="border-t border-rule-warm pt-5">
                <span className="font-mono text-[12px] text-forest tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="trek-h3 mt-2.5 text-text">{n.title}</h3>
                <p className="mt-2 font-body text-[13.5px] leading-relaxed text-mid">{n.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 9 · Questions ───────────────────────────────────────────────── */}
      <section className="trek-band bg-paper py-20 md:py-24">
        <div className="trek-measure grid gap-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="trek-eyebrow text-forest">Questions</p>
            <h2 className="trek-h2 mt-4 text-text">
              The ones people actually ask, answered without hedging.
            </h2>
          </div>

          <div className="border-t border-rule">
            {QUESTIONS.map((item) => (
              <details key={item.q} className="group border-b border-rule">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-body text-[16px] font-medium text-text transition-colors hover:text-forest [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-rule text-mid transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 font-body text-[14.5px] leading-[1.7] text-mid">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10 · The act ─────────────────────────────────────────────────── */}
      <section className="trek-band bg-ink py-20 md:py-24">
        <div className="trek-measure flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="trek-h2 max-w-xl text-paper">
              {openCount === 0
                ? 'The board is empty today. The first walk on it is the one that makes it a board.'
                : `${openCount} walk${openCount === 1 ? ' is' : 's are'} on the board right now.`}
            </h2>
            <p className="mt-4 max-w-lg font-body text-[15px] leading-relaxed text-paper/60">
              You need an account to see who is going where — walks are visible to signed-in
              members only, and that is the reason this page is not a list.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/login?redirect=/trek-buddy"
              className="trek-pill trek-pill-lg trek-pill-actinv font-body"
            >
              Create an account
            </Link>
            <Link href="/treks" className="trek-pill trek-pill-lg trek-pill-onink font-body">
              Read the trail guide
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
