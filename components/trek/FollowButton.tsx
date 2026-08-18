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
export default function FollowButton({
  personId,
  personName,
  initialFollowing,
  followers,
}: {
  personId: string
  personName: string
  initialFollowing: boolean
  followers: number
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

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-full px-5 py-2 font-body text-[11px] uppercase tracking-[0.14em] transition-colors disabled:opacity-50 ${
          following
            ? 'border border-rule text-mid hover:border-clay hover:text-clay'
            : 'bg-forest text-paper hover:bg-forest-mid'
        }`}
      >
        {pending ? '…' : following ? 'Following' : 'Follow'}
      </button>
      <p className="mt-2 font-body text-xs leading-relaxed text-mid">
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
