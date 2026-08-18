import { SAFETY_NOTES } from '@/lib/trek'

// The take-care notes.
//
// One component, used at every moment they matter — signing up, posting a plan,
// and on a plan page — because three drifting copies of safety guidance is how
// the wrong one ends up being the one somebody reads.
//
// Not a collapsed accordion, and not a link to a policy page. If it is worth
// saying it is worth reading, and the whole list is six short lines.
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
      <div className={`rounded-sm border border-rule bg-paper-warm/50 p-4 ${className}`}>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest">
          Before you go
        </h2>
        <ul className="mt-2 space-y-1">
          {SAFETY_NOTES.map((n) => (
            <li key={n.title} className="font-body text-xs text-mid">
              <span className="text-text">{n.title}.</span>{' '}
              {n.body.split('.')[0]}.
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <section className={`rounded-sm border border-rule bg-white p-6 ${className}`}>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest">
        Take care of yourself out there
      </h2>
      <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-mid">
        This board introduces people who have not met. The rules above are the board&apos;s;
        these are yours — and out in the hills, yours are the ones doing the work.
      </p>
      <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {SAFETY_NOTES.map((n) => (
          <div key={n.title}>
            <dt className="font-body text-sm text-text">{n.title}</dt>
            <dd className="mt-1 font-body text-xs leading-relaxed text-mid">{n.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
