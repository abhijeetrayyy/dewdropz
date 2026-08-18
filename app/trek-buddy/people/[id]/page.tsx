import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekGate from '@/components/trek/TrekGate'
import Evidence from '@/components/trek/Evidence'
import SafetyActions from '@/components/trek/SafetyActions'
import Guidance from '@/components/trek/Guidance'
import FollowButton from '@/components/trek/FollowButton'
import { getFollowState } from '@/actions/trekSocial'
import { getStreak } from '@/actions/trekRecap'
import { EXPERIENCE_LABEL } from '@/components/trek/PersonCardTile'
import { getGuidance, getPerson, getTrekKinds, getTrekMembership } from '@/actions/trekBuddy'
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

/** One self-declared line. Label left, value right, so the column scans. */
function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-32 shrink-0 font-body text-sm text-mid">{k}</dt>
      <dd className="font-body text-sm text-text">{v}</dd>
    </div>
  )
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

  // A mentor's page carries what they are for. Everyone else's does not, so the
  // badge stays meaningful rather than becoming a rank.
  // Labels come from the kinds table now, so a profile listing an activity an
  // admin added last week does not render the raw key.
  const kindLabel = Object.fromEntries((await getTrekKinds()).map((k) => [k.key, k.label]))

  // Skipped entirely on your own page — there is no button to feed.
  const follow = isMe ? { following: false, followers: 0 } : await getFollowState(id)
  const streak = await getStreak(id)

  const mentorNotes = person.mentor
    ? await getGuidance({ audiences: ['first_time', 'all'], limit: 5 })
    : []

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

            {person.mentor && (
              <div className="mb-8 border-l-2 border-clay bg-clay/[0.04] px-5 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-clay">
                  Mentor · appointed by DEWDROPZ
                </p>
                {person.mentorBio && (
                  <p className="mt-2 font-body text-sm leading-relaxed text-text">{person.mentorBio}</p>
                )}
                <p className="mt-2 font-body text-xs leading-relaxed text-mid">
                  Mentors are named by us, never self-claimed, and it is not a safety guarantee —
                  it means somebody who has done a lot of this is happy to be asked.
                </p>
              </div>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">Goes out for</h2>
                {person.activities.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {person.activities.map((a) => (
                      <li key={a} className="rounded-full border border-rule px-3 py-1 font-body text-xs text-text">
                        {kindLabel[a] ?? a.replace(/_/g, ' ')}
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

                {/* What they say about themselves, headed as exactly that.
                    The counted facts are in Evidence beside this, and the two
                    must never look like one list. */}
                {(person.experience || person.yearsOut || person.highestM ||
                  person.usualDays.length > 0 || person.carries.length > 0) && (
                  <>
                    <h2 className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                      What they say about themselves
                    </h2>
                    <p className="mt-1.5 font-body text-xs text-mid">
                      Typed by them. Nobody has checked any of it.
                    </p>
                    <dl className="mt-3 space-y-2.5">
                      {person.experience && (
                        <Fact k="Experience" v={EXPERIENCE_LABEL[person.experience] ?? person.experience} />
                      )}
                      {person.yearsOut != null && (
                        <Fact k="Going out for" v={`${person.yearsOut} year${person.yearsOut === 1 ? '' : 's'}`} />
                      )}
                      {person.highestM != null && (
                        <Fact k="Highest been" v={`${person.highestM.toLocaleString('en-IN')} m`} />
                      )}
                      {person.usualDays.length > 0 && (
                        <Fact k="Usually goes" v={person.usualDays.join(', ')} />
                      )}
                      {person.carries.length > 0 && (
                        <Fact k="Carries" v={person.carries.join(', ')} />
                      )}
                    </dl>
                  </>
                )}
              </div>

              <Evidence person={person} streak={streak} />

              {/* Under the counted facts, because it is a preference and they
                  are evidence. Never shown on your own page: following
                  yourself is nonsense the database also refuses. */}
              {!isMe && (
                <FollowButton
                  personId={id}
                  personName={person.displayName}
                  initialFollowing={follow.following}
                  followers={follow.followers}
                />
              )}
            </div>

            {mentorNotes.length > 0 && (
              <div className="mt-10 border-t border-rule pt-8">
                <Guidance
                  notes={mentorNotes}
                  title="What they would tell you before your first one"
                  intro="The board's guidance, shown here because this is where somebody new usually ends up looking."
                />
              </div>
            )}

            <div className="mt-10 space-y-4 border-t border-rule pt-6">
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
