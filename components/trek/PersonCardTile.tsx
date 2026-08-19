import Link from 'next/link'
import type { PersonSummary } from '@/actions/trekBuddy'
import Avatar from './ui/Avatar'
import FollowButton from './FollowButton'
import { Datum } from './ui/Bits'

export const EXPERIENCE_LABEL: Record<string, string> = {
  new: 'New to this',
  some: 'Been out a few times',
  seasoned: 'Seasoned',
  veteran: 'Years of it',
}

const PACE_SHORT: Record<string, string> = {
  steady: 'Steady', brisk: 'Brisk', fast: 'Fast',
}

/**
 * The three rungs of migration 062, named the way the profile already names
 * them. Copied from `TrustCard` rather than reworded, because a member who has
 * read "Phone verified" on their own page must find the same two words on
 * somebody else's or the ladder stops being one ladder.
 */
export const TRUST_RUNG_LABEL = ['Joined', 'Phone verified', 'Vouched for'] as const

/**
 * The rung, as three pips.
 *
 * Not a score and not a badge — a ladder with a top, drawn so you can see how
 * far up it somebody is AND how far up it goes. That second half is the reason
 * it is pips and not a tick: a tick implies a finished check, and this board
 * does not finish any check on anybody.
 */
export function TrustPips({
  rung,
  ground = 'light',
  showLabel = true,
  className = '',
}: {
  rung: number | null | undefined
  ground?: 'light' | 'dark'
  showLabel?: boolean
  className?: string
}) {
  if (rung == null) return null
  const label = TRUST_RUNG_LABEL[Math.min(Math.max(rung, 0), 2)]
  const on = ground === 'dark' ? '#7BA46F' : 'var(--forest)'
  const off = ground === 'dark' ? 'rgba(248,245,237,0.22)' : 'var(--rule)'

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 ${className}`}
      title={`Trust rung ${rung} of 2 — ${label}`}
    >
      <span aria-hidden="true" className="flex items-center gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-[5px] w-[5px] rounded-full"
            style={{ background: i <= rung ? on : off }}
          />
        ))}
      </span>
      {/* Sentence case, in the body face. This was 9px mono at 0.14em, which
          made a state — the rung somebody is standing on — read as a machine
          stamp; mono is for figures here, and "Vouched for" is not one. */}
      <span
        className={`font-body text-[11px] font-medium leading-none ${
          ground === 'dark' ? 'text-paper/70' : 'text-mid'
        } ${showLabel ? '' : 'sr-only'}`}
      >
        {label}
      </span>
    </span>
  )
}

// One person, as a card you would actually click.
//
// The old card was a link wrapping four lines of text. Three things are
// different, and each of them was a gap the overhaul named:
//
//   A FACE. The 52px avatar is the same disc this person wears on the board,
//     in a roster and in a chat — same tint, same initials, hashed off their
//     id — so you recognise somebody across screens without reading a name.
//   AN ACT. Follow now happens here, not two clicks away on their profile.
//     Which is why the card is no longer an <a>: a button inside a link is
//     invalid and, worse, unusable. The name carries a stretched link instead,
//     so the whole card is still one target and the follow pill sits above it.
//   TWO KINDS OF FACT, DRAWN AS TWO KINDS OF THING. This is the whole trust
//     model of the board, and until now it was carried by a hairline and by
//     nothing else — the intro, the pace and the walk count were all grey text
//     at roughly one weight, so a claim and a count looked alike.
//
//     What a person TYPED now sits inside a paper-warm panel with its own
//     stamp: their line about themselves, the pace they say they walk at, how
//     much of this they say they have done. It is tinted because a tint is the
//     cheapest possible way to say "these are somebody's own words", and a
//     reader takes it in before reading anything.
//
//     What the board COUNTED sits below the rule as instrument figures —
//     `Datum`, the same component the plan facts and the board counts use, so
//     a walk count on a person reads as the same species of number as a
//     distance on a walk. It used to be a 14px figure with a 9px mono unit
//     beside it, invented here; there is no reason for this screen to have its
//     own idea of what a number looks like.
//
//     The old dawn hover edge is gone with it. Amber on this board means a
//     clock is running, and hovering a person is not an emergency.
export default function PersonCardTile({
  person,
  following = false,
  streak = 0,
  showFollow = false,
  kindLabel,
}: {
  // The profile composer previews an unsaved form as a card, and a form has no
  // trust rung — so the card takes a summary whose rung may simply be absent
  // and draws no ladder rather than inventing a rung to draw.
  person: Omit<PersonSummary, 'trustRung'> & { trustRung?: number | null }
  /** Whether the viewer already follows them. Read once for the whole page. */
  following?: boolean
  /** Weeks out in a row. Zero is not rendered — see the streak comment below. */
  streak?: number
  /** Off on your own card and in the composer preview: neither can be followed. */
  showFollow?: boolean
  /** From the kinds table (057). Without it a kind an admin added last week
      renders as its raw key, which is what the directory used to do. */
  kindLabel?: Record<string, string>
}) {
  const walks = person.walksHosted + person.walksJoined
  const href = `/trek-buddy/people/${person.userId}`

  // The claims, as keyed facts rather than as one run-on chip. "Steady · 4y
  // out" needed a reader to work out which half was which; a walker deciding
  // whether they will be left behind should not have to.
  const claims: { k: string; v: string }[] = []
  if (person.pace) claims.push({ k: 'Pace', v: PACE_SHORT[person.pace] ?? person.pace })
  if (person.experience) {
    claims.push({ k: 'Done', v: EXPERIENCE_LABEL[person.experience] ?? person.experience })
  }
  if (person.yearsOut) {
    claims.push({ k: 'Out for', v: `${person.yearsOut} year${person.yearsOut === 1 ? '' : 's'}` })
  }

  return (
    <article className="trek-row trek-liftable group relative flex h-full w-full flex-col gap-3.5 p-[22px] hover:border-rule-warm">
      <div className="flex items-start gap-3.5">
        {/* No href of its own: the whole card is already one target, and a
            second link to the same page is an extra tab stop that announces
            the same name twice. */}
        <Avatar
          name={person.displayName}
          id={person.userId}
          size={52}
          role={person.mentor ? 'mentor' : 'none'}
        />

        <div className="min-w-0 flex-1">
          <h3 className="trek-h3 text-text">
            {/* The stretched link: the name is the real target, the pseudo
                element makes the card one. */}
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              {person.displayName}
            </Link>
          </h3>
          <p className="mt-1 truncate font-body text-[13px] text-mid">
            {person.homeBase ?? 'Somewhere near'}
          </p>
        </div>

        {showFollow && (
          <FollowButton
            personId={person.userId}
            personName={person.displayName}
            initialFollowing={following}
            variant="compact"
            className="relative z-10 shrink-0"
          />
        )}
      </div>

      {/* ── What they say ──────────────────────────────────────────────────
          Their words, on the warm ground the whole product uses for a thing
          somebody asserted. Nobody has checked a syllable of it, and the tint
          is how the card says so without spending a sentence on it. */}
      <div className="rounded-[var(--r-input)] border border-rule-warm bg-paper-warm px-3.5 py-3">
        <p className="trek-label-xs text-mid">In their words</p>

        {person.intro ? (
          <p className="mt-2 line-clamp-3 font-body text-[13px] leading-relaxed text-text">
            {person.intro}
          </p>
        ) : (
          <p className="mt-2 font-body text-[13px] leading-relaxed text-mid">
            They have not written an intro yet.
          </p>
        )}

        {claims.length > 0 && (
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {claims.map((c) => (
              <div key={c.k}>
                <dt className="trek-label-xs text-mid">{c.k}</dt>
                <dd className="mt-1 font-body text-[13px] leading-none text-text">{c.v}</dd>
              </div>
            ))}
          </dl>
        )}

        {person.activities.length > 0 && (
          <ul className="mt-3 flex flex-wrap items-center gap-1.5">
            {person.activities.slice(0, 4).map((a) => (
              <li
                key={a}
                className="rounded-[var(--r-tag)] border border-rule-warm bg-surface px-2 py-[3px] font-body text-[11px] leading-[1.4] capitalize text-mid"
              >
                {kindLabel?.[a] ?? a.replace(/_/g, ' ')}
              </li>
            ))}
            {person.activities.length > 4 && (
              <li className="font-mono text-[11px] text-mid tabular-nums">
                +{person.activities.length - 4}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ── What the board counted ─────────────────────────────────────── */}
      <div className="mt-auto border-t border-rule-soft pt-3.5">
        <p className="trek-label-xs text-mid">Counted by the board</p>
        <div className="mt-2.5 flex flex-wrap items-end gap-x-6 gap-y-3">
          <Datum k={walks === 1 ? 'walk' : 'walks'} v={walks} size="sm" />
          <Datum k={person.vouches === 1 ? 'vouch' : 'vouches'} v={person.vouches} size="sm" />
          {/* Only while it is running. "0 weeks in a row" turns a nice thing
              into a reproach, and this row is evidence, not a scoreboard. */}
          {streak > 0 && <Datum k="weeks running" v={streak} size="sm" />}
          <TrustPips rung={person.trustRung} className="ml-auto pb-1" />
        </div>
      </div>
    </article>
  )
}
