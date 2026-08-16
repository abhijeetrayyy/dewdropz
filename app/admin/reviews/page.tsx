import { getAllReviews } from '@/actions/reviews'
import ReviewsClient from './ReviewsClient'

// See the note in customers/page.tsx.
export default async function ReviewsPage() {
  const { reviews, total } = await getAllReviews({ limit: 20, offset: 0 })
  return <ReviewsClient initial={{ rows: reviews as Array<Record<string, unknown>>, total }} />
}
