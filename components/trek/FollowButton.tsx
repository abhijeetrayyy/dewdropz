'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { followPerson, unfollowPerson } from '@/actions/trekSocial'

// Following somebody.
//
// The copy is careful not to overstate what this does. "Follow" on most
// platforms means a relationship; here it is a saved search — their next walk
// turns up in your basecamp and nothing else changes. They are not told, they
// cannot see it, and it gives you no standing when you ask to come on one of
// their walks.
//
// WHAT CHANGED IS ONLY THE DRESS. The last pass put amber on the act — at a
// point where amber had been given exactly one meaning on this board, which is
// that a clock is running. A saved search has no clock, so the two states are
// back to the product's own pair: not following is the forest act, following is
// the quiet outline every already-in state wears here. The compact variant is
// `trek-pill-sm` rather than a hand-set 10px at 0.1em tracking, because small
// caps on a thing a person presses is a display gesture and this button has to
// say what it does in a normal voice. The focus ring moves off dawn for the
// same reason the fill did. Nothing about the transition, the toast or the
// server calls moved.
//
// It appears at two sizes on two grounds — a full-size act on the ink of a
// person's header, a compact one in the corner of every card in the directory —
// so ground and variant are props rather than two copies of this file.
export default function FollowButton({
  personId,
  personName,
  initialFollowing,
  followers = 0,
  ground = 'light',
  variant = 'full',
  className = '',
}: {
  personId: string
  personName: string
  initialFollowing: boolean
  /** Only shown by the `full` variant, and only when somebody actually does. */
  followers?: number
  /** What it sits on. On ink the "already following" state needs a paper-side
      hairline to exist at all. */
  ground?: 'light' | 'dark'
  /** `compact` is the card corner: the pill alone, no explanation under it. */
  variant?: 'full' | 'compact'
  className?: string
}) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, start] = useTransition()

  function toggle() {
    const next = !following
    start(async () => {
      const r = next ? await followPerson(personId) : await unfollowPerson(personId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setFollowing(next)
      toast.success(next ? `Following ${personName}` : `No longer following ${personName}`)
    })
  }

  const quiet = ground === 'dark' ? 'trek-pill-onink' : 'trek-pill-quiet'
  const size = variant === 'compact' ? 'trek-pill-sm' : ''

  const button = (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      aria-label={following ? `Stop following ${personName}` : `Follow ${personName}`}
      className={`trek-pill font-body ${following ? quiet : 'trek-pill-act'} ${size} disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage`}
    >
      {pending ? '…' : following ? 'Following' : 'Follow'}
    </button>
  )

  if (variant === 'compact') return <span className={className}>{button}</span>

  return (
    <div className={className}>
      {button}
      <p
        className={`mt-2.5 max-w-xs font-body text-xs leading-relaxed ${
          ground === 'dark' ? 'text-paper/60' : 'text-mid'
        }`}
      >
        {following
          ? `Their next walk turns up in your basecamp. ${personName} is not told, and it gives you no standing when you ask to come.`
          : `Puts their next walk in your basecamp. Nothing else — they are not told, and it does not help you get on a walk.`}
        {followers > 0 && (
          <> {followers} {followers === 1 ? 'person follows' : 'people follow'} them.</>
        )}
      </p>
    </div>
  )
}
