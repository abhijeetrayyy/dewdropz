import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'
import BoardFilters from './BoardFilters'

// The way in.
//
// It used to be the storefront's editorial page header — a dark band with a
// serif title in the middle and nothing else, then a form-ish column below. That
// template is right for /about, where the job is to be read. It is wrong here,
// where the job is to answer three questions in the first second: is anything
// happening, where, and can I get on it.
//
// So the header does the work instead of announcing the page. The search and
// the filters live inside it, the counts are real, and the photograph is two
// people leaving the treeline by headlamp — the same frame the homepage opens
// on, which is the closest thing this brand has to a picture of the product.
export default function TrekHero({
  counts,
  openCount,
  canHost,
  active,
}: {
  counts: Record<string, number>
  openCount: number
  canHost: boolean
  /** Which of the three Trek Buddy pages you are on. */
  active: 'board' | 'people' | 'yours' | 'new'
}) {
  const tabs = [
    { key: 'board', label: 'The board', href: '/trek-buddy' },
    { key: 'people', label: 'Who is out there', href: '/trek-buddy/people' },
    { key: 'yours', label: 'Yours', href: '/trek-buddy/yours' },
    ...(canHost ? [{ key: 'new', label: 'Post a walk', href: '/trek-buddy/new' }] : []),
  ]

  return (
    <header className="relative isolate overflow-hidden bg-ink">
      <Image
        src={DAY_ARC.theStart}
        alt=""
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        className="object-cover object-center opacity-80"
      />
      {/* The photograph is already dark — two figures leaving the treeline by
          headlamp — so the wash only has to carry type, not create the mood. A
          heavier gradient crushed it to a black rectangle and the picture may as
          well not have been there. Vertical for legibility at the top and
          bottom, plus a left-weighted pass so the headline has something solid
          behind it while the right of the frame stays open. */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/25 to-ink/85" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/20 to-transparent" />

      <div className="relative mx-auto max-w-5xl px-6 pb-8 pt-32 md:px-10 md:pt-36">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-sage">
          Trek Buddy · Dehradun and around
        </p>

        <h1 className="mt-4 max-w-xl font-display text-[clamp(32px,5.2vw,54px)] font-light leading-[0.98] text-paper">
          Never go <span className="italic text-sage">alone.</span>
        </h1>

        <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-paper/70">
          {openCount === 0
            ? 'Nobody has posted a walk yet. When they do, this is where you will find them.'
            : `${openCount} walk${openCount === 1 ? '' : 's'} on the board right now. Ask to come, and the host decides.`}
        </p>

        {/* The three pages, named. Somebody arriving should be able to see the
            whole shape of this thing without clicking to find out. */}
        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-paper/15 pb-3">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active === t.key ? 'page' : undefined}
              className={`relative pb-2 font-body text-[11px] uppercase tracking-[0.14em] transition-colors ${
                active === t.key ? 'text-paper' : 'text-paper/50 hover:text-paper/85'
              }`}
            >
              {t.label}
              {active === t.key && (
                <span aria-hidden="true" className="absolute -bottom-[13px] left-0 h-px w-full bg-sage" />
              )}
            </Link>
          ))}
        </nav>

        {active === 'board' && (
          <div className="mt-6">
            <BoardFilters counts={counts} tone="dark" />
          </div>
        )}
      </div>
    </header>
  )
}
