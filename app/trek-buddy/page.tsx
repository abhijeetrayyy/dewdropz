import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Trek Buddy — DEWDROPZ',
  description:
    'Post the hour you are going and find whoever else is heading the same way. Coming soon from DEWDROPZ.',
}

// Trek Buddy gets a nav tab in the launch navigation, so it needs somewhere to
// land. It did not have one: the idea existed only as a panel inside the
// homepage hero, marked COMING SOON, with no route behind it.
//
// This page says the same thing the hero panel says, in the same words, and is
// honest that nothing is live yet. A nav tab that 404s is worse than no tab;
// a nav tab that admits the feature is on its way is fine, and it lets the shop
// start collecting interest before a line of the feature is built.
//
// The four activities are the ones the hero already shows, on real ground near
// Dehradun. They are illustrative — not live posts by real people — and the
// page says so rather than implying a community that does not exist yet.
const ACTIVITIES = [
  { time: '05:20', activity: 'Bird watching', place: 'Benog Sanctuary', alt: '2,100 m' },
  { time: '09:00', activity: 'Trekking', place: 'Nag Tibba', alt: '3,022 m' },
  { time: '17:30', activity: 'Camping', place: 'Har Ki Dun', alt: '3,566 m' },
  { time: '21:40', activity: 'Stargazing', place: 'George Everest', alt: '2,024 m' },
] as const

export default function TrekBuddyPage() {
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Trek Buddy"
          title="Never go alone."
          subtitle="Post the hour you're going, and whoever else is heading that way that day finds you. Not a booking platform — just a way to not walk it by yourself."
          variant="altitude"
        />

        <section className="bg-paper px-6 pb-20 pt-16 md:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest">
                A day on the hill
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
                Illustrative — not live posts
              </span>
            </div>

            <div className="grid grid-cols-1 divide-y divide-rule sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
              {ACTIVITIES.map((a) => (
                <div key={a.activity} className="py-6 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">{a.time}</div>
                  <h2 className="mt-2 font-display text-xl text-text">{a.activity}</h2>
                  <p className="mt-1 font-body text-sm text-mid">{a.place}</p>
                  <p className="font-body text-xs text-mid/70">{a.alt}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 border-t border-rule pt-10">
              <h2 className="font-display text-[clamp(24px,3vw,34px)] leading-tight text-text">
                It isn&apos;t built yet.
              </h2>
              <p className="mt-3 max-w-xl font-body text-sm leading-relaxed text-mid md:text-base">
                We would rather say that plainly than put up a form that goes nowhere. When Trek
                Buddy opens, the people on our list hear first — the same list that gets one email
                a month.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-5">
                <Link
                  href="/treks"
                  className="rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors duration-300 hover:bg-forest-mid"
                >
                  Read the trail guide
                </Link>
                <Link
                  href="/customize"
                  className="border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors duration-300 hover:text-text"
                >
                  Make something to wear up there
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
