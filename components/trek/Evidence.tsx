import type { PersonCard } from '@/actions/trekBuddy'
import { Datum, SectionLabel } from './ui/Bits'

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
//
// WHY IT IS NOW FIGURES AND CHIPS. This is a ledger, and it was rendered as
// ninety words of 12px grey prose — five bullet-and-paragraph rows in which the
// only numbers on the whole card ("3 walks", "2 people") were set at the same
// size and weight as the sentence explaining them. A count is an instrument
// reading; it belongs large with its unit small, which is what makes a reader
// take it in without reading.
//
// The card now separates the two kinds of fact it holds, because the difference
// is the entire argument:
//
//   COUNTED — walks, vouches, weeks out. Things Postgres added up from events
//   that happened. Mono figures, because they are quantities.
//   SIGNALLED — a confirmed email, a verified phone, a delivered order, the
//   date they joined. Binary, un-countable, and each worth much less than it
//   looks. Chips in Archivo on a paper-warm tint, so they never read as scores.
//
// The phone signal is new here only in the sense that it can finally be drawn:
// the rung it comes from was being SELECTed and then dropped before it reached
// a component, so the one check the board actually enforces a bar on was
// invisible on the page where somebody weighs a stranger.
//
// Not one sentence is gone. Every label, every negative form of a label and
// every "what this proves" line is kept verbatim in the ledger underneath.
//
// AND THE LEDGER IS NO LONGER FOLDED AWAY. Both halves of it — "what each
// proves, and does not" and "what DEWDROPZ has not done" — were <details>
// behind a 10px monospace summary in uppercase at 0.16em, hovering to amber and
// taking an amber focus ring. Every part of that was wrong now: mono is for
// figures, wide tracking is banned on anything you press, and amber means a
// clock is running. Worse, on the plan page this card is already inside a
// disclosure, so the honest half of a stranger's record was two taps down.
//
// Both are on the page. The "what it proves" lines are the counted and the
// signalled halves' actual meaning, and the DEWDROPZ line — that nobody here
// has met this person — is the single most important sentence on the card, so
// it now sits in a clay fence at the foot where the eye finishes. Clay is the
// product's colour for where something stops, and this is the edge of
// everything the board knows.
export default function Evidence({
  person,
  streak = 0,
}: {
  person: PersonCard
  /** Weeks out in a row, derived in Postgres. See migration 078. */
  streak?: number
}) {
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
    // Only when the rung is actually known. `trustRung` was SELECTed in
    // Postgres and thrown away in the action layer for months; now that it
    // arrives, a null still means "not asked" rather than "no", and printing
    // "Phone not verified" for an unknown would be the one thing this card
    // exists to avoid — a claim the board cannot back.
    ...(person.trustRung != null
      ? [{
          on: person.trustRung >= 1,
          label: 'Verified phone',
          off: 'Phone not verified',
          proves:
            'It proves somebody holds that SIM. Not their name, not their age, not that they are who the profile says. It makes a throwaway account cost money and effort, and that is the whole of the claim.',
        }]
      : []),
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
    // Shown only when it is running. A dormant streak rendered as "0 weeks in a
    // row" turns a nice thing into a reproach, and this list is evidence about
    // somebody, not a scoreboard they are losing.
    ...(streak > 0
      ? [{
          on: true,
          label: streak === 1 ? 'Out this week' : `Out ${streak} weeks running`,
          off: '',
          proves:
            'Counted back from the most recent week they were out, from walks that actually happened.',
        }]
      : []),
  ]

  // The counted half. Hosted and joined are split out because a person who has
  // led eleven walks and a person who has been on eleven are not the same
  // stranger, and the old single "11 walks on this board" line hid that.
  const figures: { k: string; v: number }[] = [
    { k: 'Walks', v: walks },
    { k: 'Hosted', v: person.walksHosted },
    { k: 'Joined', v: person.walksJoined },
    { k: 'Vouches', v: person.vouches },
    ...(streak > 0 ? [{ k: 'Weeks out', v: streak }] : []),
  ]

  const since = memberSince(person.memberSince)

  // The signalled half. `on` decides which of the two forms the chip takes —
  // never a template negation, and never a chip that quietly disappears when
  // the answer is no, because an absent signal is information too.
  const signals: { on: boolean; text: string }[] = [
    { on: person.emailOk, text: person.emailOk ? 'Confirmed email' : 'Email not confirmed' },
    ...(person.trustRung != null
      ? [{
          on: person.trustRung >= 1,
          text: person.trustRung >= 1 ? 'Verified phone' : 'Phone not verified',
        }]
      : []),
    {
      on: person.isCustomer,
      text: person.isCustomer ? 'DEWDROPZ customer' : 'Has never ordered from the shop',
    },
    ...(since ? [{ on: true, text: `Member since ${since}` }] : []),
  ]

  return (
    <section>
      <div className="flex items-baseline gap-3.5">
        <SectionLabel>What is known</SectionLabel>
        <span aria-hidden="true" className="h-px flex-1 bg-rule" />
      </div>

      {/* ── Counted ────────────────────────────────────────────────────────
          Quantities Postgres added up from events that happened. Figures at
          instrument size with the unit under them, which is the only reason a
          reader takes them in without reading. */}
      <p className="trek-label mt-4 text-forest">Counted</p>
      <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-5 border-y border-rule py-5">
        {figures.map((f) => (
          <Datum key={f.k} k={f.k} v={f.v} />
        ))}
      </div>

      {/* ── Claimed ────────────────────────────────────────────────────────
          Binary, un-countable, and each one worth much less than it looks. Set
          as words on paper-warm rather than as figures, because none of these
          is a quantity and setting them like one would lend them a weight the
          board cannot back. An absent signal keeps its dashed chip: "has never
          ordered from the shop" is information too. */}
      <p className="trek-label mt-6 text-mid">Claimed, not counted</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {signals.map((s) => (
          <li
            key={s.text}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[13px] ${
              s.on
                ? 'border border-rule-warm bg-paper-warm text-text'
                : 'border border-dashed border-rule-warm text-mid/70'
            }`}
          >
            <span aria-hidden="true" className={s.on ? 'text-sage' : 'text-mid/50'}>
              {s.on ? '✓' : '·'}
            </span>
            {s.text}
          </li>
        ))}
      </ul>

      {/* The ledger itself, whole. Every line, in the same words and the same
          order, and no longer behind a tap — a chip that says "verified phone"
          and a sentence that says what a verified phone is worth have to be
          readable in one look, or the chip is the only thing that gets read. */}
      <p className="trek-label mt-6 text-mid">What each proves, and does not</p>
      <dl className="mt-3 divide-y divide-rule-soft border-y border-rule-soft">
        {rows.map((r) => (
          <div key={r.label} className="py-3.5">
            <dt
              className={`flex gap-3 font-body text-[14px] font-medium ${
                r.on ? 'text-text' : 'text-mid/70'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  r.on ? 'bg-sage' : 'bg-rule'
                }`}
              />
              <span className="min-w-0">{r.on ? r.label : r.off}</span>
            </dt>
            <dd className="mt-1 pl-[18px] font-body text-[13px] leading-relaxed text-mid">
              {r.proves}
            </dd>
          </div>
        ))}
      </dl>

      {/* The edge of everything above it, in clay — the product's colour for
          where something stops. It is the last thing on the card because it is
          the sentence a reader should leave holding. */}
      <div className="mt-5 rounded-[var(--r-card)] border border-clay/25 bg-clay-wash/60 p-4">
        <p className="trek-label text-clay-deep">What DEWDROPZ has not done</p>
        <p className="mt-2 font-body text-[13.5px] leading-relaxed text-mid">
          DEWDROPZ has not met this person and has not checked who they are. None of the above is a
          recommendation — it is the whole of what the board knows.
        </p>
      </div>
    </section>
  )
}

/** "Mar 2024". Month and year only — the exact day is nobody's business. */
function memberSince(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', year: 'numeric' })
}
