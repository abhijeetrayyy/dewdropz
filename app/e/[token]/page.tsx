import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getInviteCard } from '@/actions/trekShare'
import { DIFFICULTY_LABEL, lightForTime } from '@/lib/trek'
import { formatPrice } from '@/lib/utils'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'

// noindex, and not as a formality. This page exists because a host chose to
// send one person a link; it should not become a permanent public record of a
// walk, a date and who is leading it, discoverable by anybody who searches a
// name. The token makes it unguessable, and this keeps it unindexed.
export const metadata: Metadata = {
  title: 'You have been invited — DEWDROPZ',
  robots: { index: false, follow: false, nocache: true },
}

// The invite card: the one Trek Buddy page a stranger can open.
//
// It shows enough to decide — where, when, how hard, how many places, what it
// costs — and stops exactly where the board stops. The meeting point is not
// withheld by this template; it is not in the data. trek_invite_card names its
// columns one by one and that is not among them, so no future edit to this file
// can put it on screen.
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

  const facts: [string, string][] = [
    ['Date', when],
    ['Spots', card.spots_left > 0 ? `${card.spots_left} open` : 'Full — waitlist'],
    ['How hard', DIFFICULTY_LABEL[card.difficulty] ?? card.difficulty],
  ]
  if (card.distance_km != null) facts.push(['Distance', `${card.distance_km} km`])
  if (card.gain_m != null) facts.push(['Climb', `${card.gain_m.toLocaleString('en-IN')} m`])
  if (card.cost_paise != null) {
    facts.push(['Cost share', card.cost_paise === 0 ? 'Nothing' : `${formatPrice(card.cost_paise)} each`])
  }

  return (
    <main className="min-h-screen bg-ink">
      <div className="mx-auto max-w-lg px-6 py-12">
        <p className="text-center trek-label font-mono text-paper/60">
          You have been invited
        </p>

        <article className="mt-6 overflow-hidden rounded-[6px] border border-paper/15 bg-paper">
          <div className="relative aspect-[16/10]">
            <Image src={cover} alt="" fill sizes="(min-width: 640px) 512px, 92vw"
              placeholder="blur" blurDataURL={BLUR_DATA_URL} className="object-cover" />
            <div aria-hidden="true" className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(12,16,13,0.15) 0%, rgba(12,16,13,0.85) 100%)' }} />
            <div className="absolute inset-x-5 bottom-4">
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-sm tabular-nums" style={{ color: light.onDark }}>
                  {card.start_time ? card.start_time.slice(0, 5) : '—'}
                </span>
                <span className="trek-label font-mono text-paper/75">
                  {light.label}
                </span>
              </p>
              <h1 className="mt-0.5 font-display text-[clamp(24px,6vw,34px)] leading-tight text-paper">
                {card.place}
              </h1>
              <p className="mt-1 font-body text-xs text-paper/80">
                {card.meet_area} · hosted by {card.host_name}
              </p>
            </div>
          </div>

          <div className="p-5">
            {card.note && (
              <p className="font-body text-sm leading-relaxed text-text">{card.note}</p>
            )}

            <dl className="mt-5 grid grid-cols-3 gap-x-4 gap-y-4">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="trek-label-xs font-mono text-mid">{k}</dt>
                  <dd className="mt-0.5 font-body text-sm text-text">{v}</dd>
                </div>
              ))}
            </dl>

            {card.women_only && (
              <p className="mt-4 rounded-[6px] border border-clay/40 px-3 py-2 font-body text-xs text-clay">
                This walk is open to women only. The board enforces that when you ask to come.
              </p>
            )}

            <Link
              href="/trek-buddy"
              className="trek-pill trek-pill-act font-body"
            >
              Ask to join on Trek Buddy
            </Link>

            {/* The same sentence the board makes to everybody, said here to
                somebody who has not signed up yet — because this is the first
                thing they learn about how it works, and it is the part that
                makes the rest trustworthy. */}
            <p className="mt-4 font-body text-xs leading-relaxed text-mid">
              The exact meeting point is not on this page. It reaches you once {card.host_name}{' '}
              confirms you, and only when enough people are going — so a walk nobody joins never
              hands out an address.
            </p>
          </div>
        </article>

        <p className="mt-6 text-center font-body text-xs leading-relaxed text-paper/50">
          DEWDROPZ does not organise, lead, vet or supervise this walk, and has not checked who
          anyone on it is. Meet somewhere public, tell someone who is not coming, and turn back if
          it feels wrong.
        </p>
      </div>
    </main>
  )
}
