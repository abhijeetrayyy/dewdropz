import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekHero from '@/components/trek/TrekHero'
import { getUnreadMessages } from '@/actions/trekChat'
import TrekPlanCard from '@/components/trek/TrekPlanCard'
import {
  getBasecamp, getTrekBoard, getTrekMembership, getMyTrekCard, getUnreadCount,
} from '@/actions/trekBuddy'
import { getFollowingCount } from '@/actions/trekSocial'

export const metadata: Metadata = {
  title: 'Basecamp — DEWDROPZ',
  robots: { index: false, follow: false },
}

// Basecamp: what the people you follow are doing next.
//
// A filter over the board, never a way around it — every walk here is one you
// could already have found by scrolling. That is worth being clear about,
// because a feed that shows things the board does not would make following a
// privilege, and following is meant to be a saved search.
//
// The empty state distinguishes two very different situations. Following nobody
// is a thing you can fix in one click, and it says so. Following people who
// have not posted is nobody's fault and says that instead. One empty box for
// both would have been wrong in whichever case the reader was actually in.
export default async function BasecampPage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/basecamp')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [plans, following, all, me, unread, unreadMessages] = await Promise.all([
    getBasecamp(),
    getFollowingCount(),
    getTrekBoard(),
    getMyTrekCard(),
    getUnreadCount(),
    getUnreadMessages(),
  ])

  return (
    <>
      <NavBar />
      <main>
        <TrekHero unreadMessages={unreadMessages}
          counts={{}}
          openCount={all.length}
          canHost={membership.canHost}
          active="basecamp"
          me={me}
          unread={unread}
        />

        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-[clamp(24px,3.2vw,34px)] leading-tight text-text">
              What your people are doing next.
            </h2>
            <p className="mt-2 max-w-lg font-body text-sm leading-relaxed text-mid">
              Walks posted by people you follow, soonest first. Everything here is on the board
              too — following just saves you the scrolling.
            </p>

            {plans.length > 0 ? (
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((p) => (
                  <li key={p.id}>
                    <TrekPlanCard plan={p} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-8 rounded-sm border border-dashed border-rule px-6 py-10">
                {following === 0 ? (
                  <>
                    <p className="font-body text-sm text-text">You are not following anybody yet.</p>
                    <p className="mt-1.5 max-w-md font-body text-sm leading-relaxed text-mid">
                      Following somebody puts their next walk here. They are not told, and it gives
                      you no standing when you ask to come on one — it is a saved search, nothing
                      more.
                    </p>
                    <Link
                      href="/trek-buddy/people"
                      className="mt-4 inline-block rounded-full bg-forest px-6 py-2.5 font-body text-[11px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-forest-mid"
                    >
                      See who is out there
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="font-body text-sm text-text">
                      Nothing from the {following} {following === 1 ? 'person' : 'people'} you
                      follow.
                    </p>
                    <p className="mt-1.5 max-w-md font-body text-sm leading-relaxed text-mid">
                      They have not posted anything upcoming. Nothing is invented to fill this
                      space — the board is on the other tab, and it has everything.
                    </p>
                    <Link
                      href="/trek-buddy"
                      className="mt-4 inline-block border-b border-rule pb-1 font-body text-[11px] uppercase tracking-[0.14em] text-mid transition-colors hover:text-text"
                    >
                      Back to the board
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
