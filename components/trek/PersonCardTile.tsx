import Link from 'next/link'
import type { PersonSummary } from '@/actions/trekBuddy'

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
 * Initials, drawn rather than photographed.
 *
 * The board has no profile pictures — a deliberate call, see migration 057 —
 * but a wall of text rows does not read as people either. A monogram gives each
 * card a face-shaped anchor to scan by, and the ring around a mentor's is the
 * only decoration on the page that means something.
 */
function Monogram({ name, mentor }: { name: string; mentor: boolean }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <span
      aria-hidden="true"
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-base ${
        mentor
          ? 'bg-forest text-paper ring-2 ring-clay ring-offset-2 ring-offset-white'
          : 'bg-forest/10 text-forest'
      }`}
    >
      {initials || '·'}
    </span>
  )
}

// One person, as a card you would actually click.
//
// What a stranger needs to decide "would I walk with them" is: how much they
// have done, whether anyone vouches for them, how fast they go, and whether
// they set off from anywhere near you. Those four, and nothing else — the
// counted ones in mono because the board can prove them, the rest in body text
// because the person typed them.
export default function PersonCardTile({ person }: { person: PersonSummary }) {
  const been = person.walksHosted + person.walksJoined

  return (
    <Link
      href={`/trek-buddy/people/${person.userId}`}
      className="group flex h-full flex-col gap-3 rounded-sm border border-rule bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/50 hover:shadow-[0_10px_30px_-18px_rgba(12,16,13,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      <div className="flex items-start gap-3.5">
        <Monogram name={person.displayName} mentor={person.mentor} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="font-display text-lg leading-tight text-text">{person.displayName}</h3>
            {person.mentor && (
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-clay">
                Mentor
              </span>
            )}
          </div>
          <p className="mt-0.5 font-body text-xs text-mid">
            {person.homeBase ?? 'Somewhere near'}
            {person.experience && ` · ${EXPERIENCE_LABEL[person.experience] ?? person.experience}`}
            {person.yearsOut ? ` · ${person.yearsOut}y out` : ''}
          </p>
        </div>
      </div>

      {person.intro && (
        <p className="line-clamp-2 font-body text-sm leading-relaxed text-mid">{person.intro}</p>
      )}

      {/* What they go out for. The card never showed this, which made it the
          one field the profile preview could not reflect — and it is ranked
          first by the completeness meter, so the page was asking for the thing
          it then refused to show. */}
      {person.activities.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {person.activities.slice(0, 4).map((a) => (
            <li
              key={a}
              className="rounded-full border border-rule px-2.5 py-0.5 font-body text-[11px] capitalize text-mid"
            >
              {a.replace(/_/g, ' ')}
            </li>
          ))}
          {person.activities.length > 4 && (
            <li className="self-center font-mono text-[10px] text-mid/70">
              +{person.activities.length - 4}
            </li>
          )}
        </ul>
      )}

      {/* The counted half. Mono and tabular because these are readings, not
          claims — the difference between them and the line above is the whole
          trust model of this board. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-3">
        <Stat n={been} label={been === 1 ? 'walk' : 'walks'} />
        <Stat n={person.walksHosted} label="hosted" dim={person.walksHosted === 0} />
        <Stat n={person.vouches} label="vouched" dim={person.vouches === 0} />
        {person.pace && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-mid">
            {PACE_SHORT[person.pace] ?? person.pace}
          </span>
        )}
      </div>
    </Link>
  )
}

function Stat({ n, label, dim }: { n: number; label: string; dim?: boolean }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={`font-mono text-sm tabular-nums ${dim ? 'text-mid/50' : 'text-text'}`}>
        {n}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-mid">{label}</span>
    </span>
  )
}
