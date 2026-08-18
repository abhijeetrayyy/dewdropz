import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekHero from '@/components/trek/TrekHero'
import { getUnreadMessages } from '@/actions/trekChat'
import { getTrekBoard, getTrekKinds, getMyTrekCard, getUnreadCount } from '@/actions/trekBuddy'
import { getTrekMembership } from '@/actions/trekBuddy'
import NewPlanForm from './NewPlanForm'

export const metadata: Metadata = {
  title: 'Post a walk — DEWDROPZ',
  robots: { index: false, follow: false },
}

export default async function NewTrekPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string }>
}) {
  const { activity } = await searchParams
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/new')
  if (!membership.onboarded) redirect('/trek-buddy/setup')
  // Hosting is invite-only. Checked here for a clean redirect and again inside
  // trek_create_plan, which is the one that actually decides.
  if (!membership.canHost) redirect('/trek-buddy')

  const [all, kinds, me, unread, unreadMessages] = await Promise.all([
    getTrekBoard(), getTrekKinds(), getMyTrekCard(), getUnreadCount(),
    getUnreadMessages(),
  ])

  // Only a kind the board is actually taking survives the URL — a hand-typed
  // ?activity=anything must not reach the form as a broken lookup.
  const initial = kinds.some((k) => k.key === activity) ? activity : undefined

  return (
    <>
      <NavBar />
      <main>
        <TrekHero unreadMessages={unreadMessages} counts={{}} openCount={all.length} canHost active="new" me={me} unread={unread} />
        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          {/* Left-aligned with the form beneath it rather than centred in a
              narrow column, so the page reads as one thing. The line is the
              design's and it is doing real work: what follows is long, and a
              host who thinks of it as paperwork abandons it halfway. */}
          <div className="mx-auto max-w-5xl">
            <h2 className="max-w-2xl font-display text-[clamp(26px,4vw,44px)] font-light leading-[1.08] text-text">
              You are not filling a form.
              <br />
              <span className="italic text-forest">You are writing an invitation.</span>
            </h2>
            <p className="mt-4 max-w-lg font-body text-sm leading-relaxed text-mid">
              Pick what you are doing and the hours fill themselves in. People ask to come, and
              you decide who does.
            </p>
          </div>
          <div className="mt-8">
            <NewPlanForm kinds={kinds} initialActivity={initial} trekGender={membership.trekGender} userId={membership.userId!} hostName={membership.displayName ?? "You"} />
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
