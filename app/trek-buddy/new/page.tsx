import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import { getTrekMembership } from '@/actions/trekBuddy'
import NewPlanForm from './NewPlanForm'

export const metadata: Metadata = {
  title: 'Post a walk — DEWDROPZ',
  robots: { index: false, follow: false },
}

export default async function NewTrekPlanPage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/new')
  if (!membership.onboarded) redirect('/trek-buddy/setup')
  // Hosting is invite-only. Checked here for a clean redirect and again inside
  // trek_create_plan, which is the one that actually decides.
  if (!membership.canHost) redirect('/trek-buddy')

  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Trek Buddy"
          title="Post a walk."
          subtitle="One day, out and back in daylight. People ask to come and you decide who does."
          variant="altitude"
        />
        <section className="bg-paper px-6 pb-24 pt-14 md:px-10">
          <NewPlanForm />
        </section>
      </main>
      <FooterSection />
    </>
  )
}
