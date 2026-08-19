import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import PlanChat from '@/components/trek/PlanChat'
import FacePile, { type Face } from '@/components/trek/ui/FacePile'
import { HourBar } from '@/components/trek/ui/HourPill'
import EmptyState from '@/components/trek/ui/EmptyState'
import { MoreLink } from '@/components/trek/ui/Bits'
import { getTrekMembership } from '@/actions/trekBuddy'
import { getMessages, getMessageThreads, type TrekMessage } from '@/actions/trekChat'
import { lightForTime } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'Messages — DEWDROPZ',
  robots: { index: false, follow: false },
}

function when(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
  })
}

/**
 * Who is in this conversation, drawn as people.
 *
 * Deliberately built from the messages rather than from the roster: the roster
 * is host-only in the action layer — `getTrekPlan` hands a list of who asked to
 * nobody but the host, on purpose, so the board does not become a directory of
 * people to approach — and this screen is not the place to widen that. Everyone
 * who has spoken in a thread is already visible to everyone reading it, so the
 * pile shows exactly what the page below it shows, and nothing more.
 *
 * The host is tagged by name because a thread carries `host_name` but no host
 * id; a wrong guess costs a ring, not a permission.
 */
function speakers(messages: TrekMessage[], meId: string, hostName: string): Face[] {
  const seen = new Map<string, Face>()
  for (const m of messages) {
    if (seen.has(m.user_id)) continue
    seen.set(m.user_id, {
      id: m.user_id,
      name: m.display_name,
      role: m.user_id === meId ? 'you' : m.display_name === hostName ? 'host' : 'none',
    })
  }
  return [...seen.values()]
}

// Every conversation you are in, and the one you are reading, side by side.
//
// This screen used to be a document index: a column of rows, each one a link
// OUT to the walk's own page and its `#chat` anchor. So "Messages" was a
// destination with no destination — you could see that four parties had said
// something and then you had to leave to read any of it, and leave again to
// read the next. An inbox that cannot open its own mail is a table of contents.
//
// Now it is the prototype's shell: a 340px list beside the thread itself, which
// is the arrangement every messaging surface has converged on for the reason
// that it makes switching free. Reading the second thread costs one click and
// no page.
//
// Which thread is open lives in `?thread=`, so this page stays a Server
// Component and the list stays a set of links — the thing you can middle-click,
// share, and land on from a notification. A client-side selected-index would
// have bought nothing and cost all three.
//
// Sorted by the last thing said rather than by when the walk leaves: an inbox
// ordered by departure buries the thread somebody is actually talking in
// underneath one about a trip next month.
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>
}) {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/messages')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [{ thread: wanted }, threads] = await Promise.all([searchParams, getMessageThreads()])

  // Default to the top of the list, which is the most recently spoken in. A
  // messages screen that opens on nothing makes you choose before it has told
  // you anything.
  const selected = threads.find((t) => t.plan_id === wanted) ?? threads[0] ?? null

  // Read through the viewer's own session inside the action, so RLS — not this
  // page — decides whether a single word arrives. A stale `?thread=` for a walk
  // you left returns an empty list, which is the same answer as a quiet walk.
  const messages = selected ? await getMessages(selected.plan_id) : []

  // On a phone the two panes are one pane: the list, until you pick something.
  // A stale id in the URL must not swap the phone to a thread you did not ask
  // for, so this checks the resolved thread rather than the parameter.
  const onThread = Boolean(selected && wanted === selected.plan_id)

  const light = selected ? lightForTime(selected.start_time ?? '06:00') : null

  return (
    <section className="trek-band bg-paper pb-12 pt-24 md:pt-28">
      <div className="trek-measure">
        <div
          // `grid-cols-[minmax(0,1fr)]` is not decoration. A grid column
          // defaults to `auto`, whose automatic MINIMUM is the content's own
          // width — so below `lg`, where there is one column, the thread list's
          // widest unbreakable content forced the column to 710px inside a
          // 342px shell and `overflow-hidden` quietly clipped a third of the
          // screen off. The `lg` template already had `minmax(0,…)` on its
          // second column for exactly this reason; the single-column case had
          // nothing. `min-w-0` on both panes is the same fix one level down.
          className={`grid min-h-[640px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[var(--r-shell)] border border-rule bg-surface shadow-[var(--shadow-float)] lg:h-[calc(100vh-172px)] ${
            threads.length > 0 ? 'lg:grid-cols-[minmax(300px,26%)_minmax(0,1fr)]' : ''
          }`}
        >
          {/* ── The list ────────────────────────────────────────────────────
              Paper, not surface: the rail is the ground the thread is lifted
              off, which is the only thing telling you which of the two panes
              you are acting in. */}
          <div
            className={`min-h-0 min-w-0 flex-col border-rule bg-paper lg:flex lg:border-r ${
              onThread ? 'hidden' : 'flex'
            }`}
          >
            <header className="shrink-0 border-b border-rule px-[22px] pb-4 pt-5">
              <h1 className="trek-h2 text-text">Messages</h1>
              {/* The most load-bearing sentence on this screen, and it was set
                  at 12px grey where it read as boilerplate. There is no way to
                  message a person on this product except inside a walk you are
                  both on — that is the rule a woman deciding whether to be here
                  most needs to know, so it is stated at reading size and given
                  the second half that explains what it buys her. */}
              <p className="mt-2 font-body text-[13px] leading-relaxed text-text">
                Every conversation belongs to a walk. There are no cold DMs on this board — nobody
                can open a thread with you off the back of seeing your name, and what is said stays
                on the walk&rsquo;s own page where it can be reviewed.
              </p>
            </header>

            {threads.length > 0 && (
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {threads.map((t) => {
                  const bar = lightForTime(t.start_time ?? '06:00')
                  const on = selected?.plan_id === t.plan_id
                  return (
                    <li key={t.plan_id}>
                      <Link
                        href={`/trek-buddy/messages?thread=${t.plan_id}`}
                        aria-current={on ? 'page' : undefined}
                        // Selection is a lifted surface with a forest edge, not
                        // an amber wash. Amber on this screen belongs to the
                        // unread badge — a number of things somebody has said
                        // that you have not read — and a selected row is not
                        // urgent, it is simply the one you are in. The old wash
                        // was rgba(227,155,63,…) written straight into a style
                        // attribute, which is the rejected prototype's amber
                        // hard-coded past the tokens as well.
                        //
                        // Every row carries the 2px marker and only the
                        // selected one colours it in, so the 20px of padding
                        // beside it always adds back up to the rail's 22px
                        // gutter and nothing shunts sideways as you move down.
                        className={`flex gap-3 border-b border-b-rule-soft border-l-2 py-4 pl-5 pr-[22px] transition-colors focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-sage ${
                          on
                            ? 'border-l-forest bg-surface'
                            : 'border-l-transparent hover:bg-paper-warm'
                        }`}
                      >
                        <HourBar light={bar} height={44} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            {/* Newsreader. A thread is named after a place in
                                the hills, and a place name set in the same
                                13px body as the preview under it made the list
                                read as rows of data rather than as a shelf of
                                conversations. */}
                            <h2
                              className={`trek-h3 truncate text-text ${
                                t.unread > 0 ? 'font-semibold' : ''
                              }`}
                            >
                              {t.place}
                            </h2>
                            <span className="shrink-0 font-mono text-[11px] text-mid tabular-nums">
                              {when(t.last_at)}
                            </span>
                          </div>

                          <p className="mt-1 truncate font-body text-[13px] text-mid">
                            {/* The host changing the plan is the one thing in a
                                thread that can leave somebody at the wrong
                                place at the wrong hour, so it keeps the
                                warning colour. */}
                            {t.last_is_announcement && (
                              <span className="mr-1.5 font-medium text-ember">Announcement ·</span>
                            )}
                            <span className="font-medium text-text">{t.last_author}:</span>{' '}
                            {t.last_body}
                          </p>

                          {t.is_host && (
                            <p className="mt-1.5 font-body text-[12px] font-medium text-forest">
                              You are hosting this one
                            </p>
                          )}
                        </div>

                        {/* Amber, and it is the only amber on the screen: a
                            count of things said to you that you have not read
                            is by definition a thing waiting on you. */}
                        {t.unread > 0 && (
                          <span className="grid h-5 min-w-5 shrink-0 self-center place-items-center rounded-full bg-dawn px-1.5 font-mono text-[11px] font-medium text-paper tabular-nums">
                            <span className="sr-only">Unread: </span>
                            {t.unread > 9 ? '9+' : t.unread}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* The rail with nothing in it still gets the page's own ground, so
                an empty inbox looks like the same product as a full one. The
                cream gradient that used to be painted here was two hex literals
                from the rejected prototype, and it made this one panel the only
                warm-yellow surface in the product. */}
            {threads.length === 0 && (
              <div className="flex min-h-0 flex-1 items-center justify-center bg-paper-warm p-6 md:p-10">
                <EmptyState
                  className="w-full max-w-lg"
                  title="No conversations yet."
                  body={
                    <>
                      A thread appears once somebody says something on a walk you are confirmed
                      for. Until then there is nothing to read.
                    </>
                  }
                  action={{ label: 'Back to the board', href: '/trek-buddy' }}
                />
              </div>
            )}
          </div>

          {/* ── The thread ──────────────────────────────────────────────── */}
          {selected && light && (
            <div
              className={`min-h-0 flex-col bg-surface lg:flex ${onThread ? 'flex' : 'hidden'}`}
            >
              <header className="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-rule px-6 py-4">
                <HourBar light={light} height={36} />

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/trek-buddy/${selected.plan_id}`}
                    className="trek-h3 block truncate text-text transition-colors hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                  >
                    {selected.place}
                  </Link>
                  {/* The date and the hour are figures and stay mono; the host
                      is a person and comes out of it. The whole line used to be
                      tracked monospace, which turned "hosted by Priya Negi"
                      into a field value. */}
                  <p className="mt-1 truncate font-body text-[13px] text-mid">
                    <span className="font-mono tabular-nums">
                      {dayLabel(selected.starts_at)}
                      {selected.start_time && <> · {selected.start_time.slice(0, 5)}</>}
                    </span>
                    {' · '}
                    {selected.is_host ? 'hosted by you' : `hosted by ${selected.host_name}`}
                  </p>
                </div>

                <FacePile
                  people={speakers(messages, membership.userId, selected.host_name)}
                  size={26}
                  ringColor="var(--surface)"
                />

                {/* The host's door to the walk's controls. Everyone else has no
                    console to go to, so nobody else is shown one. */}
                {selected.is_host && (
                  <MoreLink href={`/trek-buddy/${selected.plan_id}/console`}>Console</MoreLink>
                )}

                {/* The phone's way back to the list, which on a phone is a
                    different screen rather than the pane to the left. It is a
                    control, so it is a control-shaped thing in sentence case
                    rather than 10px tracked capitals. */}
                <Link
                  href="/trek-buddy/messages"
                  className="trek-pill trek-pill-quiet trek-pill-sm font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage lg:hidden"
                >
                  ← All threads
                </Link>
              </header>

              {/* Keyed on the walk so switching threads remounts the composer:
                  a half-typed line meant for one party must not follow you into
                  another one's conversation. */}
              <PlanChat
                key={selected.plan_id}
                planId={selected.plan_id}
                messages={messages}
                meId={membership.userId}
                variant="shell"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
