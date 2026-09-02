import { getRentalItemsAdmin, getRentalBookings, getRentalCategories } from '@/actions/rentals'
import { RentalsClient } from './RentalsClient'

export const metadata = { title: 'Rentals — DEWDROPZ Admin' }

/**
 * The filter lives in the URL rather than in component state, for the same
 * reason it does on the storefront: the list is fetched on the SERVER, so a
 * status the browser held privately could not narrow the query — it could only
 * hide rows from a page that had already been fetched, which is what a
 * `.limit(100)` with no filter does badly. In the URL it reaches the database,
 * it survives a refresh after handing gear over, and "the overdue ones" is a
 * link somebody can keep open.
 */
export default async function AdminRentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(Number(sp.page) || 1, 1)

  // Sent with the page, like the product editor — these functions run in US
  // East and the people using this are in India, so a fetch-after-mount is a
  // second crossing that cannot start until the first has finished.
  const [items, bookings, categories] = await Promise.all([
    getRentalItemsAdmin(),
    getRentalBookings({ status: sp.status, q: sp.q, page }),
    getRentalCategories(),
  ])

  return (
    <RentalsClient
      initialItems={items}
      bookings={bookings.rows}
      total={bookings.total}
      page={bookings.page}
      perPage={bookings.perPage}
      status={sp.status ?? 'all'}
      query={sp.q ?? ''}
      categories={categories}
    />
  )
}
