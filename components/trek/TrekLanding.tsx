import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'
import {
  ACTIVITIES, BOARD_CHECKS, BOARD_LIMITS, SAFETY_NOTES,
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

const PATHWAYS: { who: string; line: string; proof: string }[] = [
  {
    who: 'Never done this before',
    line: 'Every walk states its distance, its climb and how hard it is before you ask.',
    proof: 'No walk may be vague about it',
  },
  {
    who: 'A woman weighing it up',
    line: 'Women-only walks are enforced in the database, and the meeting point is never public.',
    proof: 'Checked on write, not on render',
  },
  {
    who: 'Older, or your own pace',
    line: 'Senior-friendly is a filter, and pace is stated in words rather than numbers.',
    proof: 'You can turn back at any point',
  },
  {
    who: 'Years of this already',
    line: 'Every figure is counted from walks that happened. None of it can be typed in.',
    proof: 'Hosts get a real console',
  },
]

const QUESTIONS: { q: string; a: string }[] = [
  {
    q: 'Does it cost anything?',
    a: 'No. Nobody pays for a place and DEWDROPZ takes no cut. Some walks split real costs at face value — fuel, a permit, a shared cab — and the amount is on the card before you ask. The platform holds no money.',
  },
  {
    q: 'Who is checking that these people are who they say they are?',
    a: 'Nobody. The platform verifies actions, never identities — that a number is held, that a walk was completed, that a vouch came from somebody who was there. It cannot verify a name, an age, or fitness. Everyone here is a stranger until you have walked together.',
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

      {/* ── 3 · Who it is for ────────────────────────────────────────────
          Four people, one line each. This was four cards carrying five long
          bullets apiece — around 400 words to say something a reader decides
          about in three seconds ("is one of these me?"). The full provision
          for each of them is on the walk itself, where it is load-bearing;
          here it only has to be recognisable. */}
      <section className="trek-band bg-paper py-16 md:py-20">
        <div className="trek-measure">
          <p className="trek-eyebrow text-ember">Who this is for</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-text">
            Four people arrive with four different worries.
          </h2>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PATHWAYS.map((p) => (
              <li key={p.who} className="trek-card flex flex-col p-5">
                <h3 className="trek-h3 text-text">{p.who}</h3>
                <p className="mt-2.5 flex-1 font-body text-[13.5px] leading-relaxed text-mid">
                  {p.line}
                </p>
                <p className="mt-4 flex items-center gap-2 border-t border-rule-soft pt-3 font-body text-[12px] text-forest">
                  <span aria-hidden="true">✓</span>
                  {p.proof}
                </p>
              </li>
            ))}
          </ul>
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

      {/* ── 5 · Enforced, and where it stops ─────────────────────────────
          The most important block on the page, and the one that was hardest to
          read: ten titles each followed by a forty-word paragraph, twenty of
          them across two columns, all at the same weight. A reader scanning it
          learned nothing, and a reader actually reading it gave up.

          The TITLES carry the argument now — six things the database enforces,
          four places it stops — and every body is still here, one tap under a
          disclosure, because the limits are the half somebody relying on a
          badge genuinely needs. Nothing was deleted; it stopped being the
          first read. */}
      <section className="trek-band bg-paper py-16 md:py-20">
        <div className="trek-measure">
          <p className="trek-eyebrow text-ember">The safety model</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-text">
            Six rules the database enforces. Four places it stops.
          </h2>
          <p className="mt-4 max-w-xl font-body text-[15px] leading-relaxed text-mid">
            Both halves get the same width and the same weight — only one of them is reassuring,
            and you need the other one more.
          </p>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {[
              { tone: 'sage' as const, key: 'Enforced', items: BOARD_CHECKS },
              { tone: 'clay' as const, key: 'Where it stops', items: BOARD_LIMITS },
            ].map(({ tone, key, items }) => {
              const sage = tone === 'sage'
              return (
                <div
                  key={key}
                  className={`rounded-[var(--r-panel)] border p-6 md:p-7 ${
                    sage
                      ? 'border-forest/20 bg-sage-soft/50'
                      : 'border-clay/25 bg-clay-wash/60'
                  }`}
                >
                  <div className="flex items-baseline gap-3">
                    <p className={`trek-label ${sage ? 'text-forest' : 'text-clay-deep'}`}>{key}</p>
                    <span
                      aria-hidden="true"
                      className={`h-px flex-1 ${sage ? 'bg-forest/20' : 'bg-clay/25'}`}
                    />
                    <span
                      className={`font-mono text-[13px] tabular-nums ${
                        sage ? 'text-forest/70' : 'text-clay-deep/70'
                      }`}
                    >
                      {items.length}
                    </span>
                  </div>

                  <ul className="mt-5 space-y-0">
                    {items.map((it) => (
                      <li
                        key={it.title}
                        className={`border-t py-3 first:border-0 first:pt-0 ${
                          sage ? 'border-forest/12' : 'border-clay/20'
                        }`}
                      >
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-start gap-3 font-body text-[15px] leading-snug text-text [&::-webkit-details-marker]:hidden">
                            <span
                              aria-hidden="true"
                              className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                                sage ? 'bg-forest' : 'bg-clay'
                              }`}
                            />
                            <span className="flex-1">{it.title}</span>
                            <span
                              aria-hidden="true"
                              className="mt-0.5 shrink-0 text-mid transition-transform duration-200 group-open:rotate-45"
                            >
                              +
                            </span>
                          </summary>
                          <p className="mt-2 pl-[18px] font-body text-[13.5px] leading-relaxed text-mid">
                            {it.body}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 6 · Reputation, and the things that are your job ────────────
          Two sections became one band. "How a record is built" was three cards
          of paragraphs saying what three words say; the six take-care notes
          were 240 words of advice on a page whose reader has not joined yet.
          The notes are kept in full, one tap away, and they appear again in
          the places they are actually load-bearing — the walk, and the
          onboarding. */}
      <section className="trek-band bg-ink py-16 md:py-20">
        <div className="trek-measure grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="trek-eyebrow text-sage">Reputation</p>
            <h2 className="trek-h2 mt-4 text-paper">Counted, never claimed.</h2>
            <p className="mt-4 max-w-md font-body text-[15px] leading-relaxed text-paper/65">
              No stars and no green ticks. Three things add up, and none of them can be typed in.
            </p>

            <ol className="mt-8 space-y-0">
              {[
                ['A completed walk', 'the host confirmed you were on it'],
                ['A vouch', 'written afterwards, by somebody who was there'],
                ['A rung', 'what those add up to — and a host can require one'],
              ].map(([t, d], i) => (
                <li
                  key={t}
                  className="flex items-baseline gap-4 border-t border-paper/12 py-3.5 first:border-0 first:pt-0"
                >
                  <span className="font-mono text-[12px] text-sage tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-body text-[15px] text-paper">{t}</span>
                  <span className="ml-auto text-right font-body text-[13px] text-paper/55">{d}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:pt-2">
            <p className="trek-eyebrow text-sage">Before you go</p>
            <h2 className="trek-h2 mt-4 text-paper">Six things that are your job, not ours.</h2>

            <ul className="mt-8 space-y-0">
              {SAFETY_NOTES.map((n, i) => (
                <li key={n.title} className="border-t border-paper/12 py-3 first:border-0 first:pt-0">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-baseline gap-4 font-body text-[15px] text-paper [&::-webkit-details-marker]:hidden">
                      <span className="font-mono text-[12px] text-paper/40 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1">{n.title}</span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-paper/40 transition-transform duration-200 group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-2 pl-8 font-body text-[13.5px] leading-relaxed text-paper/60">
                      {n.body}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 7 · What gets posted ─────────────────────────────────────────
          The six kinds, as a strip rather than the five-column table this was.
          The table stated the permitted departure window, the usual hours, the
          live count, the day part and the minimum party for each — accurate,
          and far more than anybody needs before joining. What survives is the
          part that is visual: the kind, the hour it usually leaves at in that
          hour's own colour, and whether anything is on right now. */}
      <section className="trek-band border-y border-rule-warm bg-paper-warm py-14 md:py-16">
        <div className="trek-measure">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="trek-eyebrow text-ember">What gets posted</p>
              <h2 className="trek-h2 mt-4 max-w-xl text-text">
                Six kinds of outing, each with its own hours.
              </h2>
            </div>
            <p className="max-w-xs font-body text-[13.5px] leading-relaxed text-mid">
              Every walk carries the colour of the hour it leaves at, so a board reads as a day
              passing.
            </p>
          </div>

          <ul className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVITIES.map((a) => {
              const light = lightForTime(a.defaultStart)
              const n = activityCounts[a.key] ?? 0
              return (
                <li
                  key={a.key}
                  className="flex items-center gap-3.5 rounded-[var(--r-card)] border border-rule bg-surface px-4 py-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: dotColor(light, 'light') }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-body text-[14.5px] font-medium text-text">
                      {a.label}
                    </span>
                    <span className="block font-body text-[12.5px] text-mid">{a.blurb}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[13px] text-text tabular-nums">
                      {a.defaultStart}
                    </span>
                    <span
                      className={`block font-mono text-[11px] tabular-nums ${
                        n > 0 ? 'text-forest' : 'text-light'
                      }`}
                    >
                      {n} on
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
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
