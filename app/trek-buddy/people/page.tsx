import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import PersonCardTile, { TrustPips } from '@/components/trek/PersonCardTile'
import Guidance from '@/components/trek/Guidance'
import Avatar from '@/components/trek/ui/Avatar'
import EmptyState from '@/components/trek/ui/EmptyState'
import { Datum, ShelfHead } from '@/components/trek/ui/Bits'
import { getStreak } from '@/actions/trekRecap'
import {
  getFollowedIds, getGuidance, getPeople, getTrekKinds, getTrekMembership,
  type PersonSummary,
} from '@/actions/trekBuddy'

export const metadata: Metadata = {
  title: 'Who is out there — DEWDROPZ',
  robots: { index: false, follow: false },
}

const TOWNS = ['Dehradun', 'Mussoorie', 'Rishikesh', 'Haridwar', 'Sahastradhara', 'Chakrata']

/**
 * A mentor, given the width of half the page — and no photograph at all.
 *
 * This tile used to be a stock landscape at 60% under a 90° scrim with a name
 * printed across it. It looked expensive and it was, in the one currency this
 * board cannot spend: a mountain nobody in the picture has ever stood on,
 * placed behind the name of the person you are being told to trust, is a
 * photograph making a claim on their behalf. The rest of the product refuses
 * to let anybody type their way to credibility; a decorative ridge is the same
 * lie told with an image, and it was worse here than anywhere else because
 * these are the four or five people a first-timer is steered toward.
 *
 * So the mentor tile is now a clean card. What identifies them is the avatar
 * everybody wears everywhere else on the board, at 64px, wearing the clay ring
 * that means mentor; what recommends them is their record, set as figures,
 * next to the rung they stand on. Nothing on it is decoration and nothing on
 * it was supplied by a stock library.
 */
function MentorTile({ person }: { person: PersonSummary }) {
  return (
    <Link
      href={`/trek-buddy/people/${person.userId}`}
      className="trek-card trek-liftable flex w-full flex-col gap-4 p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
    >
      <div className="flex items-start gap-4">
        <Avatar name={person.displayName} id={person.userId} size={64} role="mentor" />
        <div className="min-w-0">
          <p className="trek-label-xs text-clay-deep">Mentor · appointed by DEWDROPZ</p>
          <h3 className="trek-h3 mt-2 text-text">{person.displayName}</h3>
          <p className="mt-1 truncate font-body text-[13px] text-mid">
            {person.homeBase ?? 'Somewhere near'}
          </p>
        </div>
      </div>

      {person.intro && (
        <p className="line-clamp-2 rounded-[var(--r-input)] border border-rule-warm bg-paper-warm px-3.5 py-2.5 font-body text-[13px] leading-relaxed text-text">
          {person.intro}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-end gap-x-7 gap-y-3 border-t border-rule-soft pt-3.5">
        <Datum k="hosted" v={person.walksHosted} size="sm" />
        <Datum k="joined" v={person.walksJoined} size="sm" />
        <Datum k={person.vouches === 1 ? 'vouch' : 'vouches'} v={person.vouches} size="sm" />
        <TrustPips rung={person.trustRung} className="ml-auto pb-1" />
      </div>
    </Link>
  )
}

// Who is on the board.
//
// Ordered mentors first, then people with vouches, then the newest — set in
// trek_people (059), not here. A directory sorted by signup date leads with the
// emptiest profiles on it, which is the worst possible first impression of a
// board whose entire question is "who would I go with".
//
// Two bands, and the banding is the point. The warm one is the question and the
// controls for narrowing it; the paper one is the answer. The page used to run
// one ground from the header to the footer with the filters floating in the
// middle of it, so nothing said where reading stopped and choosing began.
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; home?: string }>
}) {
  const sp = await searchParams
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/people')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [people, everyone, kinds, mentorNotes, followedIds] = await Promise.all([
    getPeople({ activity: sp.activity, homeBase: sp.home }),
    // The unfiltered board, so the eyebrow can say how many people are actually
    // here rather than how many survived the filter. A count that shrinks when
    // you narrow is not a fact about the board.
    getPeople(),
    getTrekKinds(),
    getGuidance({ audiences: ['first_time'], limit: 4 }),
    getFollowedIds(),
  ])

  const followed = new Set(followedIds)
  // Labels come from the kinds table, so a card listing an activity an admin
  // added last week does not render the raw key at a stranger.
  const kindLabel = Object.fromEntries(kinds.map((k) => [k.key, k.label]))

  // A streak is counted from walks that have already happened, so somebody with
  // no walks cannot have one — which lets the page ask only about the people
  // who could possibly answer instead of firing one RPC per row.
  const streaks = Object.fromEntries(
    await Promise.all(
      people
        .filter((p) => p.walksHosted + p.walksJoined > 0)
        .map(async (p) => [p.userId, await getStreak(p.userId)] as const)
    )
  ) as Record<string, number>

  const mentors = people.filter((p) => p.mentor)
  const rest = people.filter((p) => !p.mentor)
  const filtering = Boolean(sp.activity || sp.home)

  // The same selection idiom the composer and the profile form use: solid
  // forest when it is on, a hairline when it is not, and a sage focus ring on
  // both. Nothing here gets to invent a third way of saying "selected".
  const chip = (on: boolean) =>
    `trek-pill trek-pill-sm whitespace-nowrap font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
      on ? 'trek-pill-act' : 'trek-pill-quiet'
    }`

  const href = (next: { activity?: string; home?: string }) => {
    const q = new URLSearchParams()
    const activity = 'activity' in next ? next.activity : sp.activity
    const home = 'home' in next ? next.home : sp.home
    if (activity) q.set('activity', activity)
    if (home) q.set('home', home)
    const s = q.toString()
    return s ? `/trek-buddy/people?${s}` : '/trek-buddy/people'
  }

  return (
    <>
      {/* ── Band one · who is here, and how to narrow it ─────────────────── */}
      <section className="trek-band border-y border-rule-warm bg-paper-warm pb-8 pt-28 md:pt-32">
        <div className="trek-measure">
          {/* The eyebrow is forest rather than ember. There is no clock on this
              screen — nobody on it is leaving in two hours — and amber on this
              board now means exactly that and nothing else. */}
          <p className="trek-eyebrow text-forest">People · {everyone.length} on the board</p>
          <h1 className="trek-h1 mt-3 max-w-[16ch] text-balance text-text">
            The ones who show up.
          </h1>
          <p className="mt-3.5 max-w-[520px] font-body text-[15px] leading-relaxed text-mid">
            Every number on these cards was counted by the board, not typed by the person. Follow
            people whose hours match yours — their next plan lands in your basecamp.
          </p>

          {/* The two questions people actually arrive with: does anyone near me
              go out, and does anyone do the thing I do. Anything else is a
              facet nobody uses. */}
          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="trek-label mr-1 text-mid">Sets off from</span>
              <Link
                href={href({ home: undefined })}
                aria-current={!sp.home ? 'true' : undefined}
                className={chip(!sp.home)}
              >
                Anywhere
              </Link>
              {TOWNS.map((t) => (
                <Link
                  key={t}
                  href={href({ home: t })}
                  aria-current={sp.home === t ? 'true' : undefined}
                  className={chip(sp.home === t)}
                >
                  {t}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="trek-label mr-1 text-mid">Goes out for</span>
              <Link
                href={href({ activity: undefined })}
                aria-current={!sp.activity ? 'true' : undefined}
                className={chip(!sp.activity)}
              >
                Anything
              </Link>
              {kinds.filter((k) => !k.isOpenEnded).slice(0, 10).map((k) => (
                <Link
                  key={k.key}
                  href={href({ activity: k.key })}
                  aria-current={sp.activity === k.key ? 'true' : undefined}
                  className={chip(sp.activity === k.key)}
                >
                  {k.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Band two · the people ────────────────────────────────────────── */}
      <section className="trek-band bg-paper pb-24 pt-12">
        <div className="trek-measure flex flex-col gap-10">
          {people.length === 0 ? (
            <EmptyState
              title={filtering ? 'Nobody matches that yet.' : 'Nobody has joined the board yet.'}
              body={
                filtering
                  ? 'Try a wider filter — the board is small, and most people do more than one thing.'
                  : 'People appear here once they finish a profile. Yours is the one that makes it worth somebody else joining.'
              }
              action={{ label: 'Set up how you look', href: '/trek-buddy/profile' }}
              secondary={filtering ? { label: 'Clear the filters', href: '/trek-buddy/people' } : undefined}
            />
          ) : (
            <>
              {mentors.length > 0 && (
                <div>
                  <ShelfHead title="Mentors" count={mentors.length} />
                  {/* The badge explains itself here or it becomes a rank. The
                      sentence is the profile page's, unchanged. */}
                  <p className="-mt-2 mb-5 max-w-[560px] font-body text-[13px] leading-relaxed text-mid">
                    Appointed by DEWDROPZ, not self-claimed. They know these hills and are happy to
                    be asked — start here if you are working out where to begin.
                  </p>
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {mentors.map((p) => (
                      <li key={p.userId} className="flex">
                        <MentorTile person={p} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {rest.length > 0 && (
                <div>
                  <ShelfHead title="Out there every week" count={rest.length} />
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map((p) => (
                      <li key={p.userId} className="flex">
                        <PersonCardTile
                          person={p}
                          following={followed.has(p.userId)}
                          streak={streaks[p.userId] ?? 0}
                          showFollow={p.userId !== membership.userId}
                          kindLabel={kindLabel}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {mentorNotes.length > 0 && (
            <div className="border-t border-rule pt-8">
              <Guidance
                notes={mentorNotes}
                title="If you are working out who to ask"
                intro="Nobody on this board has been checked by anybody. These are the things that actually tell you something."
              />
            </div>
          )}
        </div>
      </section>
    </>
  )
}
