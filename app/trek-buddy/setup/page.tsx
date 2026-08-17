import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekGate from '@/components/trek/TrekGate'
import { requireAuth } from '@/actions/auth'
import { getProfile } from '@/actions/auth'
import { getTrekMembership } from '@/actions/trekBuddy'
import SetupForm from './SetupForm'

export const metadata: Metadata = {
  title: 'Set up Trek Buddy — DEWDROPZ',
  robots: { index: false, follow: false },
}

export default async function TrekSetupPage() {
  await requireAuth()
  const membership = await getTrekMembership()
  if (membership.signedIn && membership.onboarded) redirect('/trek-buddy')

  const profile = await getProfile()
  // Offered as a starting point only — the field is editable, and the copy
  // under it says plainly that the courier name is not the right answer.
  const suggested = ((profile?.full_name as string) ?? '').split(' ')[0] ?? ''

  return (
    <>
      <NavBar />
      <main>
        <TrekGate
          eyebrow="Trek Buddy · Setting up"
          title={<>Before you go <span className="italic text-sage">anywhere.</span></>}
          lede="A name for the board, your age, and what you are agreeing to. It takes a minute and you only do it once."
        />
        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          <SetupForm suggestedName={suggested} />
        </section>
      </main>
      <FooterSection />
    </>
  )
}
