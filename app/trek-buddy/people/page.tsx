import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekHero from '@/components/trek/TrekHero'
import PersonCardTile from '@/components/trek/PersonCardTile'
import Guidance from '@/components/trek/Guidance'
import {
  getGuidance, getPeople, getTrekBoard, getTrekKinds, getTrekMembership, getMyTrekCard, getUnreadCount
} from '@/actions/trekBuddy'

export const metadata: Metadata = {
  title: 'Who is out there — DEWDROPZ',
  robots: { index: false, follow: false },
}

const TOWNS = ['Dehradun', 'Mussoorie', 'Rishikesh', 'Haridwar', 'Sahastradhara', 'Chakrata']

// Who is on the board.
//
// Ordered mentors first, then people with vouches, then the newest — set in
// trek_people (059), not here. A directory sorted by signup date leads with the
// emptiest profiles on it, which is the worst possible first impression of a
// board whose entire question is "who would I go with".
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; home?: string }>
}) {
  const sp = await searchParams
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/people')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [people, all, kinds, mentorNotes, me, unread] = await Promise.all([
    getPeople({ activity: sp.activity, homeBase: sp.home }),
    getTrekBoard(),
    getTrekKinds(),
    getGuidance({ audiences: ['first_time'], limit: 4 }),
    getMyTrekCard(),
    getUnreadCount(),
  ])

  const mentors = people.filter((p) => p.mentor)
  const rest = people.filter((p) => !p.mentor)
  const filtering = Boolean(sp.activity || sp.home)

  const chip = (on: boolean) =>
    `whitespace-nowrap rounded-full border px-3.5 py-1.5 font-body text-xs transition-colors ${
      on ? 'border-forest bg-forest text-paper' : 'border-rule text-mid hover:border-text hover:text-text'
    }`

  return (
    <>
      <NavBar />
      <main>
        <TrekHero counts={{}} openCount={all.length} canHost={membership.canHost} active="people" me={me} unread={unread} />

        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          <div className="mx-auto max-w-5xl space-y-10">
            {/* Filters that answer the two questions people actually arrive
                with: does anyone near me go out, and does anyone do the thing
                I do. Anything else is a facet nobody uses. */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                  Sets off from
                </span>
                <Link href="/trek-buddy/people" className={chip(!sp.home)}>Anywhere</Link>
                {TOWNS.map((t) => (
                  <Link
                    key={t}
                    href={`/trek-buddy/people?${new URLSearchParams({ ...(sp.activity ? { activity: sp.activity } : {}), home: t })}`}
                    className={chip(sp.home === t)}
                  >
                    {t}
                  </Link>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                  Goes out for
                </span>
                <Link
                  href={`/trek-buddy/people${sp.home ? `?home=${encodeURIComponent(sp.home)}` : ''}`}
                  className={chip(!sp.activity)}
                >
                  Anything
                </Link>
                {kinds.filter((k) => !k.isOpenEnded).slice(0, 10).map((k) => (
                  <Link
                    key={k.key}
                    href={`/trek-buddy/people?${new URLSearchParams({ ...(sp.home ? { home: sp.home } : {}), activity: k.key })}`}
                    className={chip(sp.activity === k.key)}
                  >
                    {k.label}
                  </Link>
                ))}
              </div>
            </div>

            {people.length === 0 ? (
              <div className="rounded-sm border border-dashed border-rule px-6 py-16 text-center">
                <p className="font-display text-xl text-text">
                  {filtering ? 'Nobody matches that yet.' : 'Nobody has joined the board yet.'}
                </p>
                <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-mid">
                  {filtering
                    ? 'Try a wider filter — the board is small, and most people do more than one thing.'
                    : 'People appear here once they finish a profile. Yours is the one that makes it worth somebody else joining.'}
                </p>
                <Link
                  href="/trek-buddy/profile"
                  className="mt-6 inline-flex rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid"
                >
                  Set up how you look
                </Link>
              </div>
            ) : (
              <>
                {/* Mentors lead, and the page says why they are up here.
                    A badge nobody explains is decoration. */}
                {mentors.length > 0 && (
                  <div>
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-clay">
                      People who have done a lot of this
                    </h2>
                    <p className="mt-2 max-w-lg font-body text-sm leading-relaxed text-mid">
                      Appointed by DEWDROPZ, not self-claimed. They know these hills and are
                      happy to be asked — start here if you are working out where to begin.
                    </p>
                    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                      {mentors.map((p) => (
                        <li key={p.userId}><PersonCardTile person={p} /></li>
                      ))}
                    </ul>
                  </div>
                )}

                {rest.length > 0 && (
                  <div>
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                      {rest.length} {rest.length === 1 ? 'other person' : 'others'} on the board
                    </h2>
                    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                      {rest.map((p) => (
                        <li key={p.userId}><PersonCardTile person={p} /></li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {mentorNotes.length > 0 && (
              <div className="border-t border-rule pt-8">
                <Guidance
                  notes={mentorNotes}
                  title="If you are working out who to ask"
                  intro="Nobody on this board has been checked by anybody. These are the things that actually tell you something."
                />
              </div>
            )}
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
