import type { Guidance as Note } from '@/actions/trekBuddy'
import { SectionLabel } from './ui/Bits'

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'For anyone going',
  women: 'If you are a woman joining a group',
  first_time: 'If this is your first one',
  host: 'If you are hosting',
}

// Who a note is for, drawn rather than only stated.
//
// The rails used to be sage, dawn, clay and ember, and two of those four are no
// longer available for this. Amber on this board means exactly one thing — a
// clock is running, a walk is about to leave — and neither "if this is your
// first one" nor "if you are hosting" is that; a first-timer reading a note
// days before a walk is the calmest reader on the product, and marking their
// column with a warning lamp told them the opposite. The dawn and ember rails
// also collided: two of the four audiences were carrying the same hue, which
// meant the rail stopped identifying anything.
//
// The four are now sage, slate, clay and forest — four rails a reader can tell
// apart at a glance, each keeping the meaning it has elsewhere. Sage is the
// general trust colour. Slate is the product's quiet, pre-dawn colour and it
// suits the person who has not done this before. Clay is already the
// women-only and mentor colour everywhere else. Forest is the act, which is
// what hosting is. Nothing here invents a fifth meaning for a hue.
const AUDIENCE_TONE: Record<string, { rail: string; ink: string; inkDark: string }> = {
  all:        { rail: 'var(--sage)',   ink: 'text-forest',    inkDark: 'text-sage' },
  first_time: { rail: 'var(--slate)',  ink: 'text-slate',     inkDark: 'text-slate-soft' },
  women:      { rail: 'var(--clay)',   ink: 'text-clay-deep', inkDark: 'text-clay' },
  host:       { rail: 'var(--forest)', ink: 'text-forest',    inkDark: 'text-sage' },
}

// What somebody who has done this for years would tell you.
//
// Not a safety page. A safety page is a thing you link to and nobody opens;
// this is the same knowledge broken into pieces small enough to sit at the
// moment each one applies — the descent note on the walk you are about to
// join, the host note in the composer, the women note where a woman is
// deciding whether to ask.
//
// Grouped by who it is for, and the group heading says so plainly, because
// "For anyone going" and "If you are a woman joining a group" are different
// promises and running them together makes both weaker.
//
// WHY THE RULED LIST BECAME AN ACCORDION. The old note said a grid of boxes
// turns reading into scanning, and that was right about a grid of boxes. What
// it produced instead was up to forty title-and-paragraph pairs in one
// unbroken ruled column — `getGuidance` has no default lower than forty — which
// on a plan page arrived directly after the walk's own description and buried
// everything under it. Nobody reads forty. They read the two that apply to
// them, which is exactly what the audience grouping already knew.
//
// So the title becomes the thing you scan and the body opens under it, the
// first two are already open so the block is never a wall of closed lids, and
// each group sits against a coloured rail carrying the audience's own colour.
// Every note is still here, at full length, in the same order, grouped the
// same way. What changed is that the block now costs four lines of attention
// instead of forty.
//
// WHAT CHANGED IN THIS PASS. The block's own heading and the four audience
// headings were 10px monospace at 0.22em and 0.2em — mono is now rationed to
// figures, and a heading is not one, so they take `trek-label` and the shared
// `SectionLabel` stamp like every other section on the product. The disclosure
// affordance was a monospace arrow; it is the ruled "+" the landing page's
// questions already use, so an accordion looks like an accordion wherever you
// meet one here. And the focus ring moved off dawn onto sage.
export default function Guidance({
  notes,
  title = 'What people who have done this know',
  intro,
  tone = 'paper',
}: {
  notes: Note[]
  title?: string
  intro?: string
  tone?: 'paper' | 'dark'
}) {
  if (!notes.length) return null

  const dark = tone === 'dark'
  const groups = (['all', 'first_time', 'women', 'host'] as const)
    .map((a) => [a, notes.filter((n) => n.audience === a)] as const)
    .filter(([, ns]) => ns.length > 0)

  // The first two in render order start open. Counted across the whole block
  // rather than per group, so a page with four audiences does not open eight
  // notes and undo the point.
  const openIds = new Set(
    groups
      .flatMap(([, ns]) => ns)
      .slice(0, 2)
      .map((n) => n.id)
  )

  return (
    <section className={dark ? 'text-paper' : 'text-text'}>
      <div className="flex items-baseline gap-3.5">
        <SectionLabel tone={dark ? 'ondark' : 'quiet'}>{title}</SectionLabel>
        <span
          aria-hidden="true"
          className={`h-px flex-1 ${dark ? 'bg-paper/15' : 'bg-rule'}`}
        />
        <span
          className={`font-mono text-[13px] leading-none tabular-nums ${
            dark ? 'text-paper/55' : 'text-mid'
          }`}
        >
          {notes.length}
        </span>
      </div>

      {intro && (
        <p
          className={`mt-3 font-body text-[13.5px] leading-relaxed ${
            dark ? 'text-paper/65' : 'text-mid'
          }`}
        >
          {intro}
        </p>
      )}

      <div className="mt-6 space-y-7">
        {groups.map(([audience, ns]) => {
          const t = AUDIENCE_TONE[audience]
          return (
            <div key={audience} className="border-l-2 pl-5" style={{ borderColor: t.rail }}>
              <p className={`trek-label ${dark ? t.inkDark : t.ink}`}>
                {AUDIENCE_LABEL[audience]}
              </p>

              <div className="mt-3 space-y-2">
                {ns.map((n) => (
                  <details
                    key={n.id}
                    open={openIds.has(n.id)}
                    className={`group rounded-[var(--r-card)] border px-4 py-3 transition-colors duration-200 ${
                      dark
                        ? 'border-paper/12 bg-paper/[0.04] hover:border-paper/25'
                        : 'border-rule-soft bg-surface hover:border-rule'
                    }`}
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage [&::-webkit-details-marker]:hidden">
                      <span
                        className={`font-body text-[15px] font-medium leading-snug ${
                          dark ? 'text-paper' : 'text-text'
                        }`}
                      >
                        {n.title}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[15px] leading-none transition-transform duration-200 group-open:rotate-45 ${
                          dark ? 'border-paper/25 text-paper/60' : 'border-rule text-mid'
                        }`}
                      >
                        +
                      </span>
                    </summary>
                    <p
                      className={`mt-2.5 max-w-2xl font-body text-[14px] leading-relaxed ${
                        dark ? 'text-paper/65' : 'text-mid'
                      }`}
                    >
                      {n.body}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
