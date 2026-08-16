import { getTags } from '@/actions/tags'
import TagsClient from './TagsClient'

// Server component: the list arrives with the page instead of costing a second
// round-trip after it mounts. Everything after first paint — reload after an
// add, edit or delete — still happens client-side.
export default async function TagsPage() {
  const tags = await getTags()
  return <TagsClient initial={tags} />
}
