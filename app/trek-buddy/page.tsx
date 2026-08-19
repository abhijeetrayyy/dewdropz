import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import TrekLanding from '@/components/trek/TrekLanding'
import TrekHome from '@/components/trek/TrekHome'
import {
  getBoardPulse, getLeavingSoon, getMyTreks, getMyTrekCard, getPeople,
  getTrekBoard, getTrekMemberCard, getTrekMembership, getTrekPlan, type TrekPlanRow,
} from '@/actions/trekBuddy'

export const metadata: Metadata = {
  title: 'TrekBuddy — DEWDROPZ',
  description: 'A members’ noticeboard for going outdoors together, around Dehradun. Members only.',
  // Who is going where, and when, is not something to hand a crawler.
  robots: { index: false, follow: false },
}

// The front door, and it is two different doors.
//
// SIGNED OUT it is the case for the platform. SIGNED IN it is Today — what is
// waiting on you, what you are going to, what is new. It used to be the board
// in both cases, which meant a member arrived on a search surface: a filter
// rail and eleven cards, answering a question nobody asks on arrival. The board
// still exists, in full, at /trek-buddy/discover, which is where you go once
// you know you want to look rather than to be told.
export default async function TrekBuddyPage() {
  const membership = await getTrekMembership()

  // ── Signed out ──────────────────────────────────────────────────────────
  // No walk is named and no person is shown: there is no anonymous read policy
  // on any Trek Buddy table, and this page does not go looking for one.
  if (!membership.signedIn) {
    const pulse = await getBoardPulse()
    return (
      <TrekLanding
        openCount={pulse.open}
        weekendCount={pulse.weekend}
        peopleCount={pulse.members}
        activityCounts={pulse.byActivity}
      />
    )
  }

  // A page whose only content is a button to another page is a wasted click.
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [me, board, soon, myTreks, people] = await Promise.all([
    getMyTrekCard(),
    getTrekBoard(),
    getLeavingSoon(),
    getMyTreks(),
    getPeople({ limit: 8 }),
  ])

  // Everything the viewer is on, soonest first, hosting and going together —
  // on this page the distinction is a caption, not a heading.
  // `going` carries the viewer's own status alongside the plan; on this page
  // the distinction between hosting and going is a caption, not a heading.
  const mine: TrekPlanRow[] = [
    ...myTreks.hosting,
    ...myTreks.going.map((g) => g.plan),
  ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

  // Who is asking to come on walks this member hosts. getTrekPlan is the only
  // thing that hands over a roster, and only to the host — so this is fetched
  // per hosted walk rather than in one query, and it returns nothing at all for
  // somebody who hosts nothing.
  const rosters = await Promise.all(myTreks.hosting.map((p) => getTrekPlan(p.id)))
  const asking = rosters.flatMap((data) =>
    !data
      ? []
      : (data.roster ?? [])
          .filter((r) => r.status === 'requested')
          .map((r) => ({
            planId: data.plan.id,
            planPlace: data.plan.place,
            userId: r.user_id as string,
            displayName: r.display_name as string,
            message: (r.message as string) ?? null,
          }))
  )

  // A host deciding about a stranger from a name and one sentence is the thing
  // this page exists to fix, so each asker's counted record comes with them.
  // One lookup per unique person, and there are usually two or three.
  const uniqueAskers = [...new Set(asking.map((a) => a.userId))]
  const cards = await Promise.all(uniqueAskers.map((id) => getTrekMemberCard(id)))
  const recordOf = new Map(
    uniqueAskers.map((id, i) => [
      id,
      {
        walks: (cards[i]?.joined ?? 0) + (cards[i]?.hosted ?? 0),
        since: cards[i]?.memberSince ?? null,
      },
    ])
  )
  const requests = asking.map((a) => ({
    ...a,
    walks: recordOf.get(a.userId)?.walks ?? 0,
    since: recordOf.get(a.userId)?.since ?? null,
  }))

  // What is new, minus anything already shown in the leaving-soon row, so the
  // page never prints the same walk twice.
  const inSoon = new Set(soon.map((p) => p.id))
  const fresh = board.filter((p) => !inSoon.has(p.id))

  return (
    <TrekHome
      me={me}
      soon={soon}
      fresh={fresh}
      mine={mine}
      requests={requests}
      people={people.map((p) => ({ id: p.userId, name: p.displayName, mentor: p.mentor }))}
      boardCount={board.length}
      canHost={membership.canHost}
    />
  )
}
