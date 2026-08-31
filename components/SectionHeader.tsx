import type { ReactNode } from 'react'

/**
 * The ways a page and its sections are allowed to open.
 *
 * WHY THIS EXISTS
 *
 * Every band on the homepage opened the same way — a mono eyebrow over a display
 * heading, hard left — four and five times running. Five of them carried this
 * string character for character:
 *
 *   font-mono text-[10px] tracking-[0.2em] text-forest uppercase
 *
 * and two more had drifted off it for no reason anybody could name. Eleven
 * sections opening in one shape is the single most specific reason a page reads
 * as machine-made: not bad taste, absence of rhythm. It was filed independently
 * by nine of the thirteen section councils.
 *
 * THE RULE: assign one species per section and hold it; never run the same
 * species twice in a row.
 *
 *   stamp     — a mono eyebrow over a display heading, hard left.
 *               For a section that is a list of things.
 *   statement — the heading alone at roughly twice the scale, no eyebrow.
 *               For when the heading IS the argument.
 *   index     — a numbered rule across the full measure, heading inline.
 *               For reference material. It is the one species that draws the
 *               page's own width as a line, which is why it is worth having.
 *
 * The homepage rotation, in scroll order:
 *
 *   02 collections  stamp        08 season kit    statement
 *   03 essentials   index        09 the climb     index
 *   04 studio       statement    10 community     stamp
 *   05 trek buddy   stamp        11 brand pulse   statement
 *   06 trails       index        12 dispatch      index
 *
 * The trust strip has no heading at all and is deliberately left that way: a
 * band with no opening is a rest between species, and the run reads better for
 * it.
 *
 * No 'use client' — this renders markup and nothing else, so it works inside the
 * server components and the client ones alike.
 *
 * ── A FOURTH SPECIES, added by the shop council ─────────────────────────────
 *
 *   masthead  — a page's own opening, not a section's: a label, a statement-scale
 *               heading, a standfirst, and a row of figures about the page.
 *
 * It is declared rather than invented. `/shop` already had one — hand-rolled,
 * and drifted three values off the statement it resembles (`leading-[0.92]` for
 * `1.0`, no `font-light`, no `text-balance`) — which is character-for-character
 * the drift this file exists to end. A page masthead is genuinely not a section
 * opening: it names the page, it carries figures about the whole catalogue, and
 * it is the only header on its page, so Law 05's "never twice running" cannot
 * apply to it. Declaring it is the difference between a system and drift.
 *
 * Its label is set in the BODY face, not mono. Law 03 — mono carries a number,
 * a time, a count or a coordinate, never a sentence — and a masthead label is a
 * clause ("Made to order · Printed in Dehradun"), not a figure. The `figures`
 * row beneath it is mono, because that row is nothing but figures.
 */
export type HeaderSpecies = 'stamp' | 'statement' | 'index' | 'masthead'

export default function SectionHeader({
  species,
  eyebrow,
  no,
  title,
  lede,
  figures,
  aside,
  as,
  ground = 'paper',
  className = '',
}: {
  species: HeaderSpecies
  /** The heading element. A section opens with an h2; a page masthead is the
   *  page's h1. Defaults to h2, so the ten existing call sites are untouched. */
  as?: 'h1' | 'h2'
  /** masthead only: the mono row of figures about the page — a count, a price
   *  range. Figures only; a sentence here is a Law 03 failure. */
  figures?: ReactNode
  /** The mono label. A stamp prints it; an index prints it at the far end of
   *  the rule; a statement has none by definition. */
  eyebrow?: ReactNode
  /** The chapter number an index draws on its rule. */
  no?: string
  title: ReactNode
  /** The standfirst under the heading. */
  lede?: ReactNode
  /** What sits at the far end of the header — in practice, a link out. */
  aside?: ReactNode
  ground?: 'paper' | 'sand' | 'ink'
  className?: string
}) {
  const onInk = ground === 'ink'
  const onSand = ground === 'sand'
  // Explicit tokens per ground, every one measured against the ground it sits
  // on. `sand` is the paper ladder's fourth step (L* 60) and it needs its own
  // row: `--mid`, which carries the lede on the three lighter papers, measures
  // only 2.46:1 there and `--forest` 4.07:1 — both under AA. `--forest-deep` is
  // 4.88:1 and `--text` 5.76:1, so the darker pair takes over.
  const eyebrowTone = onInk ? 'text-sage-lit' : onSand ? 'text-forest-deep' : 'text-forest'
  const titleTone = onInk ? 'text-paper' : 'text-text'
  const ledeTone = onInk ? 'text-paper/75' : onSand ? 'text-forest-deep' : 'text-mid'
  const ruleTone = onInk ? 'border-paper/25' : onSand ? 'border-forest-deep/30' : 'border-rule'
  const Heading = as ?? 'h2'

  if (species === 'masthead') {
    return (
      // No bottom margin, unlike the three section species. A masthead is the
      // only thing in its band, so the band's own padding owns the space below
      // it — and a hardcoded `mb-10 md:mb-12` here cannot be overridden from a
      // call site anyway: `className` is concatenated as a raw string, and it is
      // generated source order, not string order, that decides which wins. A
      // caller passing `mb-0` loses to `md:mb-12` at every width above 768,
      // because Tailwind emits media-query rules last. (Shipped that way for one
      // screenshot: 96px of dead ground under the figures row.)
      <header className={className}>
        {eyebrow && (
          <p className={`font-body text-[11px] font-medium uppercase tracking-[0.12em] ${eyebrowTone}`}>
            {eyebrow}
          </p>
        )}
        {/* leading-[1.0], not 0.92. next/font derives the real Fraunces metrics
            — ascent 84.71%, descent 22.09% — so the face's ink box is 106.8% of
            the em, and a 0.92 line box is 14.8% shorter than the letters it
            holds. On a phone, where this heading breaks to two lines, the
            descender of the p in DEWDROPZ crossed the cap-height of the line
            below it. `text-balance` so the break is chosen, not landed on. */}
        <Heading
          className={`mt-3 max-w-[18ch] text-balance font-display font-light text-[clamp(38px,5.5vw,68px)] leading-[1.0] ${titleTone}`}
        >
          {title}
        </Heading>
        {lede && (
          <p className={`mt-4 max-w-measure-prose font-body text-[15px] leading-relaxed md:text-base ${ledeTone}`}>
            {lede}
          </p>
        )}
        {figures && (
          <div
            className={`mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[11px] uppercase tabular-nums tracking-[0.12em] ${ledeTone}`}
          >
            {figures}
          </div>
        )}
        {aside && <div className="mt-6">{aside}</div>}
      </header>
    )
  }

  if (species === 'statement') {
    return (
      <header className={`mb-12 md:mb-16 ${className}`}>
        {/* No eyebrow, on purpose: a statement that needs a label announcing it
            is not a statement. Roughly twice the stamp's scale — this is the
            heading doing the arguing. */}
        <Heading
          className={`max-w-[18ch] text-balance font-display font-light text-[clamp(34px,5.4vw,68px)] leading-[1.0] ${titleTone}`}
        >
          {title}
        </Heading>
        {lede && (
          <p className={`mt-6 max-w-measure-prose font-body text-[15px] leading-relaxed md:text-base ${ledeTone}`}>
            {lede}
          </p>
        )}
        {aside && <div className="mt-8">{aside}</div>}
      </header>
    )
  }

  if (species === 'index') {
    return (
      <header className={`mb-12 md:mb-16 ${className}`}>
        {/* The rule runs the full measure, which is the point of this species:
            it is the one place a visitor can see the width the whole page is
            built on. The number is mono because it is a number. */}
        <div className={`flex flex-wrap items-baseline gap-x-6 gap-y-3 border-t pt-5 ${ruleTone}`}>
          {no && (
            <span className={`font-mono text-[11px] tabular-nums tracking-[0.12em] ${eyebrowTone}`}>{no}</span>
          )}
          {/* `min-w-[18ch]` is load-bearing. `flex-1` alone lets a long eyebrow
              on the same line compress the heading to a ribbon — inside a
              half-width grid column "One email a month. Actually worth
              opening." came out as five stacked words beside an empty half of
              the band. With a floor the eyebrow wraps to its own line instead,
              and the heading keeps its measure. */}
          <Heading
            className={`min-w-[18ch] flex-1 text-balance font-display font-light text-[clamp(26px,3.4vw,42px)] leading-[1.06] ${titleTone}`}
          >
            {title}
          </Heading>
          {eyebrow && (
            <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${eyebrowTone}`}>{eyebrow}</span>
          )}
        </div>
        {(lede || aside) && (
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            {lede && (
              <p className={`max-w-measure-prose font-body text-sm leading-relaxed md:text-[15px] ${ledeTone}`}>
                {lede}
              </p>
            )}
            {aside}
          </div>
        )}
      </header>
    )
  }

  return (
    <header className={`mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between md:mb-12 ${className}`}>
      <div>
        {eyebrow && (
          <p className={`font-mono text-[10px] uppercase tracking-[0.2em] ${eyebrowTone}`}>{eyebrow}</p>
        )}
        <Heading className={`mt-2 text-balance font-display text-[clamp(28px,4vw,44px)] leading-[1.06] ${titleTone}`}>
          {title}
        </Heading>
        {lede && (
          <p className={`mt-3 max-w-measure-prose font-body text-sm leading-relaxed md:text-[15px] ${ledeTone}`}>
            {lede}
          </p>
        )}
      </div>
      {aside}
    </header>
  )
}
