import Link from 'next/link'
import { SectionLabel } from './ui/Bits'
import { Lockup } from './ui/Mark'

// The foot of the product.
//
// The storefront's footer was being used here, and it contained not one link
// to anything in Trek Buddy across its four columns — so the bottom of every
// page on a social platform was a shop's site map. This one closes the loop:
// where to go next inside the board, where the rules are, and the one line
// that has to appear everywhere, which is that nobody here is being supervised.

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'The board',
    links: [
      { label: 'Discover', href: '/trek-buddy' },
      { label: 'People', href: '/trek-buddy/people' },
      { label: 'Basecamp', href: '/trek-buddy/basecamp' },
      { label: 'Messages', href: '/trek-buddy/messages' },
    ],
  },
  {
    heading: 'Yours',
    links: [
      { label: 'Your profile', href: '/trek-buddy/profile' },
      // The only route to a trip that has finished. It is not in the top bar
      // because that is a five-tab thumb bar on a phone and W-01 measured it at
      // 360px with nothing to spare — so the footer is where a member finds
      // their own history from any screen.
      { label: 'What you have done', href: '/trek-buddy/past' },
      { label: 'Host something', href: '/trek-buddy/new' },
      { label: 'Trail guide', href: '/treks' },
      { label: 'The shop', href: '/shop' },
    ],
  },
  {
    heading: 'DEWDROPZ',
    links: [
      // First in this group on purpose. The landing page's account of what is
      // enforced and where it stops moved to its own page; a member who joined
      // before that, or who skimmed it, should be able to find it from any
      // screen rather than only from a page they see once.
      { label: 'What is enforced', href: '/trek-buddy/safety' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
]

export default function TrekFooter({
  signedIn,
  canHost,
}: {
  signedIn: boolean
  canHost: boolean
}) {
  return (
    <footer className="trek-band bg-ink pb-10 pt-16">
      <div className="trek-measure">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Lockup tone="onink" />

            <p className="mt-5 max-w-xs font-body text-sm leading-relaxed text-paper/55">
              Members post the hour they are going, and other members ask to come. Not a booking
              platform, and nobody pays for a place.
            </p>
            {!signedIn && (
              <Link
                href="/auth/login?redirect=/trek-buddy"
                className="trek-pill trek-pill-actinv mt-7"
              >
                Create an account
              </Link>
            )}
            {signedIn && canHost && (
              <Link
                href="/trek-buddy/new"
                className="mt-7 inline-flex rounded-full border border-paper/25 px-6 py-3 font-body text-[13px] font-medium text-paper transition-colors hover:border-paper/70"
              >
                Post a trip
              </Link>
            )}
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <SectionLabel as="h3" tone="trust">
                {col.heading}
              </SectionLabel>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      // `inline-block` + padding: as a bare inline link this was a
                      // 17px tap target, under the 24px floor. The padding costs
                      // nothing on a mouse and makes the column reachable with a
                      // thumb.
                      className="inline-block py-1 font-body text-sm text-paper/65 transition-colors hover:text-paper"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-14 border-t border-paper/[0.12] pt-6 font-body text-xs leading-relaxed text-paper/65">
          DEWDROPZ does not organise, lead, vet or supervise anything posted here, and has not
          checked who anyone is. Meet somewhere public, tell someone who is not coming, and turn
          back if it feels wrong. In an emergency, call 112.
        </p>
      </div>
    </footer>
  )
}
