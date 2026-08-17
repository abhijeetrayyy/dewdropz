import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekHero from '@/components/trek/TrekHero'
import TrekGate from '@/components/trek/TrekGate'
import { getTrekBoard, getTrekMembership, getOpenPlanCount, getMyTreks, getMyTrekCard } from '@/actions/trekBuddy'
import TrekPlanCard from '@/components/trek/TrekPlanCard'
import QuickStart from '@/components/trek/QuickStart'
import BoardFilters from '@/components/trek/BoardFilters'
import SafetyNotes from '@/components/trek/SafetyNotes'
import { ACTIVITIES } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'Trek Buddy — DEWDROPZ',
  description: 'Post a day walk near Dehradun and find people to go with. Members only.',
  // Who is going where, and when, is not something to hand a crawler.
  robots: { index: false, follow: false },
}

// The board.
//
// Signed out, this is a pitch and one integer. Signed in without onboarding, it
// is a door to the four questions. Only an onboarded adult member sees an actual
// list of walks — there is no anonymous read policy on any Trek Buddy table, so
// that is enforced in the database rather than by this component choosing not
// to render.
export default async function TrekBuddyPage({
  searchParams,
}: {
  searchParams: Promise<{
    activity?: string; when?: string; q?: string
    difficulty?: string; language?: string
    womenOnly?: string; senior?: string; spots?: string
  }>
}) {
  const sp = await searchParams
  const membership = await getTrekMembership()

  if (!membership.signedIn) {
    const open = await getOpenPlanCount()
    return (
      <>
        <NavBar />
        <main>
          <TrekGate
            eyebrow="Trek Buddy · Dehradun and around"
            title={<>Never go <span className="italic text-sage">alone.</span></>}
            lede="Members post the hour they are going, and other members ask to come. Not a booking platform, and nobody pays for a place."
          />
          <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
            <div className="mx-auto max-w-2xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest">
                {open === 0
                  ? 'Nothing on the board yet'
                  : `${open} walk${open === 1 ? '' : 's'} on the board`}
              </p>
              <h2 className="mt-3 font-display text-[clamp(22px,3.2vw,32px)] leading-tight text-text">
                You need an account to see who is going where.
              </h2>
              <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-mid">
                Walks are visible to signed-in members only, and the exact meeting point is shown
                to nobody but the people the host has confirmed. That is deliberate, and it is the
                reason this page is not a list.
              </p>

              {/* What they are signing in TO. Three lines, so the decision is
                  informed rather than a leap. */}
              <ol className="mt-8 space-y-4 border-t border-rule pt-6">
                {[
                  ['Find one', 'Browse walks near Dehradun by day, by hour and by activity.'],
                  ['Ask to come', 'The host confirms or declines. Nobody joins automatically.'],
                  ['Meet the group', 'The exact spot arrives once enough people are going.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="mt-0.5 font-mono text-[10px] text-mid tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>
                      <span className="block font-body text-sm text-text">{t}</span>
                      <span className="block font-body text-xs text-mid">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/auth/login?redirect=/trek-buddy"
                  className="rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid"
                >
                  Sign in
                </Link>
                <Link
                  href="/treks"
                  className="self-center border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:text-text"
                >
                  Read the trail guide instead
                </Link>
              </div>
            </div>
          </section>
        </main>
        <FooterSection />
      </>
    )
  }

  // A page whose only content is a button to another page is a wasted click.
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  // The unfiltered board is fetched alongside the filtered one so the chips can
  // carry honest counts — a filter that says "Camping 0" is more useful than a
  // filter that has quietly disappeared.
  const [plans, all, mine, me] = await Promise.all([
    getTrekBoard({
      activity: sp.activity,
      when: sp.when as 'all' | 'week' | 'weekend',
      q: sp.q,
      difficulty: sp.difficulty,
      language: sp.language,
      womenOnly: sp.womenOnly === '1',
      seniorFriendly: sp.senior === '1',
      hasSpots: sp.spots === '1',
    }),
    getTrekBoard(),
    getMyTreks(),
    getMyTrekCard(),
  ])

  const counts: Record<string, number> = { all: all.length }
  for (const a of ACTIVITIES) counts[a.key] = all.filter((p) => p.activity === a.key).length

  const filtering = Boolean(
    sp.activity || sp.q || (sp.when && sp.when !== 'all') ||
    sp.difficulty || sp.language || sp.womenOnly || sp.senior || sp.spots
  )
  const involved = mine.hosting.length + mine.going.length

  return (
    <>
      <NavBar />
      <main>
        <TrekHero counts={counts} openCount={all.length} canHost={membership.canHost} active="board" me={me} />

        <section className="bg-paper px-6 pb-24 pt-10 md:px-10">
          <div className="mx-auto max-w-5xl space-y-10">
            {/* One line, not a panel — what you are already part of belongs at
                the top of the board but must not push the board off the screen. */}
            {involved > 0 && (
              <Link
                href="/trek-buddy/yours"
                className="flex items-center justify-between gap-4 rounded-sm border border-forest/25 bg-forest/[0.04] px-4 py-3 transition-colors hover:border-forest/50"
              >
                <span className="font-body text-sm text-text">
                  You are on {involved} {involved === 1 ? 'walk' : 'walks'}
                  {mine.hosting.length > 0 && (
                    <span className="text-mid"> · hosting {mine.hosting.length}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-forest">
                  See yours →
                </span>
              </Link>
            )}

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                  {plans.length === 0
                    ? filtering ? 'Nothing matches' : 'Nothing on the board'
                    : `${plans.length} coming up`}
                </h2>
                {filtering && (
                  <Link href="/trek-buddy" className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest underline underline-offset-4">
                    Clear filters
                  </Link>
                )}
              </div>

              {plans.length === 0 ? (
                <div className="rounded-sm border border-dashed border-rule px-6 py-16 text-center">
                  <h3 className="font-display text-[clamp(20px,2.6vw,28px)] text-text">
                    {filtering ? 'Nothing matches that yet.' : 'The board is empty.'}
                  </h3>
                  <p className="mx-auto mt-3 max-w-sm font-body text-sm leading-relaxed text-mid">
                    {filtering
                      ? 'Try a wider date range, or clear the filters to see everything.'
                      : 'Nothing here is invented, so it stays empty until someone posts a real walk. If you know where you are going this week, that someone is you.'}
                  </p>
                  {!filtering && membership.canHost && (
                    <Link
                      href="/trek-buddy/new"
                      className="mt-6 inline-block rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid"
                    >
                      Post the first one
                    </Link>
                  )}
                </div>
              ) : (
                <ul className="grid gap-3">
                  {plans.map((p) => (
                    <li key={p.id}>
                      <TrekPlanCard plan={p} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Below the board, not above it: someone who came to browse should
                reach the walks first, and someone who came to post scrolls once. */}
            <QuickStart canHost={membership.canHost} />

            {!membership.canHost && (
              <p className="rounded-sm border border-rule bg-white px-4 py-3 font-body text-sm text-mid">
                Hosting is invite-only while this is new.{' '}
                <Link href="/contact" className="text-forest underline underline-offset-4">
                  Ask us
                </Link>{' '}
                and we will turn it on for you.
              </p>
            )}

            <SafetyNotes />

            <p className="border-t border-rule pt-6 font-body text-xs leading-relaxed text-mid">
              DEWDROPZ does not organise, lead, vet or supervise these walks, and does not check
              who anyone is. You are meeting strangers in the hills at your own risk. In an
              emergency call <span className="text-text">112</span>.
            </p>
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
