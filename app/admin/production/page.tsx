import Link from 'next/link'
import { getPrintQueue, getPrintQueueCounts } from '@/actions/production'
import DesignPanel from '@/components/admin/DesignPanel'
import PrintedToggle from '@/components/admin/PrintedToggle'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

// The print room's screen: every customised line still waiting to be produced,
// across all live orders, oldest first.
//
// It exists because production is the one step that is neither picking nor
// packing — before this, the only way to find work was to open orders one at a
// time and hope you spotted the custom badge.
export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const params = await searchParams
  const showPrinted = params.tab === 'printed'
  const page = Math.max(0, parseInt(params.page ?? '0') || 0)

  const [{ jobs, total }, counts] = await Promise.all([
    getPrintQueue({ printed: showPrinted, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    getPrintQueueCounts(),
  ])
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Print Queue</h2>
        <p className="text-sm text-gray-500 mt-1">
          Customised items waiting to be printed, oldest first. Cancelled and refunded orders are
          excluded — nothing here is work that has already been called off.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['To print', 'queue', counts.queued],
          ['Printed', 'printed', counts.printed],
        ].map(([label, key, count]) => {
          const active = (key === 'printed') === showPrinted
          return (
            <Link
              key={key as string}
              href={`/admin/production?tab=${key}`}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-600 hover:border-gray-500'
              }`}
            >
              {label} <span className="opacity-60">{count as number}</span>
            </Link>
          )
        })}
      </div>

      {jobs.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-1">
              {showPrinted ? 'Nothing printed yet' : 'Nothing waiting to print'}
            </p>
            <p className="text-sm text-gray-500 max-w-sm">
              {showPrinted
                ? 'Items appear here once they have been marked printed.'
                : 'Every customised item on a live order has been printed.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.itemId}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/orders/${job.orderId}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {job.orderNumber}
                      </Link>
                      <Badge variant="secondary" className="capitalize">{job.orderStatus}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {job.productName}
                      {job.variantName && <span className="text-gray-400"> — {job.variantName}</span>}
                      <span className="ml-2 tabular-nums text-gray-400">×{job.quantity}</span>
                    </div>
                    {job.productionNote && (
                      <p className="mt-1 text-xs text-gray-500">{job.productionNote}</p>
                    )}
                  </div>
                  <PrintedToggle
                    itemId={job.itemId}
                    printed={Boolean(job.printedAt)}
                    printedBy={job.printedBy}
                    printedAt={job.printedAt}
                  />
                </div>

                <div className="mt-4">
                  <DesignPanel design={job.design} itemId={job.itemId} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page + 1} of {pageCount} · {total} item{total === 1 ? '' : 's'}</span>
          <div className="flex gap-2">
            <Link
              href={`/admin/production?tab=${showPrinted ? 'printed' : 'queue'}&page=${page - 1}`}
              aria-disabled={page === 0}
              className={`rounded-md border px-3 py-1.5 ${page === 0 ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'}`}
            >
              Prev
            </Link>
            <Link
              href={`/admin/production?tab=${showPrinted ? 'printed' : 'queue'}&page=${page + 1}`}
              aria-disabled={page + 1 >= pageCount}
              className={`rounded-md border px-3 py-1.5 ${page + 1 >= pageCount ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'}`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
