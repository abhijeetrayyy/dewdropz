import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekHero from '@/components/trek/TrekHero'
import Evidence from '@/components/trek/Evidence'
import TrustCard from '@/components/trek/TrustCard'
import ProfileForm from './ProfileForm'
import {
  getMyTrekCard, getPerson, getTrekBoard, getTrekKinds, getTrekMembership,
  getVouchable, getUnreadCount
} from '@/actions/trekBuddy'
import { getMyTrust } from '@/actions/trekTrust'

export const metadata: Metadata = {
  title: 'Your Trek Buddy profile — DEWDROPZ',
  robots: { index: false, follow: false },
}

export default async function TrekProfilePage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/profile')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [person, vouchable, all, me, unread, kinds, trust] = await Promise.all([
    getPerson(membership.userId!),
    getVouchable(),
    getTrekBoard(),
    getMyTrekCard(),
    getUnreadCount(),
    getTrekKinds(),
    getMyTrust(),
  ])
  if (!person) redirect('/trek-buddy/setup')

  return (
    <>
      <NavBar />
      <main>
        {/* The same header every other Trek Buddy page has. This one used to
            wear the storefront's editorial gate instead, which is why it read
            as a page that had wandered in from another site — no tabs, no way
            back to the board, and nothing marking it as part of this thing. */}
        <TrekHero
          counts={{}}
          openCount={all.length}
          canHost={membership.canHost}
          active="profile"
          me={me} unread={unread}
        />

        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          <div className="mx-auto max-w-2xl space-y-10">
            <div>
              <h2 className="font-display text-[clamp(24px,3.2vw,32px)] leading-tight text-text">
                How people see you.
              </h2>
              <p className="mt-2 max-w-lg font-body text-sm leading-relaxed text-mid">
                Somebody reads this before deciding whether to spend a day in the hills with
                you. Everything on it is a choice about what they learn first.
              </p>
            </div>

            {/* The counted half, shown first and not editable — you cannot type
                your way to experience here. */}
            <Evidence person={person} />

            {/* Directly under it, because it is the same kind of thing: facts
                about you that were earned rather than written. */}
            {trust && <TrustCard trust={trust} />}
          </div>

          <div className="mt-12">
            <ProfileForm person={person} vouchable={vouchable} kinds={kinds} />
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
