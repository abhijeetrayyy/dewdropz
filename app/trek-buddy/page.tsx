import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import { getTrekBoard, getTrekMembership, getOpenPlanCount } from '@/actions/trekBuddy'
import TrekPlanCard from '@/components/trek/TrekPlanCard'

export const metadata: Metadata = {
  title: 'Trek Buddy — DEWDROPZ',
  description: 'Post a day walk near Dehradun and find people to go with. Members only.',
  // Who is going where, and when, is not something to hand a crawler.
  robots: { index: false, follow: false },
}

// The board.
//
// Signed out, this is a pitch and one integer. Signed in without onboarding, it
// is a door to the four questions. Only an onboarded adult member sees an actual
// list of walks — there is no anonymous read policy on any Trek Buddy table, so
// that is enforced in the database rather than by this component choosing not
// to render.
export default async function TrekBuddyPage() {
  const membership = await getTrekMembership()

  if (!membership.signedIn) {
    const open = await getOpenPlanCount()
    return (
      <>
        <NavBar />
        <main>
          <PageHeader
            eyebrow="Trek Buddy"
            title="Never go alone."
            subtitle="Post the hour you're going, and other members heading that way that day can ask to come. Not a booking platform, and nobody pays for a place."
            variant="altitude"
          />
          <section className="bg-paper px-6 pb-24 pt-16 md:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest">
                {open === 0 ? 'No walks on the board yet' : `${open} walk${open === 1 ? '' : 's'} on the board`}
              </p>
              <h2 className="mt-4 font-display text-[clamp(24px,3.4vw,36px)] leading-tight text-text">
                You need an account to see who is going where.
              </h2>
              <p className="mx-auto mt-4 max-w-md font-body text-sm leading-relaxed text-mid">
                Walks are only visible to signed-in members, and the exact meeting point is only
                ever shown to people the host has confirmed. That is deliberate.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/auth/login?redirect=/trek-buddy"
                  className="rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid"
                >
                  Sign in
                </Link>
                <Link
                  href="/treks"
                  className="border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:text-text"
                >
                  Read the trail guide instead
                </Link>
              </div>
            </div>
          </section>
        </main>
        <FooterSection />
      </>
    )
  }

  if (!membership.onboarded) {
    return (
      <>
        <NavBar />
        <main>
          <PageHeader
            eyebrow="Trek Buddy"
            title="Four questions first."
            subtitle="A name to show other walkers, your date of birth, and how this works. It takes a minute."
            variant="altitude"
          />
          <section className="bg-paper px-6 pb-24 pt-16 md:px-10">
            <div className="mx-auto max-w-md text-center">
              <Link
                href="/trek-buddy/setup"
                className="inline-block rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid"
              >
                Set up Trek Buddy
              </Link>
            </div>
          </section>
        </main>
        <FooterSection />
      </>
    )
  }

  const plans = await getTrekBoard()

  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Trek Buddy"
          title="Never go alone."
          subtitle="Day walks near Dehradun, posted by members. Ask to come, and the host decides."
          variant="altitude"
        />

        <section className="bg-paper px-6 pb-24 pt-14 md:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                {plans.length === 0
                  ? 'Nothing on the board'
                  : `${plans.length} walk${plans.length === 1 ? '' : 's'} coming up`}
              </span>
              {membership.canHost ? (
                <Link
                  href="/trek-buddy/new"
                  className="rounded-sm bg-forest px-5 py-2.5 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid"
                >
                  Post a walk
                </Link>
              ) : (
                <span className="font-body text-xs text-mid">
                  Hosting is invite-only for now —{' '}
                  <Link href="/contact" className="text-forest underline underline-offset-4">
                    ask us
                  </Link>
                </span>
              )}
            </div>

            {plans.length === 0 ? (
              // An empty board is the honest day-one state. Saying so, and
              // pointing somewhere useful, beats a fake list of walks nobody
              // is actually going on.
              <div className="py-16 text-center">
                <h2 className="font-display text-[clamp(22px,3vw,30px)] text-text">
                  Nobody has posted a walk yet.
                </h2>
                <p className="mx-auto mt-3 max-w-md font-body text-sm leading-relaxed text-mid">
                  This board only works when it is real, so there is nothing invented on it. The
                  first walks will be ones the DEWDROPZ team are actually going on.
                </p>
                <Link
                  href="/treks"
                  className="mt-6 inline-block border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:text-text"
                >
                  Read the trail guide
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-rule">
                {plans.map((p) => (
                  <li key={p.id}>
                    <TrekPlanCard plan={p} />
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-12 border-t border-rule pt-6 font-body text-xs leading-relaxed text-mid">
              DEWDROPZ does not organise, lead, vet or supervise these walks, and does not check
              who anyone is. You are meeting strangers in the hills at your own risk. Tell someone
              not on the walk where you are going and when you expect to be back. In an emergency
              call <span className="text-text">112</span>.
            </p>
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
