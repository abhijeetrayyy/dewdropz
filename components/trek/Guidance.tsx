import type { Guidance as Note } from '@/actions/trekBuddy'

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'For anyone going',
  women: 'If you are a woman joining a group',
  first_time: 'If this is your first one',
  host: 'If you are hosting',
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

  return (
    <section className={dark ? 'text-paper' : 'text-text'}>
      <h2
        className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
          dark ? 'text-paper/45' : 'text-mid'
        }`}
      >
        {title}
      </h2>
      {intro && (
        <p className={`mt-2 font-body text-sm leading-relaxed ${dark ? 'text-paper/65' : 'text-mid'}`}>
          {intro}
        </p>
      )}

      <div className="mt-6 space-y-8">
        {groups.map(([audience, ns]) => (
          <div key={audience}>
            {groups.length > 1 && (
              <p
                className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                  audience === 'women'
                    ? dark ? 'text-clay' : 'text-clay'
                    : dark ? 'text-sage' : 'text-forest'
                }`}
              >
                {AUDIENCE_LABEL[audience]}
              </p>
            )}

            {/* A ruled list rather than cards. These are things to read, and a
                grid of boxes turns reading into scanning. */}
            <dl className={`mt-3 divide-y ${dark ? 'divide-paper/12' : 'divide-rule'}`}>
              {ns.map((n) => (
                <div key={n.id} className="py-4 first:pt-0 sm:flex sm:gap-8">
                  <dt
                    className={`font-body text-sm sm:w-56 sm:shrink-0 ${
                      dark ? 'text-paper' : 'text-text'
                    }`}
                  >
                    {n.title}
                  </dt>
                  <dd
                    className={`mt-1 font-body text-sm leading-relaxed sm:mt-0 ${
                      dark ? 'text-paper/60' : 'text-mid'
                    }`}
                  >
                    {n.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
