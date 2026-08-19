import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Countdown from '@/components/trek/Countdown'
import ConsoleClient from './ConsoleClient'
import { getTrekMemberCard, getTrekMembership } from '@/actions/trekBuddy'
import { getMessages, type TrekMessage } from '@/actions/trekChat'
import { getConsole } from '@/actions/trekConsole'
import { Eyebrow, Tag } from '@/components/trek/ui/Bits'
import { DIFFICULTY_LABEL } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'Host console — DEWDROPZ',
  robots: { index: false, follow: false },
}

/**
 * One reading on the console's instrument strip.
 *
 * The header used to state the whole walk as a single 12px monospace sentence —
 * "Sat 22 Aug · 05:10 · leaves in 4d 6h · 3 of 8 confirmed · Moderate" — which
 * is five separate readings run together in one voice, at a size that makes a
 * host squint at the one thing they opened the console to check. A key over a
 * figure is how every instrument that has ever been read at speed does it, and
 * this is a screen somebody reads standing at a bus stand in the dark.
 *
 * Everything in the strip is a figure, so mono is honest here. The words —
 * how hard it is, who it is open to — are Tags beside the title instead.
 */
function Reading({
  k,
  v,
  tone = 'paper',
}: {
  k: string
  v: ReactNode
  /** `urgent` is spent on the one count that is somebody waiting on you. */
  tone?: 'paper' | 'sage' | 'urgent'
}) {
  // This strip sits on the ink band, which decides which amber it can be.
  // `--dawn` measures 4.06:1 on ink and `--ember` 3.19 — ember is the amber for
  // PAPER, and using it here made the one urgent figure the least readable
  // thing in the row. `--dawn-soft` is the amber that survives on ink, and it
  // is already what the leaving-soon rail uses for the same job.
  const tones = { paper: 'text-paper', sage: 'text-sage', urgent: 'text-dawn-soft' }
  return (
    <div>
      <dt className="trek-label-xs text-paper/50">{k}</dt>
      <dd className={`mt-1.5 font-mono text-[19px] leading-none tabular-nums ${tones[tone]}`}>
        {v}
      </dd>
    </div>
  )
}

// One screen for the host of one walk.
//
// getConsole returns null for anybody who does not host it, so this 404s rather
// than explaining itself. "You are not the host of this walk" told to somebody
// guessing at URLs confirms the walk exists and who it belongs to; a 404 says
// only that there is nothing here for them.
//
// The console is the one Trek Buddy screen with no identity of its own and no
// navigation into the rest of the product: it is a desk, opened for one walk,
// and everything on it is either a decision or the evidence for one. So the
// header is ink — the product's control ground — and the three links out are
// ghosts, because leaving is never the thing you came here to do.
export default async function ConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect(`/auth/login?redirect=/trek-buddy/${id}/console`)
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const data = await getConsole(id)
  if (!data) notFound()

  const { plan, roster, meetingPoint, logistics, canCheckIn, nameOf } = data
  // The two constraint columns are new to this cast rather than to the table:
  // `trek_plans` has carried them since 055, and the console — the screen where
  // a host decides who is allowed on the walk — was the one place they were not
  // being read. Who the walk is open to belongs next to its name.
  const p = plan as Record<string, never> & {
    id: string; place: string; starts_at: string; start_time: string | null
    capacity: number; going_count: number; min_party: number
    difficulty: 'easy' | 'moderate' | 'difficult'; status: string; share_token: string | null
    cost_paise: number | null; women_only: boolean; senior_friendly: boolean
  }

  const day = new Date(p.starts_at).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
  })
  const whenLabel = `${day}${p.start_time ? ` · ${p.start_time.slice(0, 5)}` : ''}`
  const cancelled = p.status === 'cancelled'

  // What a host is actually deciding when they confirm somebody: not a name and
  // a sentence, but whether this person has been out with anybody here before.
  // Those counts were already computed for the member card and were simply not
  // reaching the one screen where the answer changes what somebody does. Only
  // the people asking are looked up — usually none, occasionally three.
  const asking = roster.filter((r) => r.status === 'requested')
  const queued = roster.filter((r) => r.status === 'waitlisted')

  // The second read is the thread, for the Comms tab. It asks a different
  // question of the same rows the group chat does — not "what has been said"
  // but "what have I already changed the plan to" — so the announcements are
  // separated out here, newest first, because the last one is the one that is
  // still true. Read through the caller's own session inside the action, so
  // RLS decides whether anything arrives at all.
  //
  // A cancelled walk reads nothing: there is nothing below the header that can
  // act, so there is nothing for either read to be evidence for.
  const [cards, thread] = await Promise.all([
    Promise.all(asking.map((r) => getTrekMemberCard(r.user_id))),
    cancelled ? Promise.resolve([] as TrekMessage[]) : getMessages(p.id),
  ])

  const credibility: Record<string, { hosted: number; joined: number }> = {}
  asking.forEach((r, i) => {
    const c = cards[i]
    if (c) credibility[r.user_id] = { hosted: c.hosted, joined: c.joined }
  })
  const announcements = thread.filter((m) => m.is_announcement).reverse()

  // Built here and handed to the client component, so the walk's identity is
  // rendered on the server and the tab strip that sits directly under it is
  // rendered on the client, without splitting the ink band in two.
  const header = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <Eyebrow tone="ondark">Host console</Eyebrow>
          <h1 className="trek-h1 mt-3 text-paper">{p.place}</h1>

          {/* Who the walk is open to, said on the host's own screen, in the
              same clay and sage the board's cards use for it. A women-only walk
              is enforced in Postgres whatever this renders — but a host
              confirming people needs to see the rule they posted under while
              they are deciding, not only the person asking. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Tag tone="ondark">{DIFFICULTY_LABEL[p.difficulty] ?? p.difficulty}</Tag>
            {p.women_only && <Tag tone="clay">Women only</Tag>}
            {p.senior_friendly && <Tag tone="sage">Senior friendly</Tag>}
            {cancelled && <Tag tone="clay">Called off</Tag>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 pb-1">
          {/* The invite card is a panel in the rail rather than a page of its
              own, so this is an anchor — and it is dropped on a cancelled walk,
              where the panel it points at is not rendered at all. It is first
              because it is the only control here that grows the walk. */}
          {!cancelled && (
            <a href="#invite" className="trek-pill trek-pill-onink font-body">Invite card</a>
          )}
          <Link href={`/trek-buddy/${p.id}#chat`} className="trek-pill trek-pill-onink font-body">
            Group chat
          </Link>
          <Link href={`/trek-buddy/${p.id}`} className="trek-pill trek-pill-onink font-body">
            Public view
          </Link>
        </div>
      </div>

      <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-paper/15 pt-5 sm:grid-cols-3 lg:grid-cols-5">
        <Reading k="Leaves" v={whenLabel} />
        {!cancelled && (
          <Reading k="Countdown" v={<Countdown iso={p.starts_at} prefix="" />} />
        )}
        <Reading k="Confirmed" v={`${p.going_count} / ${p.capacity}`} tone="sage" />
        {!cancelled && (
          <Reading
            k="Waiting on you"
            v={asking.length}
            tone={asking.length > 0 ? 'urgent' : 'paper'}
          />
        )}
        {!cancelled && <Reading k="On the waitlist" v={queued.length} />}
      </dl>
    </>
  )

  // A cancelled walk keeps its header and loses every control, which is the
  // honest shape of it: the walk still happened as a thing you posted, and
  // there is nothing left to decide about it.
  if (cancelled) {
    return (
      <>
        <section className="trek-band bg-ink pb-11 pt-28 md:pt-32">
          <div className="trek-measure">{header}</div>
        </section>
        <section className="trek-band bg-paper py-16">
          <div className="trek-measure">
            {/* Clay at 2px, the same edge the public page draws around a called
                -off walk. Never red: a host who called a walk off because the
                road washed out did the right thing, and an error colour would
                tell them otherwise every time they opened this. */}
            <div className="rounded-[var(--r-card)] border-2 border-clay bg-clay-wash px-5 py-4.5">
              <p className="trek-label text-clay-deep">Called off</p>
              <p className="mt-2 font-body text-[15px] leading-relaxed text-text">
                This walk was called off. Nothing here can be changed.
              </p>
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <ConsoleClient
      header={header}
      planId={p.id}
      place={p.place}
      whenLabel={whenLabel}
      roster={roster}
      credibility={credibility}
      announcements={announcements}
      meetingPoint={meetingPoint}
      logistics={logistics}
      minParty={p.min_party}
      goingCount={p.going_count}
      capacity={p.capacity}
      canCheckIn={canCheckIn}
      shareToken={p.share_token}
      nameOf={nameOf}
      costPaise={p.cost_paise}
    />
  )
}
