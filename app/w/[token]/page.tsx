import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { trekFontVars } from '@/app/trek-fonts'
import CopyLink from '@/app/e/[token]/CopyLink'
import { getSharedRecap } from '@/actions/trekRecap'
import Avatar from '@/components/trek/ui/Avatar'
import HourPill from '@/components/trek/ui/HourPill'
import { FactRow, Tag } from '@/components/trek/ui/Bits'
import { Lockup } from '@/components/trek/ui/Mark'
import { ACTIVITY_BY_KEY, DIFFICULTY_LABEL, lightForTime, type TrekActivity } from '@/lib/trek'
import { BLUR_DATA_URL } from '@/lib/constants'

// noindex, and for the same reason /e/<token> is. A host sending one person a
// link has not agreed to a permanent public record of a day, a place and the
// people who were there, discoverable by anybody who searches a first name. The
// token makes it unguessable; this keeps it out of the index; `robots.ts`
// disallows `/w/` so it is never fetched by a crawler in the first place.
export const metadata: Metadata = {
  title: 'A walk that happened — DEWDROPZ',
  robots: { index: false, follow: false, nocache: true },
}

// A walk that already happened, as something you can send somebody.
//
// Everything else this product shows a stranger is a promise about the future —
// a plan, a seat count, a countdown — and any of it could have been written by
// somebody who never left the house. This is the one page whose contents are
// evidence: a day that occurred, the distance it covered, the people who were
// there, and a paragraph written afterwards by one of them.
//
// It is the answer to the question the whole platform was failing: a member had
// literally no URL they could send a friend. The board is members-only and the
// only shareable object, the invite card, can be minted by hosts alone — and
// hosting is invite-only. So the product asked people to tell their friends
// about it and gave them nothing to send.
//
// THE SAME THREE LESSONS AS /e/[token], because they were learned the hard way:
//
//   1. OUTSIDE app/trek-buddy, so it inherits none of the shell. No top bar, no
//      footer, no navigation. The person holding this link has no account, and
//      a nav full of doors they cannot open is an argument against joining.
//   2. `.trek-scope` ON THE ROOT WRAPPER. The design tokens live on that class,
//      which the trek layout applies — a page outside it that uses the token
//      names renders in the STOREFRONT's palette and typefaces. That exact bug
//      shipped on /e/<token> once.
//   3. QUIET GROUND. The loudest surface in the product is the worst fit for
//      the screen with the least right to shout.
//
// WHAT IS NOT HERE: no meeting point — it is not in `trek_recap_card`'s column
// list and cannot arrive by accident. No user id, so no name on this page is a
// route into the member directory. No surnames.
export default async function SharedRecapPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const card = await getSharedRecap(token)
  if (!card) notFound()

  const light = lightForTime(card.start_time ?? '06:00')
  const when = new Date(card.starts_at).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const activityLabel = ACTIVITY_BY_KEY[card.activity as TrekActivity]?.label ?? card.activity

  // Figures only, same rule as the invite card: `FactRow` sets values in
  // monospace, which is right for a distance and wrong for the word "Moderate".
  const facts: { k: string; v: string }[] = [
    { k: 'Went', v: String(card.went) },
  ]
  if (card.distance_km != null) facts.push({ k: 'Distance', v: `${card.distance_km} km` })
  if (card.gain_m != null) facts.push({ k: 'Climb', v: `${card.gain_m.toLocaleString('en-IN')} m` })

  const photos = card.photo_urls ?? []

  return (
    <main className={`${trekFontVars} trek-scope flex min-h-screen flex-col bg-paper`}>
      <header className="trek-band border-b border-rule py-5">
        <div className="mx-auto w-full max-w-[920px]">
          <Lockup tone="onpaper" size="sm" />
        </div>
      </header>

      <div className="trek-band flex-1 py-12 md:py-16">
        <div className="mx-auto w-full max-w-[920px]">
          {/* Past tense, in the eyebrow, before anything else. Everything a
              stranger has ever been shown by a platform like this is an
              invitation; the first thing this page says is that it already
              happened. */}
          <p className="trek-eyebrow text-forest">This one already happened</p>

          <h1 className="trek-h1 mt-4 max-w-[18ch] text-balance text-text">{card.place}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <HourPill time={card.start_time} light={light} withLabel />
            <span className="font-body text-[14px] text-mid">
              {activityLabel} · {when}
            </span>
            <Tag tone="outline">{DIFFICULTY_LABEL[card.difficulty] ?? card.difficulty}</Tag>
          </div>

          <FactRow facts={facts} tone="light" className="mt-7" />

          {/* The words, given the width and the size of something written
              rather than the size of a caption. This paragraph is the only
              part of the page a person wrote on purpose. */}
          <blockquote className="mt-9 border-l-2 border-forest pl-5 md:pl-7">
            <p className="whitespace-pre-wrap font-body text-[17px] leading-[1.75] text-text">
              {card.body}
            </p>
            <footer className="mt-4 font-body text-[13px] text-mid">
              Written after the day, by somebody who was on it.
            </footer>
          </blockquote>

          {photos.length > 0 && (
            <ul className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((src, i) => (
                <li key={src} className="min-w-0">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--r-card)] bg-ink">
                    <Image
                      src={src}
                      alt={`From the walk to ${card.place}`}
                      fill
                      sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 92vw"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      priority={i === 0}
                      className="object-cover"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Who was there, as first names and nothing else. No avatar is
              seeded by an id here because no id was sent — see 091. */}
          {card.party.length > 0 && (
            <div className="mt-9 border-t border-rule pt-7">
              <p className="trek-label text-mid">Who went</p>
              <ul className="mt-3.5 flex flex-wrap gap-2.5">
                {card.party.map((name, i) => (
                  <li key={`${name}-${i}`}>
                    <span className="flex items-center gap-2 rounded-full border border-rule-soft bg-surface py-[5px] pl-[5px] pr-3.5">
                      <Avatar name={name} size={26} />
                      <span className="font-body text-[13px] text-text">{name}</span>
                      {i === 0 && <span className="trek-label-xs text-forest">host</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-rule pt-8">
            <Link
              href="/trek-buddy"
              className="trek-pill trek-pill-lg trek-pill-act font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              See what else is on
            </Link>
            <CopyLink path={`/w/${token}`} />
          </div>

          {/* The same limit the board states everywhere else, said to somebody
              who has just read the most flattering thing this product owns.
              A page that shows only the good day and none of the terms is an
              advertisement; this one is supposed to be evidence. */}
          <p className="mt-8 max-w-2xl font-body text-[13px] leading-relaxed text-mid">
            TrekBuddy is a noticeboard DEWDROPZ members use to find each other. Nobody from the
            company organises, leads, vets or supervises any of these walks, and no one is checked
            before they join one. Walks are visible to signed-in members only — this page exists
            because somebody who was on this one chose to send it to you.
          </p>
        </div>
      </div>
    </main>
  )
}
