import { getCoupons } from '@/actions/coupons'
import CouponsClient from './CouponsClient'

// See the note in tags/page.tsx — same shape, same reason.
export default async function CouponsPage() {
  const coupons = await getCoupons()
  return <CouponsClient initial={coupons} />
}
