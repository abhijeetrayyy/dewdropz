import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Attach guest rental bookings to the account that owns the address.
 *
 * THE VULNERABILITY THIS REPLACES
 *
 * This logic used to live in `actions/rentals.ts` as an exported function in a
 * `'use server'` module — which makes it a public HTTP endpoint, whether or not
 * a client component imports it. Its signature was:
 *
 *     claimGuestRentalBookings(userId: string, email: string)
 *
 * Both halves of the identity were the caller's to choose, there was no
 * `getUser()`, no rate limit, and the body opened the service-role client,
 * which bypasses RLS. The rental council ran it against a dev server with no
 * cookies and no session; it reached the database and answered.
 *
 * Worse than "claim bookings for an address you know": the match was
 * `.ilike('email', address)`, a pattern match on unescaped input. `email ILIKE
 * '%'` matches every row, and `rental_bookings.email` is NOT NULL. So one
 * anonymous request with `["<any uuid>", "%"]` took ownership of every
 * unclaimed rental booking in the database — and because the web booking form
 * never sent a `userId`, every booking made on the website is unclaimed. That
 * is the customer list, with home addresses and phone numbers, plus the power
 * to cancel every live hire (a cancelled reservation is excluded from the
 * exclusion constraint, so the season's calendar empties with it).
 *
 * This is migration 093's defect exactly — a control whose name asserts a check
 * it does not perform — one layer above where 093 looked. The docstring on the
 * old function even stated the invariant it failed to enforce: "the account has
 * already proved control of that address by signing in to it."
 *
 * SO: this module is `server-only` and exports no server action. It cannot be
 * reached from a browser. The two legitimate callers each prove the identity
 * themselves before calling in:
 *
 *   - `actions/rentals.ts` → `claimGuestRentalBookings()` takes no arguments and
 *     reads `getUser()`.
 *   - `app/api/mobile/rentals/claim/route.ts` verifies the bearer token against
 *     the auth server and passes the values off the verified user.
 *
 * `.eq`, never `.ilike`: the wildcard was the whole bug, and a case-insensitive
 * match buys nothing here because both sides are lowercased.
 */
export async function claimGuestRentalBookingsFor(userId: string, email: string) {
  const address = email.trim().toLowerCase()
  // A blank address would match nothing, but an empty pattern is exactly the
  // shape of input that made the old version catastrophic. Refuse it loudly.
  if (!address || !userId) return { claimed: 0 }

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_bookings')
    .update({ user_id: userId })
    .is('user_id', null)
    .eq('email', address)
    .select('id')

  const claimed = data?.length ?? 0
  if (claimed > 0) {
    console.info(`[rentals] claimed ${claimed} guest booking(s) for ${address}`)
  }
  return { claimed }
}
