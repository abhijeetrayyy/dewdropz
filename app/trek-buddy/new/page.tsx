import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekHero from '@/components/trek/TrekHero'
import { getTrekBoard } from '@/actions/trekBuddy'
import { getTrekMembership } from '@/actions/trekBuddy'
import NewPlanForm from './NewPlanForm'
import { ACTIVITY_BY_KEY, type TrekActivity } from '@/lib/trek'

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

  // Only an activity the app actually knows survives the URL — a hand-typed
  // ?activity=anything must not reach the form as a broken spec lookup.
  const initial = activity && activity in ACTIVITY_BY_KEY
    ? (activity as TrekActivity)
    : undefined

  const all = await getTrekBoard()

  return (
    <>
      <NavBar />
      <main>
        <TrekHero counts={{}} openCount={all.length} canHost active="new" />
        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          <div className="mx-auto max-w-xl">
            <h2 className="font-display text-[clamp(24px,3.2vw,32px)] leading-tight text-text">
              Where are you going?
            </h2>
            <p className="mt-2 font-body text-sm leading-relaxed text-mid">
              Pick what you are doing and the hours fill themselves in. People ask to come, and
              you decide who does.
            </p>
          </div>
          <div className="mt-8">
            <NewPlanForm initialActivity={initial} trekGender={membership.trekGender} />
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
