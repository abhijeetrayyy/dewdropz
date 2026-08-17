'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveTrekProfile } from '@/actions/trekBuddy'
import SafetyNotes from '@/components/trek/SafetyNotes'

// The four questions. Deliberately not buried in account settings: someone
// should read what this is before they can post or join, and the terms box is
// the only place the shop's position is stated in words a person will see.
export default function SetupForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [displayName, setDisplayName] = useState(suggestedName)
  const [dob, setDob] = useState('')
  const [accept, setAccept] = useState(false)
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    start(async () => {
      const r = await saveTrekProfile({ displayName, dob, acceptTerms: accept })
      if ('error' in r) { setError(r.error ?? 'Could not save'); return }
      router.replace('/trek-buddy')
    })
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md">
      <label className="block">
        <span className="font-body text-xs uppercase tracking-[0.12em] text-mid">
          Name other walkers see
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={2}
          maxLength={40}
          autoComplete="nickname"
          className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-2.5 font-body text-sm text-text focus:border-forest focus:outline-none"
        />
        <span className="mt-1.5 block font-body text-xs text-mid">
          Not your delivery name. A first name is plenty.
        </span>
      </label>

      <label className="mt-6 block">
        <span className="font-body text-xs uppercase tracking-[0.12em] text-mid">Date of birth</span>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          required
          autoComplete="bday"
          className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-2.5 font-body text-sm text-text focus:border-forest focus:outline-none"
        />
        <span className="mt-1.5 block font-body text-xs text-mid">
          Trek Buddy is for adults. We do not show this to anyone.
        </span>
      </label>

      {/* The rules of the place, before the box that says you accept them.
          A tick-box above unread guidance is a tick-box; below it, it is at
          least an acknowledgement of something the person has seen. */}
      <SafetyNotes variant="compact" className="mt-8" />

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-sm border border-rule bg-white p-4">
        <input
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--forest)]"
        />
        <span className="font-body text-xs leading-relaxed text-mid">
          I understand DEWDROPZ does not organise, lead, vet or supervise these walks and does not
          check who anyone is. I am meeting strangers outdoors at my own risk, I will tell someone
          not on the walk where I am going, and I will not post anything I would not want a
          stranger to know.
        </span>
      </label>

      {error && <p className="mt-4 font-body text-xs text-clay">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 w-full rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Join the board'}
      </button>
    </form>
  )
}
