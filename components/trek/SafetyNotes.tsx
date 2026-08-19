import { SAFETY_NOTES } from '@/lib/trek'

// The take-care notes.
//
// One component, used at every moment they matter — signing up, posting a plan,
// and on a plan page — because three drifting copies of safety guidance is how
// the wrong one ends up being the one somebody reads.
//
// Not a collapsed accordion, and not a link to a policy page. If it is worth
// saying it is worth reading, and the whole list is six short lines.
//
// WHY THESE SIX ARE NUMBERED. They were a two-column <dl> of title-then-grey-
// paragraph, which is the same shape the board's own rules, the guidance notes
// and the evidence ledger all had — four unrelated things wearing one costume.
// These are the only list on the product that is a checklist a person runs
// through before leaving the house, so they are drawn as one: an index, a rule
// over each note, and the sentence kept at full length underneath. Nothing is
// hidden behind a disclosure, unlike the board's own rules, because a note you
// have to open is a note nobody opens and this is the half that is actually
// load-bearing on a hillside.
//
// WHAT CHANGED IN THIS PASS. The index was ember and the rule over each note
// was a 2px dawn edge, which put six amber marks on a block about packing a
// torch and telling somebody where you are going. Amber on this board now means
// one thing — a clock is running, a walk is about to leave — and a list you are
// meant to read calmly, days in advance, is the opposite of that. The index and
// the rule are forest instead: the colour the product already uses for the
// things it is sure about. Nothing here is urgent; all of it is important, and
// those are not the same signal.
//
// The bodies also came up from 12px to 13.5. A sentence that says "tell someone
// who is not coming where you are going" cannot be the smallest type on the
// screen it appears on.
export default function SafetyNotes({
  variant = 'full',
  className = '',
}: {
  /** `full` for the board and the forms, `compact` where space is tight. */
  variant?: 'full' | 'compact'
  className?: string
}) {
  if (variant === 'compact') {
    return (
      <div
        className={`rounded-[var(--r-panel)] border border-rule-warm bg-paper-warm/60 p-5 ${className}`}
      >
        <div className="flex items-baseline gap-3.5">
          <h2 className="trek-h3 text-forest">Before you go</h2>
          <span aria-hidden="true" className="h-px flex-1 bg-rule-warm" />
          <span className="font-mono text-[13px] leading-none text-mid tabular-nums">
            {SAFETY_NOTES.length}
          </span>
        </div>

        {/* Still the compact variant — one line each, first sentence only — but
            the line now has an index and a rule holding it, so a form that
            already carries six labels does not read as seven paragraphs. */}
        <ol className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {SAFETY_NOTES.map((n, i) => (
            <li
              key={n.title}
              className="flex gap-3 rounded-[var(--r-card)] border border-rule-soft bg-surface px-3.5 py-3"
            >
              <span className="mt-px shrink-0 font-mono text-[11px] leading-[1.5] text-forest tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="font-body text-[13px] leading-relaxed text-mid">
                <span className="font-medium text-text">{n.title}.</span> {n.body.split('.')[0]}.
              </p>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <section className={`trek-card p-6 md:p-8 ${className}`}>
      <div className="flex items-baseline gap-3.5">
        <h2 className="trek-h2 text-forest">Take care of yourself out there</h2>
        <span aria-hidden="true" className="h-px flex-1 bg-rule" />
        <span className="font-mono text-[13px] leading-none text-mid tabular-nums">
          {SAFETY_NOTES.length}
        </span>
      </div>

      <p className="mt-3.5 max-w-xl font-body text-[13.5px] leading-relaxed text-mid">
        This board introduces people who have not met. The rules above are the board&apos;s;
        these are yours — and out in the hills, yours are the ones doing the work.
      </p>

      <ol className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {SAFETY_NOTES.map((n, i) => (
          <li key={n.title} className="border-t-2 border-forest pt-4">
            <span className="font-mono text-[13px] leading-none text-forest tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="trek-h3 mt-2.5 text-text">{n.title}</h3>
            <p className="mt-2 font-body text-[13.5px] leading-relaxed text-mid">{n.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
