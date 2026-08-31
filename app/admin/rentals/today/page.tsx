import { getRentalDaySheet } from '@/actions/rentalOps'
import { shopToday } from '@/lib/shopTime'
import DaySheet from '@/components/admin/RentalDaySheet'

/**
 * The 8am screen.
 *
 * `getRentalDaySheet` has existed, correct, since the rental work began — and
 * had ZERO callers. Its own docstring says the shop wants this "in the morning,
 * before anybody opens an admin panel", and there was no page, no tile and no
 * email. Meanwhile the bookings list sorts newest-first with a hard
 * `.limit(100)` and no status filter, so the word "overdue" appeared nowhere in
 * the admin and a rental three days late sat below forty newer ones.
 *
 * A hire business does not lose money on the booking it took. It loses money on
 * the tent nobody remembered was due back on Tuesday.
 */
export const metadata = { title: 'Today · Rentals' }

export default async function RentalTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const { day } = await searchParams
  const sheet = await getRentalDaySheet(day)
  return <DaySheet sheet={sheet} today={shopToday()} />
}
