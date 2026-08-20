'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { requestToJoin, withdrawRequest, decideRequest, cancelPlan } from '@/actions/trekBuddy'

type RosterRow = { user_id: string; display_name: string; status: string; message: string | null }

// Everything a viewer can do to a plan, in one place, because who can do what
// depends on which of three people they are: the host, someone who has asked,
// or someone who has not.
//
// It renders inside the rail's ink panel, and every class here is written for
// that ground — before this it inherited `[&_a]:text-paper [&_button]:text-paper/80`
// from a wrapper in PlanRail, which is a parent guessing at a child's colours
// and got the disabled, hover and error states wrong every time.
//
// WHAT THE RESET CHANGED HERE.
//
// The controls were dawn — amber — for the one act, and every heading, status
// line and quiet exit inside the panel was 10px monospace, uppercase, tracked
// to 0.14em. That is four separate problems wearing one coat: amber now means
// only "a clock is running" and this panel is not a clock; a heading set in
// mono claims to be machine output; and uppercase at wide tracking on a thing
// you PRESS is a display gesture, which is exactly wrong on the two buttons
// where somebody either joins a day with strangers or calls one off. The act is
// forest, the alternatives are a paper hairline, and everything you press says
// what it does in sentence case at a size a person over sixty can read.
//
// The cancel flow no longer goes through `window.prompt`. A browser modal is
// unstyled chrome from another decade, it cannot be read by anything this
// product controls, and the reason a host types into it is shown to everybody
// who was coming — which makes it the single worst place on the board for a
// grey box with an OK button. Same server call, same argument, same guard on an
// empty reason; it is a panel now.

/** The section heading inside the panel. One stamp, four branches. */
function Head({ children }: { children: React.ReactNode }) {
  return <p className="trek-label text-paper/55">{children}</p>
}

/** A group heading with its count set as the figure it is. */
function GroupHead({
  children,
  count,
  tone = 'quiet',
}: {
  children: React.ReactNode
  count: number
  tone?: 'quiet' | 'loud'
}) {
  return (
    <p className={`trek-label ${tone === 'loud' ? 'text-paper/80' : 'text-paper/55'}`}>
      {children} <span className="font-mono tabular-nums">· {count}</span>
    </p>
  )
}

/** A person's name, on ink. */
function Person({ id, name }: { id: string; name: string }) {
  return (
    <Link
      href={`/trek-buddy/people/${id}`}
      className="font-body text-sm text-paper underline decoration-paper/30 underline-offset-4 transition-colors hover:decoration-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
    >
      {name}
    </Link>
  )
}

/** The quiet exit. Never a pill — leaving should be findable, not offered. */
function QuietAction({
  onClick,
  disabled,
  tone = 'mid',
  children,
}: {
  onClick: () => void
  disabled?: boolean
  tone?: 'mid' | 'clay'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border-b pb-1 font-body text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage disabled:opacity-40 ${
        tone === 'clay'
          ? 'border-clay-wash/35 text-clay-wash hover:border-clay-wash/80'
          : 'border-paper/25 text-paper/70 hover:border-paper/60 hover:text-paper'
      }`}
    >
      {children}
    </button>
  )
}

/** Whatever the server refused, said once, in clay. Never red — see §1.2. */
function Problem({ error }: { error: string }) {
  if (!error) return null
  return (
    <p role="alert" className="mt-3 font-body text-xs leading-relaxed text-clay-wash">
      {error}
    </p>
  )
}

export default function PlanActions({
  planId, isHost, myStatus, full, cancelled, roster, waitlistPosition,
}: {
  planId: string
  isHost: boolean
  myStatus: string | null
  /** Where you stand in the queue, 1-based. Null unless you are waitlisted. */
  waitlistPosition?: number | null
  full: boolean
  cancelled: boolean
  roster: RosterRow[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // The cancel panel, and the reason that goes with it. Two pieces of state
  // rather than one, because closing the panel must not silently keep a reason
  // the host decided against typing.
  const [callingOff, setCallingOff] = useState(false)
  const [reason, setReason] = useState('')

  function run(fn: () => Promise<{ error?: string } | { success: true }>) {
    setError('')
    start(async () => {
      const r = await fn()
      if (r && 'error' in r && r.error) { setError(r.error); return }
      router.refresh()
    })
  }

  if (cancelled) return null

  if (isHost) {
    const waiting = roster.filter((r) => r.status === 'requested')
    const going = roster.filter((r) => r.status === 'confirmed')
    // Kept apart from `waiting` on purpose: these are not decisions the host is
    // sitting on. There is no place to give, and showing them in the same list
    // would read as a pile of unanswered asks.
    const queued = roster.filter((r) => r.status === 'waitlisted')
    return (
      <div>
        <Head>Your walk</Head>

        {waiting.length > 0 && (
          <div className="mt-4">
            <GroupHead count={waiting.length} tone="loud">
              Asked to come
            </GroupHead>
            <ul className="mt-2.5 divide-y divide-paper/12 border-y border-paper/12">
              {waiting.map((r) => (
                <li key={r.user_id} className="py-3">
                  <Person id={r.user_id} name={r.display_name} />
                  {r.message && (
                    <p className="mt-1 font-body text-xs leading-relaxed text-paper/60">
                      &ldquo;{r.message}&rdquo;
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={pending || full}
                      onClick={() => run(() => decideRequest(planId, r.user_id, 'confirmed'))}
                      title={full ? 'This walk is full' : undefined}
                      aria-label={`Confirm ${r.display_name}`}
                      className="trek-pill trek-pill-act trek-pill-sm font-body disabled:opacity-40"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => decideRequest(planId, r.user_id, 'declined'))}
                      aria-label={`Decline ${r.display_name}`}
                      className="trek-pill trek-pill-onink trek-pill-sm font-body disabled:opacity-40"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 font-body text-xs leading-relaxed text-paper/55">
              Declining is silent — they are not told why, and you do not owe a reason.
            </p>
          </div>
        )}

        {going.length > 0 && (
          <div className="mt-6">
            <GroupHead count={going.length}>Coming with you</GroupHead>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {going.map((r) => (
                <Person key={r.user_id} id={r.user_id} name={r.display_name} />
              ))}
            </p>
          </div>
        )}

        {/* The queue, in order, and read-only. There is nothing for the host to
            press: a place has to come free before the person at the front can
            be decided on, and offering a button that cannot work is worse than
            offering none. It is here so the host knows the interest exists. */}
        {queued.length > 0 && (
          <div className="mt-6">
            <GroupHead count={queued.length}>Waiting for a place</GroupHead>
            <ol className="mt-2 space-y-1.5">
              {queued.map((r, i) => (
                <li key={r.user_id} className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[11px] text-paper/55 tabular-nums">{i + 1}</span>
                  <Person id={r.user_id} name={r.display_name} />
                </li>
              ))}
            </ol>
            <p className="mt-2.5 font-body text-xs leading-relaxed text-paper/55">
              If somebody drops out, the first of these moves to &ldquo;asked to come&rdquo; on its
              own and you decide then.
            </p>
          </div>
        )}

        {waiting.length === 0 && going.length === 0 && queued.length === 0 && (
          <p className="mt-3 font-body text-sm leading-relaxed text-paper/70">
            Nobody has asked to come yet.
          </p>
        )}

        <Problem error={error} />

        <div className="mt-7 border-t border-paper/12 pt-5">
          {callingOff ? (
            <div>
              <label className="block">
                <span className="trek-label text-paper/60">
                  Why are you calling it off?
                </span>
                <span className="mt-1.5 block font-body text-xs leading-relaxed text-paper/55">
                  Everyone going will see this. You can leave it blank.
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={300}
                  autoFocus
                  placeholder="The forecast turned, or the road is shut — whatever it is, in your own words."
                  className="mt-2.5 w-full rounded-[var(--r-input)] border border-paper/20 bg-paper/5 px-3 py-2.5 font-body text-sm text-paper placeholder:text-paper/55 focus:border-sage focus:outline-none"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => cancelPlan(planId, reason.trim() || undefined))}
                  className="trek-pill trek-pill-onink trek-pill-sm font-body disabled:opacity-40"
                >
                  {pending ? 'Calling it off…' : 'Yes, call it off'}
                </button>
                <QuietAction
                  disabled={pending}
                  onClick={() => {
                    setCallingOff(false)
                    setReason('')
                  }}
                >
                  Keep the walk on
                </QuietAction>
              </div>
            </div>
          ) : (
            <QuietAction tone="clay" disabled={pending} onClick={() => setCallingOff(true)}>
              Call this walk off
            </QuietAction>
          )}
        </div>
      </div>
    )
  }

  if (myStatus === 'confirmed') {
    return (
      <div>
        <p className="font-body text-sm leading-relaxed text-paper">
          <span className="text-sage">✓</span> You&apos;re confirmed for this walk.
        </p>
        <Problem error={error} />
        <div className="mt-3.5">
          <QuietAction disabled={pending} onClick={() => run(() => withdrawRequest(planId))}>
            I can&apos;t make it
          </QuietAction>
        </div>
      </div>
    )
  }

  if (myStatus === 'requested') {
    return (
      <div>
        <p className="font-body text-sm leading-relaxed text-paper">
          You&apos;ve asked to come. {}
          <span className="text-paper/60">The host will confirm or decline.</span>
        </p>
        <Problem error={error} />
        <div className="mt-3.5">
          <QuietAction disabled={pending} onClick={() => run(() => withdrawRequest(planId))}>
            Withdraw
          </QuietAction>
        </div>
      </div>
    )
  }

  if (myStatus === 'waitlisted') {
    return (
      <div>
        <p className="font-body text-sm leading-relaxed text-paper">
          This walk is full, so you&apos;re in the queue
          {typeof waitlistPosition === 'number' ? (
            <>
              {' '}at number{' '}
              <span className="font-mono text-paper tabular-nums">{waitlistPosition}</span>
            </>
          ) : null}
          .
        </p>
        {/* Says what happens next without promising a place. The queue moves you
            in front of the host; it does not seat you, because on this board the
            host decides who comes and a queue that overrode that would quietly
            repeal the safest thing about it. */}
        <p className="mt-2 font-body text-xs leading-relaxed text-paper/55">
          If somebody drops out you move up on your own, and your ask goes to the host the moment
          you reach the front. Nobody is added to a walk automatically — the host still decides.
        </p>
        <Problem error={error} />
        <div className="mt-3.5">
          <QuietAction disabled={pending} onClick={() => run(() => withdrawRequest(planId))}>
            Leave the queue
          </QuietAction>
        </div>
      </div>
    )
  }

  if (myStatus === 'declined' || myStatus === 'removed') {
    return (
      <p className="font-body text-sm leading-relaxed text-paper/70">
        You&apos;re not on this walk.
      </p>
    )
  }

  return (
    <div>
      {full ? (
        <p className="font-body text-sm leading-relaxed text-paper/70">This walk is full.</p>
      ) : (
        <>
          <label className="block">
            <span className="trek-label text-paper/60">Say hello (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Anything the host should know — pace, experience, whether you're driving."
              className="mt-2 w-full rounded-[var(--r-input)] border border-paper/20 bg-paper/5 px-3 py-2.5 font-body text-sm text-paper placeholder:text-paper/55 focus:border-sage focus:outline-none"
            />
          </label>
          <Problem error={error} />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => requestToJoin(planId, message))}
            className="trek-pill trek-pill-act font-body mt-3 w-full justify-center disabled:opacity-50"
          >
            {pending ? 'Asking…' : 'Ask to come'}
          </button>
          <p className="mt-3 text-center font-body text-xs leading-relaxed text-paper/55">
            The host decides who comes. The exact meeting point reaches confirmed people only.
          </p>
        </>
      )}
    </div>
  )
}
