import { getCategoryTree } from '@/actions/categories'
import CategoriesClient from './CategoriesClient'

// See the note in tags/page.tsx — same shape, same reason.
export default async function CategoriesPage() {
  const tree = await getCategoryTree()
  return <CategoriesClient initial={tree} />
}
