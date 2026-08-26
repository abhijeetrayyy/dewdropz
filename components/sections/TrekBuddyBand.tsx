import Link from 'next/link'
import Image from 'next/image'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'
import { getTrekKinds } from '@/actions/trekBuddy'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { TrekKind } from '@/actions/trekBuddy'

/**
 * Trek Buddy, on the homepage.
 *
 * The hero's third act carries it as an image; this carries it as a thing you
 * can understand and join. They are not the same job — the act says "there is
 * something here", and by the time somebody has scrolled this far they want to
 * know what it actually is before clicking into a place full of strangers.
 *
 * WHAT THIS SECTION LEADS WITH, AND WHY
 *
 * Not "meet people who love the outdoors", which is what every board of this
 * kind says and none of them mean. The only thing that distinguishes this one
 * is the safety model, and it is genuinely unusual: the exact meeting point is
 * withheld until enough people are confirmed, the host chooses who comes, and
 * the board refuses phone numbers in free text. Somebody deciding whether to
 * spend a Saturday with strangers is deciding on exactly that, so it goes
 * first and the "community" language does not appear at all.
 *
 * Counts are read live and the copy adapts, because a section announcing
 * "3 walks this week" on an empty board is the fastest way to lose the trust
 * the rest of it is trying to earn.
 */
export default async function TrekBuddyBand() {
  // Service key, not the anon key. This is a server component, so the key never
  // reaches the browser — and as of migration 063 `anon` can no longer read
  // profiles at all, because that read was returning every customer's email and
  // date of birth to anyone who asked.
  const db = createAdminSupabaseClient()

  const [{ count: openWalks }, { count: members }, kinds] = await Promise.all([
    db
      .from('trek_plans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .is('hidden_at', null)
      .gt('starts_at', new Date().toISOString()),
    db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('trek_display_name', 'is', null)
      .not('trek_terms_at', 'is', null)
      .is('trek_suspended_at', null),
    getTrekKinds(),
  ])

  const walks = openWalks ?? 0
  const people = members ?? 0

  // The three rules, each stated as what it stops rather than what it is.
  const RULES = [
    {
      k: 'The meeting point waits',
      v: 'The exact spot is not on the board. It reaches confirmed walkers only once enough people are going — so a walk nobody joins never hands out an address.',
    },
    {
      k: 'The host picks the group',
      v: 'You ask to come; you are not added. Every walk is somebody deciding who they are spending the day with, which is the only vetting a board like this can honestly offer.',
    },
    {
      k: 'No numbers, no handles',
      v: 'Phone numbers, emails and handles are refused in every free-text field on the board. Everything is arranged on the walk’s own page, and that is what keeps it there.',
    },
  ]

  return (
    <section className="on-dark relative overflow-hidden bg-ink">
      <Image
        src={DAY_ARC.theStart}
        alt=""
        fill
        sizes="100vw"
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        className="object-cover object-center opacity-45"
      />
      {/* Shaped to the content, the same lesson as the Trek Buddy header: a
          scrim that is lightest where the type sits is not a scrim. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(12,16,13,0.86) 0%, rgba(12,16,13,0.72) 40%, rgba(12,16,13,0.88) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(12,16,13,0.80) 0%, rgba(12,16,13,0.40) 55%, rgba(12,16,13,0.10) 100%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-sage">
              Trek Buddy · Dehradun and around
            </p>

            <h2 className="mt-5 max-w-xl font-display text-[clamp(30px,4.4vw,52px)] font-light leading-[1.02] text-paper">
              {/* NOT "Never go alone." — that is the hero's third act, a few
                  thousand pixels up the same page, and a page that lands the
                  same headline twice reads as a page that lost its place. */}
              The hills are better with <span className="italic text-sage">someone else.</span>
            </h2>

            {/* THE CORE CONCEPT, in the brief's own words — and a wider
                product than the line that used to sit here. Not "a board for
                finding people to walk with" but a place where four different
                kinds of people put an outdoor experience up and find whoever
                wants to come. Ten kinds of outing, not one.

                Deliberately NOT the brief's "Planning a trek, camping trip,
                stargazing session…" paragraph: that is the hero's third act
                and this is the same page. Saying it twice would make the
                second one read as a page that lost its place — the same
                reason the headline above is not "Never go alone." either. */}
            <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-paper/75">
              Individuals, hosts, adventure companies and communities create outdoor
              experiences here — and connect with the people who want to be on them.
              Share your plan, and you choose who joins the journey.
            </p>

            {/* The three rules, as a ruled list. This is the part that decides
                whether somebody joins, so it gets the room. */}
            <dl className="mt-10 divide-y divide-paper/12 border-t border-paper/20">
              {RULES.map((r) => (
                <div key={r.k} className="py-5 sm:flex sm:gap-8">
                  <dt className="font-body text-sm text-paper sm:w-52 sm:shrink-0">{r.k}</dt>
                  <dd className="mt-1.5 font-body text-sm leading-relaxed text-paper/70 sm:mt-0">
                    {r.v}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href="/trek-buddy"
                className="inline-flex items-center gap-2 rounded-full bg-paper px-7 py-3.5 font-body text-[11px] uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-sage"
              >
                {walks > 0 ? 'See what is on' : 'Look at the board'}{' '}
                <span aria-hidden="true">↗</span>
              </Link>
              <Link
                href="/trek-buddy/people"
                className="border-b border-paper/25 pb-1 font-body text-[11px] uppercase tracking-[0.14em] text-paper/65 transition-colors duration-300 hover:text-paper"
              >
                Who is out there
              </Link>
            </div>
          </div>

          {/* The state of the board, stated plainly. An empty board says so —
              a number invented to look busy is the one thing that would undo
              everything the column beside it just promised. */}
          <aside className="lg:pt-2">
            <div className="rounded-sm border border-paper/20 bg-ink/50 p-6 backdrop-blur-md">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/60">
                Right now
              </p>

              <div className="mt-5 space-y-5">
                <div>
                  <p className="font-mono text-4xl leading-none text-paper tabular-nums">{walks}</p>
                  <p className="mt-1.5 font-body text-xs text-paper/70">
                    {walks === 1 ? 'walk on the board' : 'walks on the board'}
                  </p>
                </div>
                <div className="border-t border-paper/12 pt-4">
                  <p className="font-mono text-4xl leading-none text-paper tabular-nums">{people}</p>
                  <p className="mt-1.5 font-body text-xs text-paper/70">
                    {people === 1 ? 'person has joined' : 'people have joined'}
                  </p>
                </div>
              </div>

              {walks === 0 && (
                <p className="mt-5 border-t border-paper/12 pt-4 font-body text-xs leading-relaxed text-paper/70">
                  Nothing is posted at the moment. Nothing here is invented either — the board
                  stays empty until somebody puts a real walk on it.
                </p>
              )}
            </div>

            {kinds.length > 0 && (
              <div className="mt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/60">
                  {kinds.filter((k: TrekKind) => !k.isOpenEnded).length} kinds of outing
                </p>
                {/* Every kind the board is taking, not the first nine of them.
                    The brief names ten and migration 092 makes the board carry
                    exactly those ten, so a `.slice(0, 9)` here would have
                    dropped one of the ten off the end of the list — and the
                    count above it was already reporting `kinds.length`, which
                    includes the open-ended "Something else" the list itself
                    filters out. Two numbers, one of them wrong. */}
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {kinds
                    .filter((k: TrekKind) => !k.isOpenEnded)
                    .map((k: TrekKind) => (
                      <li
                        key={k.key}
                        className="rounded-full border border-paper/20 px-2.5 py-1 font-body text-[11px] text-paper/75"
                      >
                        {k.label}
                      </li>
                    ))}
                  <li className="self-center font-mono text-[10px] text-paper/60">
                    + name your own
                  </li>
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  )
}
