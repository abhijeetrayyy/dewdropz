import { HOUR_BANDS, dotColor } from '@/lib/trek'

// The whole product, in five nodes.
//
// Ask → Confirmed → Point released → Walked → Vouched. That sequence is what
// Trek Buddy actually *is*, and it was drawn nowhere: each stage lived on a
// different screen, described in a different paragraph, and a member had no way
// to know where they stood or what happens next. A person who cannot see the
// loop cannot trust it, and a person who cannot trust it does not get in a car
// at 4am with strangers.
//
// Rendered small in a rail on the plan page, wide on the signed-out landing,
// and inline on a member's own row in Basecamp. Same five nodes every time —
// which is the point, because the ladder is only reassuring if it is the same
// ladder each time you look at it.

export type JourneyStage = 'none' | 'asked' | 'confirmed' | 'released' | 'walked' | 'vouched'

const STAGES: { key: JourneyStage; label: string; note: string }[] = [
  { key: 'asked',     label: 'Asked',      note: 'you have put your name in' },
  { key: 'confirmed', label: 'Confirmed',  note: 'the host said yes' },
  { key: 'released',  label: 'Point',      note: 'the exact spot reaches you' },
  { key: 'walked',    label: 'Walked',     note: 'it happened' },
  { key: 'vouched',   label: 'Vouched',    note: 'you said so, for each other' },
]

const ORDER: JourneyStage[] = ['none', 'asked', 'confirmed', 'released', 'walked', 'vouched']

export default function JourneyRail({
  stage,
  ground = 'light',
  showNotes = false,
  layout = 'row',
  className = '',
}: {
  stage: JourneyStage
  ground?: 'light' | 'dark'
  showNotes?: boolean
  /**
   * `row` lays the five nodes left to right and needs real width for the
   * labels. `stack` runs them down the page, one per line.
   *
   * WHY THE STACK EXISTS. In the plan page's sidebar this rail gets about
   * 190px, which is 38px per node — and "Confirmed" is 69px at 10px type and
   * 76px at 11px. The labels overflowed their columns with `overflow: visible`
   * and painted over each other: the second and third nodes rendered as the
   * single word "CONFIRMEDINT". No type size fits five of these words into
   * 190px, so the narrow case does not try. It is the same five nodes in the
   * same order, turned ninety degrees, which is also easier to read.
   */
  layout?: 'row' | 'stack'
  className?: string
}) {
  const at = ORDER.indexOf(stage)
  const dark = ground === 'dark'
  const stacked = layout === 'stack'

  return (
    <ol
      className={`flex ${stacked ? 'flex-col' : ''} ${className}`}
      aria-label="Where this walk has got to"
    >
      {STAGES.map((s, i) => {
        const idx = ORDER.indexOf(s.key)
        const done = at >= idx
        const current = at === idx
        // The nodes take the day's own colours in order, so the ladder is
        // also a sunrise — the same idea the board is built on, reused.
        const band = HOUR_BANDS[i]
        const fill = done ? dotColor(band, dark ? 'dark' : 'light') : 'transparent'

        return (
          <li
            key={s.key}
            className={
              stacked
                ? 'flex min-w-0 items-start gap-3'
                : 'flex min-w-0 flex-1 flex-col gap-2'
            }
          >
            <div className={stacked ? 'flex flex-col items-center self-stretch' : 'flex items-center'}>
              <span
                aria-hidden="true"
                className="grid h-2.5 w-2.5 shrink-0 place-items-center rounded-full transition-colors duration-300"
                style={{
                  background: fill,
                  boxShadow: `0 0 0 ${current ? 3 : 1}px ${
                    done
                      ? fill === 'transparent'
                        ? 'transparent'
                        : `${fill}${current ? '55' : ''}`
                      : dark
                        ? 'rgba(248,245,237,0.28)'
                        : 'var(--rule-warm)'
                  }`,
                }}
              />
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`flex-1 transition-colors duration-300 ${
                    stacked ? 'my-1 w-px min-h-[14px]' : 'h-px'
                  }`}
                  style={{
                    background: at > idx
                      ? fill
                      : dark
                        ? 'rgba(248,245,237,0.18)'
                        : 'var(--rule)',
                  }}
                />
              )}
            </div>
            <div className={`min-w-0 ${stacked ? 'pb-3' : 'pr-2'}`}>
              <span
                className={`trek-label-xs block leading-none ${
                  done
                    ? dark ? 'text-paper' : 'text-text'
                    // A stage you have not reached is still the NAME of a
                    // stage — it is how somebody reads what the loop is. At
                    // --light it measured 3.25:1 at 10px. The hollow dot and
                    // the grey connector already say "not yet"; the word does
                    // not have to be hard to read as well.
                    : dark ? 'text-paper/60' : 'text-mid'
                }`}
              >
                {s.label}
              </span>
              {showNotes && (
                <span
                  className={`mt-1.5 block font-body text-[11px] leading-snug ${
                    dark ? 'text-paper/55' : 'text-mid'
                  }`}
                >
                  {s.note}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
