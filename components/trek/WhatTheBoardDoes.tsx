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
//
// TWO FENCES, BECAUSE THE ARGUMENT IS SPATIAL. Here is the ground enforcement
// covers; here is where that ground ends. That was being said with ten
// identical title-and-grey-paragraph pairs stacked in one white box, so the
// only thing carrying the distinction was a heading you had already scrolled
// past. Each half now sits inside its own coloured fence — forest and sage for
// what is enforced, clay for where it stops, which is the job those two colours
// already have everywhere else on the product — and the boundary is visible
// before a word is read.
//
// WHAT CHANGED IN THIS PASS, AND WHY THE BODIES CAME BACK OUT. Each rule's
// body used to be folded into a <details> behind a 10px monospace "What it
// stops →". Three things were wrong with that. A disclosure is a bet that the
// reader will open it, and this is the one block on the product where being
// read is the entire point — a limit nobody opens is a limit nobody was told.
// The summary was set in mono, uppercase, at 0.16em, which is the costume the
// rest of the board has now dropped: mono is for figures, and wide tracking is
// banned on anything you press. And the disclosure's own hover and focus
// colours were amber, which on this board now means a clock is running and
// nothing else.
//
// So the bodies are simply on the page, both halves in the same type at the
// same weight, and the two words that used to label the disclosure survive as
// the key over each list — a reader can now see what relying on any of this is
// worth without pressing anything.

function Fence({
  heading,
  intro,
  items,
  bodyKey,
  tone,
}: {
  heading: string
  intro: string
  items: readonly { title: string; body: string }[]
  /** The key over the list. Every body under it answers this. */
  bodyKey: string
  /** sage = the board enforces this · clay = the board does not reach here. */
  tone: 'sage' | 'clay'
}) {
  const sage = tone === 'sage'
  return (
    <div
      className={`rounded-[var(--r-panel)] border p-6 md:p-8 ${
        sage ? 'border-forest/20 bg-sage-soft/50' : 'border-clay/25 bg-clay-wash/60'
      }`}
    >
      <div className="flex items-baseline gap-3.5">
        <h3 className={`trek-h2 ${sage ? 'text-forest' : 'text-clay-deep'}`}>{heading}</h3>
        <span
          aria-hidden="true"
          className={`h-px flex-1 ${sage ? 'bg-forest/20' : 'bg-clay/25'}`}
        />
        {/* A count is the one thing on this block that is a quantity, so it is
            the one thing left in mono. */}
        <span
          // At /75 the clay count measured 3.5:1 on its own wash — under AA
          // for 13px, and it is the number that says how many limits there
          // are. Full strength on both fences.
          className={`font-mono text-[13px] leading-none tabular-nums ${
            sage ? 'text-forest' : 'text-clay-deep'
          }`}
        >
          {items.length}
        </span>
      </div>

      <p className="mt-3.5 font-body text-[13.5px] leading-relaxed text-mid">{intro}</p>

      <p className={`trek-label mt-7 ${sage ? 'text-forest' : 'text-clay-deep'}`}>{bodyKey}</p>

      <ul className="mt-4 space-y-5">
        {items.map((it) => (
          <li
            key={it.title}
            className={`border-t pt-4 first:border-0 first:pt-0 ${
              sage ? 'border-forest/12' : 'border-clay/20'
            }`}
          >
            <p className="font-body text-[15px] font-medium leading-snug text-text">{it.title}</p>
            <p className="mt-1.5 font-body text-[13.5px] leading-relaxed text-mid">{it.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function WhatTheBoardDoes({ className = '' }: { className?: string }) {
  return (
    <div // Not `items-start`. The two fences hold six rules and four limits, so
    // top-aligning them left one panel 258px taller than the other and the
    // pair read as an accident. They are an argument in two halves given
    // deliberately equal weight — matching their heights is the visual form of
    // that claim, and it costs a little whitespace in the shorter one.
    className={`grid gap-4 lg:grid-cols-2 ${className}`}>
      <Fence
        tone="sage"
        heading="What the board does"
        intro="Six rules, each one enforced by the database rather than asked for politely. They are listed by what they stop, so you can tell what relying on them is worth."
        items={BOARD_CHECKS}
        bodyKey="What it stops"
      />
      <Fence
        tone="clay"
        heading="And where it stops"
        intro="Not small print. Every line here is something a reasonable person would otherwise assume the board had covered."
        items={BOARD_LIMITS}
        bodyKey="How far it reaches"
      />
    </div>
  )
}
