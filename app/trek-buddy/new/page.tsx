import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
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

  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Trek Buddy"
          title="Post a walk."
          subtitle="Pick what you are doing, say where and when, and people ask to come. You decide who does."
          variant="altitude"
        />
        <section className="bg-paper px-6 pb-24 pt-14 md:px-10">
          <NewPlanForm initialActivity={initial} />
        </section>
      </main>
      <FooterSection />
    </>
  )
}
