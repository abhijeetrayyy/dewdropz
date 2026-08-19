import Link from 'next/link'
import type { MyTrekCard } from '@/actions/trekBuddy'
import Avatar from './ui/Avatar'
import { Datum, SectionLabel } from './ui/Bits'
import { EXPERIENCE_LABEL } from './PersonCardTile'

/** A walk you finished with people you have not yet said anything about. */
export type VouchPrompt = {
  /** How many people, across every past walk, are still waiting to be vouched for. */
  count: number
  /** The most recent of those walks, named — a prompt about nothing is ignorable. */
  place: string
  /** Who was on it. Trimmed to two names plus a count by the sentence below. */
  names: string[]
}

/**
 * You, at the head of the Basecamp rail.
 *
 * The profile had no entry point at all — the page existed and the only ways
 * to reach it were an empty state on the directory and a footnote in the
 * composer. So on a board whose entire currency is whether a stranger will
 * spend a day with you, the one thing you control was the one thing you could
 * not find.
 *
 * It is a card rather than a nav item because a link says "there is a page"
 * and a card says "this is you, and it is thin". The meter is the working part:
 * it counts only the seven things another walker actually reads, and it names
 * the next missing one, so it reads as a prompt rather than a score.
 *
 * IT IS NO LONGER ONE BIG LINK. It was a single `<Link>` wrapping everything,
 * which was fine while it only pointed at the profile — and became wrong the
 * moment it had to carry a second act. A button inside an anchor is invalid
 * markup and unusable with a keyboard, so the card is now a panel with two
 * named doors: edit yourself, or go and write the vouches you owe.
 *
 * VOUCHES OWED are new here, and they are the reason this card is worth its
 * space on a dashboard. `getVouchable` has existed since the profile page was
 * built and was rendered at the very bottom of a long form, which is to say
 * nowhere: the one action that costs the person nothing and is worth the most
 * to somebody else was the least visible thing in the product.
 */
export default function YouCard({
  me,
  vouchPrompt,
  className = '',
}: {
  me: MyTrekCard
  /** Optional so the older callers that only ever had `me` still compile. */
  vouchPrompt?: VouchPrompt | null
  className?: string
}) {
  const been = me.walksHosted + me.walksJoined
  const complete = me.done === me.total

  return (
    <div className={`rounded-[var(--r-panel)] bg-ink p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        {/* A section stamp is allowed to be uppercase and tracked. The link
            beside it is not — it is a control, and a control set in 9px mono
            capitals asks a person to decode a word before they can press it. */}
        <SectionLabel as="p" tone="ondark">
          You
        </SectionLabel>
        <Link
          href="/trek-buddy/profile"
          className="font-body text-[13px] font-medium text-paper/65 transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
        >
          Edit your profile →
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-3.5">
        <Avatar
          name={me.displayName}
          id={me.userId}
          size={52}
          role="you"
          ground="dark"
          href={`/trek-buddy/people/${me.userId}`}
        />
        <div className="min-w-0">
          <p className="trek-h3 truncate text-paper">{me.displayName}</p>
          <p className="mt-1 font-body text-[13px] leading-snug text-paper/60">
            {me.homeBase ?? 'No home base yet'}
            {me.experience ? ` · ${EXPERIENCE_LABEL[me.experience] ?? me.experience}` : ''}
            {me.yearsOut ? ` · ${me.yearsOut} years out` : ''}
          </p>
        </div>
      </div>

      {/* The counted half, same three figures the board shows strangers about
          you. Seeing your own zeros is the honest version of a nudge. */}
      <dl className="mt-4.5 grid auto-rows-fr grid-cols-3 gap-2.5 border-t border-paper/12 pt-4">
        <Datum k={been === 1 ? 'walk' : 'walks'} v={been} tone="dark" />
        <Datum k="hosted" v={me.walksHosted} tone="dark" />
        <Datum k="vouches" v={me.vouches} tone="dark" />
      </dl>

      {/* The meter. Segments rather than a bar, because seven discrete things
          you can go and do reads as a checklist; a smooth percentage reads as
          a game. */}
      <div className="mt-4 border-t border-paper/12 pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel as="p" tone="ondark">
            Your profile
          </SectionLabel>
          <p className="font-mono text-[13px] text-paper/70 tabular-nums">
            {me.done}/{me.total}
          </p>
        </div>

        <div className="mt-2 flex gap-1" aria-hidden="true">
          {Array.from({ length: me.total }).map((_, i) => (
            <span
              key={i}
              className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${
                i < me.done ? (complete ? 'bg-sage' : 'bg-sage/80') : 'bg-paper/15'
              }`}
            />
          ))}
        </div>

        <p className="mt-3 font-body text-[13px] leading-relaxed text-paper/60">
          {complete ? (
            <>Nothing missing. This is what a stranger sees before asking to walk with you.</>
          ) : (
            <>
              <span className="font-medium text-sage">Next:</span> {me.nextUp?.prompt}.
            </>
          )}
        </p>
      </div>

      {/* Sage, because a vouch is the trust half of the product and trust is
          never amber here. Shown only when somebody is actually owed one — a
          standing prompt to do a thing you cannot do is how a dashboard
          teaches people to stop reading it. */}
      {vouchPrompt && vouchPrompt.count > 0 && (
        <div className="mt-4 border-t border-paper/12 pt-3.5">
          <p className="font-body text-[13px] leading-relaxed text-paper/65">
            <span className="font-medium text-sage">
              {vouchPrompt.count === 1 ? 'One vouch to write:' : `${vouchPrompt.count} vouches to write:`}
            </span>{' '}
            you finished {vouchPrompt.place} with {namesSentence(vouchPrompt.names)}. Say so while
            it is fresh — a vouch is the only thing on this board a stranger cannot type for
            themselves.
          </p>
          <Link
            href="/trek-buddy/profile"
            className="trek-pill trek-pill-sm mt-3.5 w-full justify-center border border-sage/45 font-body text-sage transition-colors hover:border-sage hover:bg-sage/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            Write them
          </Link>
        </div>
      )}
    </div>
  )
}

/** "Rohan and Priya", "Rohan, Priya and two others" — never a bare list of five. */
function namesSentence(names: string[]): string {
  if (names.length === 0) return 'the others'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  const rest = names.length - 2
  return `${names[0]}, ${names[1]} and ${rest} other${rest === 1 ? '' : 's'}`
}
