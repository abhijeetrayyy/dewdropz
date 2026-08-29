import { requireAuth, getProfile } from '@/actions/auth'
import { getUserOrders } from '@/actions/orders'
import { getUserDesigns } from '@/actions/designs'
import { getMyRentalBookings } from '@/actions/rentals'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import AccountRail from '@/components/account/AccountRail'
import LogoutButton from './LogoutButton'

// ── The signed-in shell ──────────────────────────────────────────────────────
//
// The old shell was a 72px headline on bare cream, a column of seven identical
// text links, and the page. Nothing was lifted off anything, so seven pages
// that each had real content — orders, artwork, bookings — all read as the same
// empty sheet.
//
// Two changes carry most of the difference. The header is now a dark anchor
// band: signing in should feel like crossing a threshold into somewhere, and
// the storefront's own language for "the subject has changed" is a full-bleed
// dark ground. And the ground under the content steps to `--paper-warm`, so the
// white cards that now hold every page have something to sit on. Cream stopped
// being the card and went back to being the floor.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth('/account')
  const profile = await getProfile()

  // The rail shows counts, so it needs them. All three are cheap and cached per
  // request; fetched together rather than in series so the shell is not three
  // round-trips deep before it renders.
  const [{ total: orderCount }, designs, rentals] = await Promise.all([
    getUserOrders(user.id, 1),
    getUserDesigns(),
    getMyRentalBookings(),
  ])

  const firstName = profile?.full_name?.split(' ')[0] || 'Trekker'

  return (
    <>
      <NavBar />

      <main className="min-h-screen bg-paper-warm">
        {/* The threshold. */}
        <header className="relative overflow-hidden bg-forest-deep pt-32 pb-14">
          {/* First light along the horizon of the band — the one warm note, and
              the reason this reads as dawn on a ridge rather than a dark box. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-dawn/60 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-forest-mid/30 blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-6 md:px-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-dawn">
              Your account
            </p>
            <h1 className="mt-4 font-display text-[clamp(38px,5.5vw,64px)] uppercase leading-[0.92] text-paper">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-paper/55">
              Your orders, your artwork and the gear you have out — all in one place.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:px-10 md:pt-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[236px_1fr] lg:gap-12">
            {/* `self-start` + `sticky`: on the long pages (orders, addresses)
                the rail used to scroll away entirely, so moving between
                sections meant scrolling back to the top first. */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <AccountRail
                counts={{ orders: orderCount, designs: designs.length, rentals: rentals.length }}
                isAdmin={profile?.role === 'admin'}
              >
                <LogoutButton />
              </AccountRail>
            </aside>

            <div className="min-h-[40vh]">{children}</div>
          </div>
        </div>
      </main>

      <FooterSection />
    </>
  )
}
