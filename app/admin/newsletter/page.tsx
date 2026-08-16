import { getNewsletterSubscribers } from '@/actions/newsletter'
import NewsletterClient from './NewsletterClient'

// See the note in customers/page.tsx.
export default async function NewsletterPage() {
  const { subscribers, total } = await getNewsletterSubscribers({ limit: 20, offset: 0 })
  return <NewsletterClient initial={{ rows: subscribers, total }} />
}
