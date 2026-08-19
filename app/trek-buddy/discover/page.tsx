import { redirect } from 'next/navigation'

// Discover WAS the board, in a second layout, under a second header.
//
// Two routes showing the same walks meant every walk had two differently
// styled doors, the filters were forked between them, and neither one was
// obviously the product. The better of the two layouts is now the board
// itself, so this is a redirect rather than a page — and every link and
// bookmark that pointed here still lands somewhere true.
export default async function DiscoverRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (v) q.set(k, v)
  const s = q.toString()
  redirect(s ? `/trek-buddy?${s}` : '/trek-buddy')
}
