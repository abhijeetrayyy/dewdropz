import Link from 'next/link'
import type { MyTrekCard } from '@/actions/trekBuddy'
import { EXPERIENCE_LABEL } from './PersonCardTile'

/**
 * You, in the header of every Trek Buddy page.
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
 */
export default function YouCard({ me }: { me: MyTrekCard }) {
  const been = me.walksHosted + me.walksJoined
  const complete = me.done === me.total

  const initials = me.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <Link
      href="/trek-buddy/profile"
      className="group block rounded-sm border border-paper/15 bg-ink/45 p-5 backdrop-blur-md transition-colors duration-300 hover:border-sage/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40">You</p>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper/40 transition-colors group-hover:text-sage">
          Edit →
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-base ${
            me.mentor ? 'bg-sage text-ink ring-2 ring-clay ring-offset-2 ring-offset-ink' : 'bg-sage/20 text-sage'
          }`}
        >
          {initials || '·'}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-xl leading-tight text-paper">{me.displayName}</p>
          <p className="mt-0.5 font-body text-[11px] text-paper/50">
            {me.homeBase ?? 'No home base yet'}
            {me.experience ? ` · ${EXPERIENCE_LABEL[me.experience] ?? me.experience}` : ''}
            {me.yearsOut ? ` · ${me.yearsOut}y` : ''}
          </p>
        </div>
      </div>

      {/* The counted half, same three figures the board shows strangers about
          you. Seeing your own zeros is the honest version of a nudge. */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-paper/12 pt-3.5">
        {[
          [been, been === 1 ? 'walk' : 'walks'],
          [me.walksHosted, 'hosted'],
          [me.vouches, 'vouched'],
        ].map(([n, label]) => (
          <div key={label as string}>
            <p className={`font-mono text-lg leading-none tabular-nums ${n ? 'text-paper' : 'text-paper/30'}`}>
              {n as number}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-paper/40">
              {label as string}
            </p>
          </div>
        ))}
      </div>

      {/* The meter. Segments rather than a bar, because seven discrete things
          you can go and do reads as a checklist; a smooth percentage reads as
          a game. */}
      <div className="mt-4 border-t border-paper/12 pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/40">
            Your profile
          </p>
          <p className="font-mono text-[10px] tabular-nums text-paper/55">
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

        <p className="mt-2.5 font-body text-[11px] leading-snug text-paper/55">
          {complete ? (
            <>Nothing missing. This is what a stranger sees before asking to walk with you.</>
          ) : (
            <>
              <span className="text-sage">Next:</span> {me.nextUp?.prompt}.
            </>
          )}
        </p>
      </div>
    </Link>
  )
}
