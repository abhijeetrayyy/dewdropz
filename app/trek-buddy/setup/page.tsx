import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { requireAuth, getProfile } from '@/actions/auth'
import { getTrekKinds, getTrekMembership } from '@/actions/trekBuddy'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'
import { Eyebrow } from '@/components/trek/ui/Bits'
import SetupForm from './SetupForm'

export const metadata: Metadata = {
  title: 'Set up Trek Buddy — DEWDROPZ',
  robots: { index: false, follow: false },
}

// Joining the board.
//
// This was a photographic header followed by a column of three labelled fields
// on cream — the same shape as every other form on the site, which is exactly
// wrong for the one screen a person only ever sees once. Nothing here is
// paperwork you come back to; it is the door.
//
// The first attempt at drawing that door was a full-bleed photograph at 0.35
// opacity with a dawn glow behind the card and a blurred panel floating on top.
// It is the house style of every travel brand, and it fails twice over: at the
// opacity that keeps type legible the photograph has stopped being a
// photograph, and the amber glow spent the board's one urgency colour on
// atmosphere. A person arriving here is about to give a stranger-facing board
// their name and their date of birth. That wants a serious room, not a mood.
//
// So the ink band stays — this is still the threshold — and the photograph is
// framed beside the card at full clarity, with a caption, the way a publication
// uses a picture. It is the same image the landing page opens on, because
// somebody who walked here from there should feel they came through a door
// rather than clicked to a different product.
export default async function TrekSetupPage() {
  await requireAuth()
  const membership = await getTrekMembership()
  if (membership.signedIn && membership.onboarded) redirect('/trek-buddy')

  const [profile, kinds] = await Promise.all([getProfile(), getTrekKinds()])

  // Offered as a starting point only — the field is editable, and the copy
  // under it says plainly that the courier name is not the right answer.
  const suggested = ((profile?.full_name as string) ?? '').split(' ')[0] ?? ''

  // min-h keeps the ink band filling the door even on the shortest step —
  // without it, step two ends halfway down and the paper ground underneath
  // turns the threshold into a stripe.
  return (
    <section className="trek-band min-h-[calc(100vh-64px)] bg-ink pb-24 pt-28 md:pt-32">
      <div className="trek-measure grid gap-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start lg:gap-16">
        <div className="lg:sticky lg:top-[88px]">
          <Eyebrow tone="ondark">Joining the board</Eyebrow>
          <figure className="m-0 mt-5">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--r-panel)] lg:aspect-[4/5]">
              <Image
                src={DAY_ARC.theStart}
                alt="Two walkers with packs on a trail heading toward a mountain range."
                fill
                priority
                sizes="(min-width: 1024px) 340px, 92vw"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover"
              />
            </div>
            {/* The caption claims nothing about where this was taken — it is
                stock, and this is a product that does not overstate things. */}
            <figcaption className="mt-3.5 font-body text-[12.5px] leading-relaxed text-paper/45">
              A members&rsquo; noticeboard for outings around Dehradun. Three questions, asked once,
              and then you are inside.
            </figcaption>
          </figure>
        </div>

        <SetupForm suggestedName={suggested} kinds={kinds} />
      </div>
    </section>
  )
}
