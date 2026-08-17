import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekGate from '@/components/trek/TrekGate'
import Evidence from '@/components/trek/Evidence'
import SafetyActions from '@/components/trek/SafetyActions'
import { getPerson, getTrekMembership } from '@/actions/trekBuddy'
import { ACTIVITY_BY_KEY, type TrekActivity } from '@/lib/trek'
import { DAY_ARC } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'A member — DEWDROPZ',
  robots: { index: false, follow: false },
}

const PACE_LABEL: Record<string, string> = {
  steady: 'Steady — stops often, no rush',
  brisk: 'Brisk — keeps moving',
  fast: 'Fast — expects a pace',
}

// Somebody else's profile.
//
// The question this page exists to answer is narrow and specific: do I want to
// spend a day in the hills with this person? So it shows what they do, how fast
// they walk, where they set off from, and the four facts the board can actually
// stand behind — and nothing else. No photograph, no contact, no follower
// count, no message button.
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect(`/auth/login?redirect=/trek-buddy/people/${id}`)
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const person = await getPerson(id)
  if (!person) notFound()
  const isMe = membership.userId === id

  return (
    <>
      <NavBar />
      <main>
        <TrekGate
          eyebrow={person.homeBase ? `Trek Buddy · ${person.homeBase}` : 'Trek Buddy · Member'}
          title={person.displayName}
          lede={person.intro ?? 'This member has not written an intro yet.'}
          image={DAY_ARC.theRidge}
        />

        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          <div className="mx-auto max-w-3xl space-y-10">
            {isMe && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-forest/25 bg-forest/[0.04] px-4 py-3">
                <span className="font-body text-sm text-text">This is how other people see you.</span>
                <Link href="/trek-buddy/profile" className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest underline underline-offset-4">
                  Edit your profile
                </Link>
              </div>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">Goes out for</h2>
                {person.activities.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {person.activities.map((a) => (
                      <li key={a} className="rounded-full border border-rule px-3 py-1 font-body text-xs text-text">
                        {ACTIVITY_BY_KEY[a as TrekActivity]?.label ?? a}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 font-body text-sm text-mid">Not said.</p>
                )}

                {person.pace && (
                  <>
                    <h2 className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-mid">Pace</h2>
                    <p className="mt-2 font-body text-sm text-text">{PACE_LABEL[person.pace] ?? person.pace}</p>
                  </>
                )}

                {person.languages.length > 0 && (
                  <>
                    <h2 className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-mid">Speaks</h2>
                    <p className="mt-2 font-body text-sm text-text">{person.languages.join(', ')}</p>
                  </>
                )}
              </div>

              <Evidence person={person} />
            </div>

            <div className="space-y-4 border-t border-rule pt-6">
              <p className="font-body text-xs leading-relaxed text-mid">
                There is no way to message someone here, and that is deliberate — walks are
                arranged on the walk&apos;s own page, where the host decides who comes.
              </p>
              {/* Nobody needs to report or block themselves. */}
              {!isMe && <SafetyActions subjectId={person.userId} subjectName={person.displayName} />}
            </div>
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
