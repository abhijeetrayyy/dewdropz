import { getRentalItemsAdmin, getRentalBookings } from '@/actions/rentals'
import { RentalsClient } from './RentalsClient'

export const metadata = { title: 'Rentals — DEWDROPZ Admin' }

export default async function AdminRentalsPage() {
  // Sent with the page, like the product editor — these functions run in US
  // East and the people using this are in India, so a fetch-after-mount is a
  // second crossing that cannot start until the first has finished.
  const [items, bookings] = await Promise.all([getRentalItemsAdmin(), getRentalBookings()])
  return <RentalsClient initialItems={items} initialBookings={bookings} />
}
