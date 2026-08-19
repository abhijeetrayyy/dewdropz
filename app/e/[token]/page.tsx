import { trekFontVars } from '@/app/trek-fonts'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CopyLink from './CopyLink'
import { getInviteCard } from '@/actions/trekShare'
import Avatar from '@/components/trek/ui/Avatar'
import Cover from '@/components/trek/ui/Cover'
import HourPill from '@/components/trek/ui/HourPill'
import { FactRow, Tag } from '@/components/trek/ui/Bits'
import { Lockup } from '@/components/trek/ui/Mark'
import { ACTIVITY_BY_KEY, DIFFICULTY_LABEL, lightForTime, type TrekActivity } from '@/lib/trek'
import { formatPrice } from '@/lib/utils'
import { DAY_ARC } from '@/lib/constants'

// noindex, and not as a formality. This page exists because a host chose to
// send one person a link; it should not become a permanent public record of a
// walk, a date and who is leading it, discoverable by anybody who searches a
// name. The token makes it unguessable, and this keeps it unindexed.
export const metadata: Metadata = {
  title: 'You have been invited — DEWDROPZ',
  robots: { index: false, follow: false, nocache: true },
}

// The invite card: the one TrackBuddy page a stranger can open.
//
// It shows enough to decide — where, when, how hard, how many places, what it
// costs — and stops exactly where the board stops. The meeting point is not
// withheld by this template; it is not in the data. trek_invite_card names its
// columns one by one and that is not among them, so no future edit to this file
// can put it on screen.
//
// THIS ROUTE IS OUTSIDE app/trek-buddy, so it gets none of the shell — no top
// bar, no footer, no navigation of any kind, and that is deliberate rather
// than an oversight. The person holding this link has no account; a nav full
// of doors they cannot open is an argument against joining. What they get is
// one object on a ground: a card, a button, and the address it lives at.
//
// TWO CONSEQUENCES OF BEING OUTSIDE THE SHELL, BOTH OF WHICH WERE WRONG HERE.
//
// The tokens live on `.trek-scope`, which `app/trek-buddy/layout.tsx` applies —
// so this page was rendering in the STOREFRONT's palette and typefaces while
// referencing the board's token names. `text-clay-deep` resolved to the shop's
// clay, `font-display` to the shop's serif, and the one page a stranger judges
// the product by was the one page not written in the product's own voice. The
// class is on the root wrapper now.
//
// And the ground was a radial amber gradient — #F6DCA8 through #E7D9BE — which
// is the single loudest surface anywhere in the product, spent on the screen
// with the least right to shout: somebody who has been handed a link by a
// friend and is deciding whether these are serious people. Amber on this board
// means a clock is running. Nothing here is running. It is the board's own
// paper now, with a hairline of chrome at the top so the page has a name, and
// the ink card is the only dark object on it — which is what makes it read as
// something handed over rather than as a page about a walk.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const card = await getInviteCard(token)
  // Wrong token, revoked link, cancelled walk, or one that has already left.
  // All four are the same answer: there is nothing here.
  if (!card) notFound()

  const light = lightForTime(card.start_time ?? '06:00')
  const when = new Date(card.starts_at).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
  })
  const cover = card.cover_urls?.[0] ?? DAY_ARC.firstLight
  // trek_invite_card returns the activity as free text; the map is keyed by the
  // known ones, so an activity added to the database before it is added to
  // lib/trek falls back to its own key rather than rendering "undefined".
  const activityLabel = ACTIVITY_BY_KEY[card.activity as TrekActivity]?.label ?? card.activity

  // Figures only. `FactRow` sets every value in monospace at 19px, which is
  // right for a distance and a fare and wrong for the word "Moderate" — how
  // hard the walk is is a tag beside the hour instead, where somebody scanning
  // for it actually looks.
  const facts: { k: string; v: string }[] = [
    { k: 'Date', v: when },
    { k: 'Spots', v: card.spots_left > 0 ? `${card.spots_left} open` : 'Full — waitlist' },
  ]
  if (card.distance_km != null) facts.push({ k: 'Distance', v: `${card.distance_km} km` })
  if (card.gain_m != null) facts.push({ k: 'Climb', v: `${card.gain_m.toLocaleString('en-IN')} m` })
  if (card.cost_paise != null) {
    facts.push({
      k: 'Cost share',
      v: card.cost_paise === 0 ? 'Nothing' : `${formatPrice(card.cost_paise)} each`,
    })
  }

  return (
    <main className={`${trekFontVars} trek-scope flex min-h-screen flex-col bg-paper`}>
      {/* The whole of this page's chrome. A name and a rule: enough that the
          card is sitting on something that belongs to somebody, and not one
          link into a product this person cannot sign into yet. */}
      <header className="trek-band border-b border-rule py-5">
        <div className="mx-auto w-full max-w-[920px]">
          <Lockup tone="onpaper" size="sm" />
        </div>
      </header>

      <div className="trek-band flex flex-1 flex-col justify-center py-14 md:py-20">
        <div className="mx-auto w-full max-w-[920px]">
          <p className="trek-eyebrow text-forest">You have been invited</p>

          {/* Ink, on the board's own paper. The card is the only dark thing on
              the screen, so it reads as an object handed over rather than as a
              page that happens to be about a walk. */}
          <article className="mt-4 grid overflow-hidden rounded-[var(--r-shell)] bg-ink shadow-[var(--shadow-panel)] md:grid-cols-[1.1fr_1fr]">
            <div className="relative min-h-[280px] md:min-h-[440px]">
              <div className="absolute inset-0">
                <Cover
                  src={cover}
                  light={light}
                  place={card.place}
                  distanceKm={card.distance_km}
                  gainM={card.gain_m}
                  sizes="(min-width: 768px) 480px, 92vw"
                  priority
                  scrimFrom={55}
                  className="h-full w-full"
                >
                  <HourPill
                    time={card.start_time}
                    light={light}
                    withLabel
                    className="absolute left-4 top-4"
                  />
                  <span className="absolute bottom-4.5 left-5 flex items-center gap-2.5">
                    <Avatar name={card.host_name} size={32} ground="dark" />
                    <span className="font-body text-[13px] text-paper/90">
                      {card.host_name} is hosting
                    </span>
                  </span>
                </Cover>
              </div>
            </div>

            <div className="flex flex-col p-7 md:p-9">
              <p className="trek-label text-sage">
                {activityLabel} · {card.meet_area}
              </p>
              <h1 className="trek-h1 mt-3 text-paper">{card.place}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Tag tone="ondark">{DIFFICULTY_LABEL[card.difficulty] ?? card.difficulty}</Tag>
                {card.women_only && <Tag tone="clay">Women only</Tag>}
              </div>

              {card.note && (
                <p className="mt-4 font-body text-[14px] leading-relaxed text-paper/75">
                  {card.note}
                </p>
              )}

              <FactRow facts={facts} tone="dark" className="mt-6" />

              {/* Who may come at all, twice and on purpose: as a tag beside the
                  difficulty for the person scanning, and as a sentence here for
                  the person who now has to decide what it means for them. It is
                  the one lit block on an ink card, and it is clay — a limit,
                  never an error. The rule itself is enforced in Postgres at the
                  moment somebody asks; this is them finding out before they
                  build a Saturday around it. */}
              {card.women_only && (
                <p className="mt-5 rounded-[var(--r-card)] bg-clay-wash px-4 py-3.5 font-body text-[13px] leading-relaxed text-clay-deep">
                  This walk is open to women only. The board enforces that when you ask to come.
                </p>
              )}

              <div className="mt-auto pt-7">
                <Link
                  href="/trek-buddy"
                  className="trek-pill trek-pill-lg trek-pill-actinv w-full justify-center font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  Ask to join on TrackBuddy
                </Link>

                {/* The same sentence the board makes to everybody, said here to
                    somebody who has not signed up yet — because this is the first
                    thing they learn about how it works, and it is the part that
                    makes the rest trustworthy. */}
                <p className="mt-4 font-body text-[12.5px] leading-relaxed text-paper/60">
                  <span className="text-paper">The exact meeting point is not on this page.</span>{' '}
                  It reaches you once {card.host_name} confirms you, and only when enough people
                  are going — so a walk nobody joins never hands out an address.
                </p>
              </div>
            </div>
          </article>

          <div className="mt-6 flex justify-center">
            <CopyLink path={`/e/${token}`} />
          </div>

          {/* Where the platform stops. It is set at the same size as the copy
              inside the card rather than as small print, because a stranger
              deciding whether to spend a Saturday with people they have never
              met is exactly who this paragraph is written for. */}
          <p className="mx-auto mt-8 max-w-xl border-t border-rule pt-6 text-center font-body text-[13px] leading-relaxed text-mid">
            DEWDROPZ does not organise, lead, vet or supervise this walk, and has not checked who
            anyone on it is. Meet somewhere public, tell someone who is not coming, and turn back if
            it feels wrong.
          </p>
        </div>
      </div>
    </main>
  )
}
