import Link from 'next/link'
import { getAbandonedCarts, getAbandonedCartSummary } from '@/actions/abandonedCarts'
import { ABANDONED_AFTER_HOURS, ABANDONED_GIVE_UP_DAYS } from '@/lib/abandonedCarts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatPrice } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

function ago(hours: number) {
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function AbandonedCartsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  // A server component, so the page lives in the URL rather than in state —
  // which also means a link to page 3 is a link to page 3.
  const { page: pageParam } = await searchParams
  const page = Math.max(0, parseInt(pageParam ?? '0') || 0)

  const [{ carts, total }, summary] = await Promise.all([
    getAbandonedCarts({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    // Summed across every abandoned cart, not just this page — "value at stake"
    // that only counted the fifty rows on screen would be a smaller number
    // every time the list grew.
    getAbandonedCartSummary(),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Abandoned Carts</h2>
        <p className="text-sm text-gray-500 mt-1">
          Signed-in customers whose cart has sat untouched for more than {ABANDONED_AFTER_HOURS} hours.
          The scheduled job emails each one once and gives up after {ABANDONED_GIVE_UP_DAYS} days.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Carts sitting', String(summary.carts)],
          ['Value at stake', formatPrice(summary.value)],
          ['Emailed / recovered', `${summary.emailed} / ${summary.recovered}`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
              <div className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Cart</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead>Reminder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    Nothing abandoned right now.
                  </TableCell>
                </TableRow>
              ) : carts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{c.name ?? c.email}</div>
                    {c.name && <div className="text-xs text-gray-500">{c.email}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    <div>{c.itemCount} item{c.itemCount === 1 ? '' : 's'}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[280px]">
                      {c.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-gray-900">{formatPrice(c.value)}</TableCell>
                  <TableCell className="text-sm text-gray-500">{ago(c.hoursIdle)}</TableCell>
                  <TableCell>
                    {c.recoveredAt
                      ? <Badge variant="success">Recovered</Badge>
                      : c.recoverySentAt
                        ? <Badge variant="secondary">Sent {ago(c.hoursSinceReminder ?? 0)}</Badge>
                        // Past the give-up window nothing will ever be sent, so
                        // "Queued" would be a promise the job does not keep.
                        : c.hoursIdle > ABANDONED_GIVE_UP_DAYS * 24
                          ? <Badge variant="secondary">Too old</Badge>
                          : <Badge variant="warning">Queued</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page + 1} of {pageCount} · {total} carts</span>
          <div className="flex gap-2">
            <Link
              href={`/admin/abandoned-carts?page=${page - 1}`}
              aria-disabled={page === 0}
              className={`rounded-md border px-3 py-1.5 ${page === 0 ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'}`}
            >
              Prev
            </Link>
            <Link
              href={`/admin/abandoned-carts?page=${page + 1}`}
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
