import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekHero from '@/components/trek/TrekHero'
import TrekPlanCard from '@/components/trek/TrekPlanCard'
import { getMyTreks, getTrekMembership, getTrekBoard } from '@/actions/trekBuddy'

export const metadata: Metadata = {
  title: 'Your walks — DEWDROPZ',
  robots: { index: false, follow: false },
}

// The third page, and the reason the product has a shape somebody can hold:
// the board is everyone's, this is yours. Two lists, because "I am taking
// people somewhere" and "I asked to go with someone" are different jobs with
// different anxieties — one is a duty, the other is a wait.
export default async function YourTreksPage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/yours')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [mine, all] = await Promise.all([getMyTreks(), getTrekBoard()])
  const waiting = mine.going.filter((g) => g.status === 'requested')
  const confirmed = mine.going.filter((g) => g.status === 'confirmed')

  return (
    <>
      <NavBar />
      <main>
        <TrekHero counts={{}} openCount={all.length} canHost={membership.canHost} active="yours" />

        <section className="bg-paper px-6 pb-24 pt-10 md:px-10">
          <div className="mx-auto max-w-5xl space-y-12">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                  You are hosting {mine.hosting.length}
                </h2>
                {membership.canHost && (
                  <Link href="/trek-buddy/new" className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest underline underline-offset-4">
                    Post another
                  </Link>
                )}
              </div>
              {mine.hosting.length === 0 ? (
                <p className="rounded-sm border border-dashed border-rule px-5 py-8 text-center font-body text-sm text-mid">
                  {membership.canHost
                    ? 'You have not posted a walk. The board fills up when people who are already going say so.'
                    : 'Hosting is invite-only while this is new.'}
                </p>
              ) : (
                <ul className="grid gap-3">
                  {mine.hosting.map((p) => <li key={p.id}><TrekPlanCard plan={p} /></li>)}
                </ul>
              )}
            </div>

            <div>
              <h2 className="pb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                You are going on {confirmed.length}
              </h2>
              {confirmed.length === 0 ? (
                <p className="rounded-sm border border-dashed border-rule px-5 py-8 text-center font-body text-sm text-mid">
                  Nothing confirmed yet. Ask to come on something from the{' '}
                  <Link href="/trek-buddy" className="text-forest underline underline-offset-4">board</Link>.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {confirmed.map(({ plan }) => <li key={plan.id}><TrekPlanCard plan={plan} /></li>)}
                </ul>
              )}
            </div>

            {waiting.length > 0 && (
              <div>
                <h2 className="pb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                  Waiting on a host — {waiting.length}
                </h2>
                <ul className="grid gap-3">
                  {waiting.map(({ plan }) => <li key={plan.id}><TrekPlanCard plan={plan} /></li>)}
                </ul>
                <p className="mt-3 font-body text-xs text-mid">
                  Hosts are people, not a system. If nobody has answered by the day before, assume
                  it is not happening and make another plan.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
