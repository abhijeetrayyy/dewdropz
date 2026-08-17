import type { PersonCard } from '@/actions/trekBuddy'

// What is actually known about a person.
//
// Deliberately NOT a badge, a tick, a star or a score. Migration 052 refused a
// "verified" badge because nobody at this shop verifies anybody, and a badge
// that means nothing launders a stranger into a vetted person — which is worse
// than showing nothing at all.
//
// So each row is a fact plus, in the same breath, exactly what that fact does
// and does not prove. "Confirmed email · proves they read one email" is honest
// in a way a green tick never is. Nobody can misread it as endorsement, and it
// is still genuinely useful: four weak signals a person can weigh themselves
// beat one strong-looking signal that is hollow.
//
// The customer row is the one thing this board has that no other trekking board
// does — a delivered order means a real person accepted a parcel at a real
// address in India and paid for it.
export default function Evidence({ person }: { person: PersonCard }) {
  const walks = person.walksHosted + person.walksJoined

  // Each row states its own absence rather than being negated by a template.
  // "No 0 walks on this board" is what you get when a component tries to be
  // clever about that, and it is worse than either half.
  const rows: { on: boolean; label: string; off: string; proves: string }[] = [
    {
      on: person.emailOk,
      label: 'Confirmed email',
      off: 'Email not confirmed',
      proves: 'They opened one email. It says nothing about who they are.',
    },
    {
      on: person.isCustomer,
      label: 'DEWDROPZ customer',
      off: 'Has never ordered from the shop',
      proves: 'A delivered order means a real person took a parcel at a real address in India.',
    },
    {
      on: walks > 0,
      label: walks === 1 ? '1 walk on this board' : `${walks} walks on this board`,
      off: 'Has not been out yet',
      proves:
        walks > 0
          ? `${person.walksHosted} hosted, ${person.walksJoined} joined. Counted, not claimed.`
          : 'This would be counted from what actually happened, never self-declared.',
    },
    {
      on: person.vouches > 0,
      label: person.vouches === 1 ? 'Vouched for by 1 person' : `Vouched for by ${person.vouches} people`,
      off: 'Nobody has vouched for them',
      proves: 'Only someone who was on a completed walk with them can say this.',
    },
  ]

  return (
    <div>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
        What is known
      </h2>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {rows.map((r) => (
          <li key={r.label} className="flex gap-3 py-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${r.on ? 'bg-forest' : 'bg-rule'}`}
            />
            <div className="min-w-0">
              <p className={`font-body text-sm ${r.on ? 'text-text' : 'text-mid/60'}`}>
                {r.on ? r.label : r.off}
              </p>
              <p className="mt-0.5 font-body text-xs leading-relaxed text-mid">{r.proves}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-body text-xs leading-relaxed text-mid">
        DEWDROPZ has not met this person and has not checked who they are. None of the above is a
        recommendation — it is the whole of what the board knows.
      </p>
    </div>
  )
}
