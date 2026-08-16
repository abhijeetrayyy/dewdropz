import { notFound } from 'next/navigation'
import { getProductEditorData } from '@/actions/products'
import ProductEditorClient from './ProductEditorClient'

// A server component, deliberately.
//
// This page used to be a client component that fetched on mount. That is one
// Atlantic crossing to fetch the page and a second, which cannot start until
// the first finishes, to fetch its data — and the functions run in US East
// while the people using this are in India. The database was never the slow
// part; the round-trips were.
//
// Fetching here folds the two into one: the data is gathered next to the
// database and travels down with the page. loading.tsx covers the wait, so the
// click still feels immediate.
export default async function ProductEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getProductEditorData(id)
  if (!data.product) notFound()

  return <ProductEditorClient productId={id} data={data} />
}
