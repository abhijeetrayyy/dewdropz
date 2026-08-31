export interface AliveSegment {
  text: string
  /** Styling for this run of the line — the italic green half, for instance. */
  className?: string
  /** Opt in to the turn. Only a run that is declared italic and lands on a
   *  different colour has anything to turn INTO; FEEL is already in its final
   *  state, so it renders no extra box at all. */
  turns?: boolean
}

/**
 * The hero headline, set one character at a time so it can turn.
 *
 * THE IDEA
 *
 * The line arrives as one flat cream statement — FEEL ALIVE. entirely in roman
 * — and then the same wave comes back through it: letter by letter, ALIVE.
 * leans out of roman, catches first light, and settles into italic green. The
 * sentence stops stating and starts feeling, and it does it to itself.
 *
 *   arrival  — each letter rises 14px into place, 38ms after the one before it.
 *   turn     — 620ms later, at the instant its own rise ends, each letter of
 *              ALIVE. leans through 14 degrees into its italic and washes
 *              cream → first light → sage.
 *
 * It happens once. Nothing on this line moves again for the rest of the
 * session: no loop, no hover, no scroll trigger. Two earlier attempts at making
 * this headline alive were rejected for being permanent — a pointer-reactive
 * lean, then a per-letter sway — and both were rejected for the same reason a
 * screensaver is not decoration. This performs, resolves, and stops.
 *
 * NO JAVASCRIPT. NOT ONE LINE.
 *
 * This component renders markup and nothing else. Both animations are CSS, and
 * the mechanism that makes the turn possible with a single glyph is documented
 * where it lives, in globals.css under "The turn" — read it before changing the
 * skew, the transform-origin, or the Fraunces declaration in app/layout.tsx,
 * because all three are one mechanism.
 *
 * TRANSFORM AND COLOUR ONLY — NEVER OPACITY
 *
 * A stalled opacity animation leaves words permanently half-faded, and a
 * background tab stalls animations as a matter of course. Every state this line
 * can be caught in is a fully opaque letter at the right size in the right
 * place, somewhere between upright and italic and somewhere between cream and
 * green. There is no second copy of any letter, so there is nothing to
 * cross-fade and nothing to leave doubled.
 */
export default function AliveHeadline({
  segments,
  label,
  className = '',
  /** ms between one letter's arrival and the next. */
  stagger = 38,
}: {
  segments: AliveSegment[]
  /** What a screen reader hears. The per-character spans are hidden from it —
   *  ten separate letters is not a headline, it is spelling. */
  label: string
  className?: string
  stagger?: number
}) {
  // Words hold together. Characters are inline-block so each can be transformed
  // on its own, and inline-block means the line may break between any two of
  // them — so each word is its own nowrap box and only the spaces between words
  // are breakable, exactly as normal type behaves.
  let index = 0
  const words = segments.flatMap((segment) =>
    segment.text
      .split(' ')
      .filter((word) => word.length > 0)
      .map((word) => ({ word, className: segment.className, turns: segment.turns }))
  )

  return (
    <h1
      aria-label={label}
      className={className}
      // The cadence is a prop, the CSS needs it, and it is identical for every
      // character — so it is declared once here rather than ten times below.
      style={{ ['--stagger' as string]: `${stagger}ms` }}
    >
      {words.map((entry, wordIndex) => (
        <span key={`${entry.word}-${wordIndex}`}>
          {wordIndex > 0 ? ' ' : null}
          <span aria-hidden="true" className={`inline-block whitespace-nowrap ${entry.className ?? ''}`}>
            {Array.from(entry.word).map((character, charIndex) => {
              const i = index++
              return (
                <span
                  key={charIndex}
                  data-alive-char
                  className="inline-block"
                  // The character's index in the whole line. Both the arrival
                  // and the turn compute their delay from it, in CSS, so the
                  // two waves cannot drift out of step with each other.
                  style={{ ['--i' as string]: String(i) }}
                >
                  {entry.turns ? (
                    // Two boxes, and only where one is earned. The outer
                    // carries the arrival (a translate) and the inner carries
                    // the turn (a skew), because one element cannot hold two
                    // transform animations without one overwriting the other.
                    // A run that does not turn gets no inner box at all.
                    <span data-alive-turn className="inline-block">
                      {character}
                    </span>
                  ) : (
                    character
                  )}
                </span>
              )
            })}
          </span>
        </span>
      ))}
    </h1>
  )
}
