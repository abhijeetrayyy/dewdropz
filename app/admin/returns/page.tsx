import { getAllReturns, getReturnCounts, type ReturnStatus } from '@/actions/returns'
import ReturnsQueue from './ReturnsQueue'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25
const TABS = ['requested', 'approved', 'received', 'refunded', 'rejected']

// The team's side of a return. Without this, requests land in the database and
// nobody sees them — which is worse than having no returns flow, because the
// customer has been told one exists.
//
// The tab and page live in the URL rather than in component state: the queue
// now fetches one status at a time (it used to load every return ever filed and
// filter in the browser), so the selected tab has to be something the server
// can read.
export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const params = await searchParams
  const tab = TABS.includes(params.tab ?? '') ? params.tab! : 'requested'
  const page = Math.max(0, parseInt(params.page ?? '0') || 0)

  const [{ returns, total }, counts] = await Promise.all([
    getAllReturns(tab as ReturnStatus, { limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    getReturnCounts(),
  ])

  return (
    <ReturnsQueue
      returns={returns as never[]}
      counts={counts}
      tab={tab}
      page={page}
      total={total}
      pageSize={PAGE_SIZE}
    />
  )
}
