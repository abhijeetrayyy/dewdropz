import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Evidence from '@/components/trek/Evidence'
import TrustCard from '@/components/trek/TrustCard'
import ProfileForm from './ProfileForm'
import { getPerson, getTrekKinds, getTrekMembership, getVouchable } from '@/actions/trekBuddy'
import { getMyTrust } from '@/actions/trekTrust'
import { getStreak } from '@/actions/trekRecap'

export const metadata: Metadata = {
  title: 'Your TrekBuddy profile — DEWDROPZ',
  robots: { index: false, follow: false },
}

// Your profile — the page a stranger reads before deciding to spend a day with
// you, shown to you the way they will see it.
//
// The whole screen is one client component. That is not laziness: the point of
// this page is the live preview, and a preview that only updates on save is the
// thing the page already had — the public view lived at another URL, so seeing
// the effect of an edit meant saving, navigating away and navigating back.
//
// Everything that is *not* editable still comes from the server: `Evidence` and
// `TrustCard` are rendered here and handed down as a slot, so the counted half
// of the profile stays a server render and does not get dragged into the
// client bundle just because the fields next to it are interactive.
//
// This page no longer renders `TrekHero`. The layout owns the chrome now, which
// is why `getMyTrekCard`, `getUnreadCount`, `getUnreadMessages` and the whole
// board fetch are gone from here — five queries that existed only to draw a
// header this page no longer draws.
export default async function TrekProfilePage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/profile')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [person, vouchable, kinds, trust, streak] = await Promise.all([
    getPerson(membership.userId!),
    getVouchable(),
    getTrekKinds(),
    getMyTrust(),
    getStreak(membership.userId!),
  ])
  if (!person) redirect('/trek-buddy/setup')

  return (
    <ProfileForm
      person={person}
      vouchable={vouchable}
      kinds={kinds}
      counted={
        <>
          {/* The counted half, first and not editable — you cannot type your
              way to experience here. It sits above the fields on purpose: the
              claims below are read against these, and putting the claims first
              would let them borrow the authority of facts they did not earn. */}
          <Evidence person={person} streak={streak} />
          {/* Directly under it, because it is the same kind of thing: facts
              about you that were earned rather than written. It is given your
              name and id as well as your rung — on your own profile the card
              can wear your face, and a trust ladder attached to a person reads
              as a position rather than as a score. */}
          {trust && (
            <TrustCard
              trust={trust}
              name={person.displayName}
              id={person.userId}
              homeBase={person.homeBase}
            />
          )}
        </>
      }
    />
  )
}
