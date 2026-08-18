import { BOARD_CHECKS, BOARD_LIMITS } from '@/lib/trek'

// What the board does, and where it stops.
//
// Until this existed the only thing Trek Buddy said about safety was that it
// checked nothing — "Nobody here has been checked. DEWDROPZ does not verify
// identity." True as far as it went, and the wrong first thing to read: it was
// the platform disclaiming responsibility where a reader was looking for a
// reason to trust it, and the people it turned away hardest were the ones with
// most to lose by turning up alone.
//
// It was also an overstatement. The board withholds meeting points, refuses
// contact details, enforces women-only both ways and will not record a vouch
// that was not earned. All of that was already true and none of it was said.
//
// The two halves are given equal weight on purpose. A safety claim with the
// limits in smaller type underneath is a marketing page, and the limits are the
// half somebody deciding whether to rely on a badge actually needs.
export default function WhatTheBoardDoes({ className = '' }: { className?: string }) {
  return (
    <section className={`rounded-[6px] border border-rule bg-white p-6 ${className}`}>
      <h2 className="trek-label font-mono text-forest">
        What the board does
      </h2>
      <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-mid">
        Six rules, each one enforced by the database rather than asked for politely. They are
        listed by what they stop, so you can tell what relying on them is worth.
      </p>

      <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {BOARD_CHECKS.map((c) => (
          <div key={c.title}>
            <dt className="font-body text-sm text-text">{c.title}</dt>
            <dd className="mt-1 font-body text-xs leading-relaxed text-mid">{c.body}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-8 border-t border-rule pt-6 trek-label font-mono text-clay-deep">
        And where it stops
      </h3>
      <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-mid">
        Not small print. Every line here is something a reasonable person would otherwise assume
        the board had covered.
      </p>

      <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {BOARD_LIMITS.map((l) => (
          <div key={l.title}>
            <dt className="font-body text-sm text-text">{l.title}</dt>
            <dd className="mt-1 font-body text-xs leading-relaxed text-mid">{l.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
