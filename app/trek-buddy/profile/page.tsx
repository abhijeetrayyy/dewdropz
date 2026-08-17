import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekGate from '@/components/trek/TrekGate'
import Evidence from '@/components/trek/Evidence'
import ProfileForm from './ProfileForm'
import { getPerson, getTrekMembership, getVouchable } from '@/actions/trekBuddy'
import { DAY_ARC } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Your Trek Buddy profile — DEWDROPZ',
  robots: { index: false, follow: false },
}

export default async function TrekProfilePage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/profile')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [person, vouchable] = await Promise.all([
    getPerson(membership.userId!),
    getVouchable(),
  ])
  if (!person) redirect('/trek-buddy/setup')

  return (
    <>
      <NavBar />
      <main>
        <TrekGate
          eyebrow="Trek Buddy · Your profile"
          title={<>How people <span className="italic text-sage">see you.</span></>}
          lede="Somebody reads this before deciding whether to spend a day in the hills with you. Everything on it is a choice about what they learn first."
          image={DAY_ARC.firstLightPair}
        />
        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          <div className="mx-auto max-w-2xl">
            {/* The counted half, shown first and not editable — you cannot type
                your way to experience here. */}
            <Evidence person={person} />
          </div>
          <div className="mt-12">
            <ProfileForm person={person} vouchable={vouchable} />
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
