import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'
import { ACTIVITIES, dotColor, lightForTime } from '@/lib/trek'
import JourneyRail from './ui/JourneyRail'
import { Datum } from './ui/Bits'

// The first page.
//
// The people this has to convince are somebody who has never walked further
// than a park and does not know whether they would be the slowest; a woman
// working out whether a 4am shared cab with five strangers is a thing she can
// do; somebody in their sixties who has been told "moderate" before and been
// left behind; and somebody with twenty years of expeditions who wants to know
// within about four seconds whether this is serious.
//
// WHAT THIS PAGE USED TO BE, AND WHY IT CHANGED.
//
// All four of those people are asking CAN I TRUST THIS, so the page answered
// them: what it is, what it is NOT, who it is for, how a walk works, six rules
// the database enforces, four places it stops, how a reputation is built, six
// things that are your job and not ours, and the questions people actually ask.
//
// Every one of those was true, well written, and load-bearing. Together they
// came to roughly 2,400 words; 36% of the sentences carried a negation; and
// four of the nine sections were framed by what the product is not or cannot
// do. The last thing a reader met before the sign-up button was where
// enforcement stops. The first word of the answer to "who is checking these
// people" was "Nobody."
//
// That is a risk disclosure standing where the reason should be. Somebody
// deciding whether to try a new thing has to want it before they can weigh it,
// and this page skipped straight to the weighing.
//
// NOTHING WAS DELETED. Every removed sentence is at /trek-buddy/safety, whole,
// in its original words, linked from here, from onboarding and from every walk
// — and that page is the only thing under /trek-buddy a search engine is
// allowed to read, which is a better position than being the fifth section of a
// page nobody finished. The honesty is this product's best asset. It was
// mispriced, not wrong.
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

export default function TrekLanding({
  openCount,
  weekendCount,
  peopleCount,
  completedCount,
  activityCounts,
}: {
  openCount: number
  weekendCount: number
  peopleCount: number
  /** Walks whose day has been and gone. The only evidence this page may offer. */
  completedCount: number
  activityCounts: Record<string, number>
}) {
  return (
    <>
      {/* ── 1 · What this is ─────────────────────────────────────────────── */}
      {/* The hero is TYPE, and the photograph is a framed panel beside it at
          full clarity with a caption — which is how a serious publication uses
          an image, and which lets it actually be looked at. */}
      <section className="trek-band bg-ink pb-16 pt-32 md:pb-20 md:pt-40">
        <div className="trek-measure">
          <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-16">
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
                host decides who joins them. Nobody pays for a place.
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
                  overstating things. */}
              <figcaption className="mt-3.5 font-body text-[12.5px] leading-relaxed text-paper/55">
                Two on the same trail. Everything here starts with somebody deciding not to go on
                their own — almost always within three hours of Dehradun.
              </figcaption>
            </figure>
          </div>

          {/* The counts, as they actually are. A young board that says so is
              more believable than one that says "join thousands".

              `completed` is the one piece of EVIDENCE this page is allowed to
              carry, and it is here because everything else on the page is a
              promise about the future. Anything richer — a recap, its
              photographs, who was on it — belongs to the people who were there;
              a share token is one person saying "I sent this to a friend", not
              consent to appear on a front page. A count is a counted fact. */}
          <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-7 border-t border-paper/15 pt-8 sm:grid-cols-4">
            <Datum
              k={openCount === 1 ? 'walk on the board' : 'walks on the board'}
              v={openCount}
              tone="dark"
            />
            <Datum k="leaving this weekend" v={weekendCount} tone="dark" />
            <Datum k={peopleCount === 1 ? 'member' : 'members'} v={peopleCount} tone="dark" />
            <Datum
              k={completedCount === 1 ? 'walk already happened' : 'walks already happened'}
              v={completedCount}
              tone="dark"
            />
          </dl>
        </div>
      </section>

      {/* ── 2 · Who it is for ────────────────────────────────────────────── */}
      <section className="trek-band bg-paper py-16 md:py-20">
        <div className="trek-measure">
          <p className="trek-eyebrow text-ember">Who this is for</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-text">
            Four people arrive with four different worries.
          </h2>

          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ── 3 · How a walk works ─────────────────────────────────────────── */}
      {/* The rail carries the sequence and its own notes, so the three
          paragraphs that used to sit under it are gone: they spent 120 words
          explaining what five labelled nodes already show. */}
      <section
        id="how"
        className="trek-band scroll-mt-20 border-y border-rule-warm bg-paper-warm py-16 md:py-20"
      >
        <div className="trek-measure">
          <p className="trek-eyebrow text-forest">End to end</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-text">
            One walk, from the moment you see it to the moment you vouch for the people you did it
            with.
          </h2>

          <div className="mt-10 rounded-[var(--r-panel)] border border-rule bg-surface p-6 md:p-9">
            <JourneyRail stage="vouched" showNotes />
          </div>

          <p className="mt-6 max-w-2xl font-body text-[14.5px] leading-relaxed text-mid">
            You ask; you are not added. The exact meeting point reaches confirmed walkers only,
            once enough people are going. Afterwards the group vouches for each other, which is the
            only way a record here is ever written.
          </p>
        </div>
      </section>

      {/* ── 4 · Reputation ───────────────────────────────────────────────── */}
      {/* Kept, and kept short. This is the product's best idea and the one
          section on the page that argues FOR it rather than qualifying it. */}
      <section className="trek-band bg-ink py-14 md:py-16">
        <div className="trek-measure grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="trek-eyebrow text-sage">Reputation</p>
            <h2 className="trek-h2 mt-4 text-paper">Counted, never claimed.</h2>
            <p className="mt-4 font-body text-[15px] leading-relaxed text-paper/70">
              No stars and no green ticks. Three things add up, and none of them can be typed in.
            </p>
          </div>

          <ol className="lg:pt-2">
            {[
              ['A completed walk', 'the host confirmed you were on it'],
              ['A vouch', 'written afterwards, by somebody who was there'],
              ['A rung', 'what those add up to — and a host can require one'],
            ].map(([t, d], i) => (
              <li
                key={t}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-paper/12 py-3.5 first:border-0 first:pt-0"
              >
                <span className="font-mono text-[12px] text-sage tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-body text-[15px] text-paper">{t}</span>
                <span className="ml-auto font-body text-[13px] text-paper/60">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 5 · What gets posted ─────────────────────────────────────────── */}
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

          <ul className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ── 6 · The honest half, in one block and one link ───────────────── */}
      {/* What is left of two full sections and a six-question FAQ. It is
          deliberately not softened, and deliberately not the ninth thing you
          read: somebody who wants to know exactly what is enforced and exactly
          where it stops is one tap from all of it, unabridged. */}
      <section className="trek-band bg-paper py-16 md:py-20">
        <div className="trek-measure max-w-3xl">
          <p className="trek-eyebrow text-clay-deep">Before you decide</p>
          <h2 className="trek-h2 mt-4 text-text">Nobody here has been checked by anybody.</h2>
          <p className="mt-5 font-body text-[16px] leading-[1.75] text-text">
            DEWDROPZ does not organise, lead, vet or supervise these walks, and it cannot verify a
            name, an age or anybody’s fitness. What it does verify is actions: that a phone number
            is held, that a walk was completed, that a vouch came from somebody who was there. Six
            rules are enforced in the database, and there are four places that enforcement stops.
            All of it is written out in full — both halves, same width, same weight.
          </p>
          <Link
            href="/trek-buddy/safety"
            className="trek-pill trek-pill-lg trek-pill-act mt-7 font-body"
          >
            Read what is enforced, and where it stops
          </Link>
        </div>
      </section>

      {/* ── 7 · The act ──────────────────────────────────────────────────── */}
      <section className="trek-band bg-ink py-16 md:py-20">
        <div className="trek-measure flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="trek-h2 max-w-xl text-paper">
              {openCount === 0
                ? 'The board is empty today. The first walk on it is the one that makes it a board.'
                : `${openCount} walk${openCount === 1 ? ' is' : 's are'} on the board right now.`}
            </h2>
            <p className="mt-4 max-w-lg font-body text-[15px] leading-relaxed text-paper/65">
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
