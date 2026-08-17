import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekHero from '@/components/trek/TrekHero'
import { getPeople, getTrekMembership, getTrekBoard } from '@/actions/trekBuddy'
import { ACTIVITY_BY_KEY, type TrekActivity } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'Who is out there — DEWDROPZ',
  robots: { index: false, follow: false },
}

// Who is on the board.
//
// Only people who have actually hosted or been confirmed on something — a
// directory of everyone who ever ticked the terms box is a list of strangers to
// approach, which is the opposite of what this is for. That filter lives in the
// database (trek_people), not here.
export default async function PeoplePage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/people')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [people, all] = await Promise.all([getPeople(), getTrekBoard()])

  return (
    <>
      <NavBar />
      <main>
        <TrekHero counts={{}} openCount={all.length} canHost={membership.canHost} active="people" />

        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
              {people.length === 0
                ? 'Nobody has been out yet'
                : `${people.length} ${people.length === 1 ? 'person has' : 'people have'} been out`}
            </h2>

            {people.length === 0 ? (
              <p className="mt-4 rounded-sm border border-dashed border-rule px-6 py-12 text-center font-body text-sm text-mid">
                People appear here once they have hosted or been on a walk. Nobody is listed just
                for making an account.
              </p>
            ) : (
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {people.map((p) => (
                  <li key={p.userId}>
                    <Link
                      href={`/trek-buddy/people/${p.userId}`}
                      className="flex items-center justify-between gap-4 rounded-sm border border-rule bg-white px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-forest/50"
                    >
                      <div className="min-w-0">
                        <p className="font-display text-lg leading-tight text-text">{p.displayName}</p>
                        <p className="mt-0.5 font-body text-xs text-mid">
                          {p.homeBase ?? 'Somewhere near'}
                          {p.activities.length > 0 && (
                            <> · {p.activities.map((a) => ACTIVITY_BY_KEY[a as TrekActivity]?.label ?? a).join(', ')}</>
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-lg text-text tabular-nums">{p.walks}</span>
                        <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-mid">
                          {p.walks === 1 ? 'walk' : 'walks'}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
