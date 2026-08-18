import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrekHero from '@/components/trek/TrekHero'
import { getTrekBoard, getTrekMembership, getMyTrekCard, getUnreadCount } from '@/actions/trekBuddy'
import { getMessageThreads, getUnreadMessages } from '@/actions/trekChat'
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

// Every conversation you are in, in one place.
//
// Chat is per walk, and until now the only route to one was remembering which
// walk it was on. Somebody on three walks had three conversations and no list.
//
// Sorted by the last thing said rather than by when the walk leaves: an inbox
// ordered by departure buries the thread somebody is actually talking in
// underneath one about a trip next month.
export default async function MessagesPage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/messages')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [threads, all, me, unread, unreadMessages] = await Promise.all([
    getMessageThreads(), getTrekBoard(), getMyTrekCard(), getUnreadCount(),
    getUnreadMessages(),
  ])

  return (
    <>
      <NavBar />
      <main>
        <TrekHero unreadMessages={unreadMessages} counts={{}} openCount={all.length} canHost={membership.canHost}
          active="messages" me={me} unread={unread} />

        <section className="bg-paper px-6 pb-24 pt-12 md:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-[clamp(24px,3.2vw,34px)] leading-tight text-text">
              Messages
            </h2>
            <p className="mt-2 max-w-lg font-body text-sm leading-relaxed text-mid">
              The parties you are in. Each walk has its own thread, readable only by the people
              confirmed on it.
            </p>

            {threads.length === 0 ? (
              <div className="mt-8 rounded-[6px] border border-dashed border-rule px-6 py-10">
                <p className="font-body text-sm text-text">No conversations yet.</p>
                <p className="mt-1.5 max-w-md font-body text-sm leading-relaxed text-mid">
                  A thread appears once somebody says something on a walk you are confirmed for.
                  Until then there is nothing to read.
                </p>
                <Link href="/trek-buddy"
                  className="mt-4 inline-block border-b border-rule pb-1 font-body text-[11px] uppercase tracking-[0.14em] text-mid transition-colors hover:text-text">
                  Back to the board
                </Link>
              </div>
            ) : (
              <ul className="mt-8 divide-y divide-rule border-y border-rule">
                {threads.map((t) => {
                  const light = lightForTime(t.start_time ?? '06:00')
                  return (
                    <li key={t.plan_id}>
                      <Link href={`/trek-buddy/${t.plan_id}#chat`}
                        className="group flex gap-4 py-4 transition-colors hover:bg-paper-warm/40">
                        <span aria-hidden="true" style={{ background: light.bar }}
                          className="mt-1 w-1 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="font-display text-lg leading-tight text-text">
                              {t.place}
                              {t.is_host && (
                                <span className="ml-2 trek-label-xs font-mono text-mid">
                                  yours
                                </span>
                              )}
                            </p>
                            <p className="trek-label font-mono text-mid">
                              {when(t.last_at)}
                            </p>
                          </div>
                          <p className="mt-1 truncate font-body text-sm text-mid">
                            {t.last_is_announcement && (
                              <span className="mr-1.5 trek-label-xs font-mono text-forest">
                                Announcement
                              </span>
                            )}
                            <span className="text-text">{t.last_author}:</span> {t.last_body}
                          </p>
                        </div>
                        {t.unread > 0 && (
                          <span className="mt-1 grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-dawn px-1.5 font-mono text-[10px] text-ink tabular-nums">
                            {t.unread > 9 ? '9+' : t.unread}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
