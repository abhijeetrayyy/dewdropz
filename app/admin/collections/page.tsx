import { getAllCollectionsAdmin } from '@/actions/collections'
import CollectionsClient from './CollectionsClient'

// See the note in customers/page.tsx.
export default async function CollectionsPage() {
  const { collections, total } = await getAllCollectionsAdmin({ limit: 20, offset: 0 })
  return <CollectionsClient initial={{ rows: collections, total }} />
}
