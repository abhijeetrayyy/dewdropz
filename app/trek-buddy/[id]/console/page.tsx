import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import Countdown from '@/components/trek/Countdown'
import ConsoleClient from './ConsoleClient'
import { getTrekMembership } from '@/actions/trekBuddy'
import { getConsole } from '@/actions/trekConsole'
import { DIFFICULTY_LABEL } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'Host console — DEWDROPZ',
  robots: { index: false, follow: false },
}

// One screen for the host of one walk.
//
// getConsole returns null for anybody who does not host it, so this 404s rather
// than explaining itself. "You are not the host of this walk" told to somebody
// guessing at URLs confirms the walk exists and who it belongs to; a 404 says
// only that there is nothing here for them.
export default async function ConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect(`/auth/login?redirect=/trek-buddy/${id}/console`)
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const data = await getConsole(id)
  if (!data) notFound()

  const { plan, roster, meetingPoint, logistics, canCheckIn } = data
  const p = plan as Record<string, never> & {
    id: string; place: string; starts_at: string; start_time: string | null
    capacity: number; going_count: number; min_party: number
    difficulty: 'easy' | 'moderate' | 'difficult'; status: string
  }

  const day = new Date(p.starts_at).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
  })
  return (
    <>
      <NavBar />
      <main className="bg-paper">
        <section className="px-6 pb-24 pt-28 md:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mid">
              Host console · your walk
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-[clamp(28px,4vw,44px)] leading-tight text-text">
                  {p.place}
                </h1>
                <p className="mt-1.5 font-mono text-xs uppercase tracking-[0.14em] text-mid">
                  {day}
                  {p.start_time ? ` · ${p.start_time.slice(0, 5)}` : ''}
                  {' · '}
                  <Countdown iso={p.starts_at} prefix="leaves in" />
                  {' · '}
                  {p.going_count} of {p.capacity} going
                  {' · '}
                  {DIFFICULTY_LABEL[p.difficulty] ?? p.difficulty}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/trek-buddy/${p.id}`}
                  className="rounded-full border border-rule px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:border-forest hover:text-forest">
                  Public view
                </Link>
                <Link href={`/trek-buddy/${p.id}#chat`}
                  className="rounded-full border border-rule px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:border-forest hover:text-forest">
                  Group chat
                </Link>
              </div>
            </div>

            {p.status === 'cancelled' ? (
              <p className="mt-10 rounded-sm border border-clay/40 bg-clay/5 px-4 py-3 font-body text-sm text-clay">
                This walk was called off. Nothing here can be changed.
              </p>
            ) : (
              <div className="mt-10">
                <ConsoleClient
                  planId={p.id}
                  roster={roster}
                  meetingPoint={meetingPoint}
                  logistics={logistics}
                  minParty={p.min_party}
                  goingCount={p.going_count}
                  canCheckIn={canCheckIn}
                />
              </div>
            )}
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
