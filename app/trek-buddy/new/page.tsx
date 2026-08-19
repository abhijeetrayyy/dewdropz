import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTrekKinds, getTrekMembership } from '@/actions/trekBuddy'
import { Eyebrow } from '@/components/trek/ui/Bits'
import NewPlanForm from './NewPlanForm'

export const metadata: Metadata = {
  title: 'Post a walk — DEWDROPZ',
  robots: { index: false, follow: false },
}

// Writing an invitation.
//
// The page used to open with the same 90vh photographic header every other Trek
// Buddy route opened with, and then re-fetch the board, the unread counts and
// the viewer's own card purely to feed it. All of that is the shell's job now,
// so the four queries that existed only to decorate a header are gone and the
// page asks for exactly one thing: what kinds of outing the board is taking.
//
// What replaces the header is a shallow gradient band — paper-warm falling to
// paper, fenced by a rule — because this screen is a workbench rather than an
// arrival. The photograph belonged on a door; there is no door here, you are
// already inside.
export default async function NewTrekPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string }>
}) {
  const { activity } = await searchParams
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/new')
  if (!membership.onboarded) redirect('/trek-buddy/setup')
  // Hosting is invite-only. Checked here for a clean redirect and again inside
  // trek_create_plan, which is the one that actually decides.
  if (!membership.canHost) redirect('/trek-buddy')

  const kinds = await getTrekKinds()

  // Only a kind the board is actually taking survives the URL — a hand-typed
  // ?activity=anything must not reach the form as a broken lookup.
  const initial = kinds.some((k) => k.key === activity) ? activity : undefined

  return (
    <>
      {/* pt-28 clears the fixed 64px bar with the design's 112px. The gradient
          is written inline because it runs between two tokens rather than
          between two Tailwind colours, and because it is a ground, not a scrim
          over a photograph.

          The headline was set at clamp(34→50) in Newsreader 300. A hairline
          serif at fifty pixels is a fashion masthead, and this is the screen
          where somebody states how far, how steep and how late a stranger's
          Sunday will run. It takes `trek-h1` — 400 weight — like every other
          headline on the board, and it now carries a line saying what the form
          is actually for. */}
      <section
        className="trek-band border-b border-rule pb-8 pt-28 md:pt-32"
        style={{ background: 'linear-gradient(180deg, var(--paper-warm) 0%, var(--paper) 100%)' }}
      >
        <div className="trek-measure">
          <Eyebrow>Host something</Eyebrow>
          <h1 className="trek-h1 mt-4 text-text">
            You are not filling a form.
            <br />
            You are writing an invitation.
          </h1>
          <p className="mt-5 max-w-2xl font-body text-[15px] leading-relaxed text-mid">
            Somebody who has never walked a hill will read this and decide whether to spend a day
            with you. Say how hard it is, how far, how much climbing, what to carry and what hour
            everyone is back — plainly, and only what you actually know.
          </p>
        </div>
      </section>

      <section className="trek-band pb-24 pt-10">
        <div className="trek-measure">
          <NewPlanForm
            kinds={kinds}
            initialActivity={initial}
            trekGender={membership.trekGender}
            userId={membership.userId!}
            hostName={membership.displayName ?? 'You'}
          />
        </div>
      </section>
    </>
  )
}
