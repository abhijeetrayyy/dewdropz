import Link from 'next/link'
import { requireAuth } from '@/actions/auth'
import { getUserOrders } from '@/actions/orders'
import { formatPrice } from '@/lib/utils'

const PAGE_SIZE = 10

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
}

export default async function OrderHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireAuth()
  const { page: pageParam } = await searchParams
  const page = Math.max(0, parseInt(pageParam ?? '0', 10) || 0)
  const { orders, total } = await getUserOrders(user.id, PAGE_SIZE, page * PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-text">Order History</h2>
        <p className="font-body text-sm text-mid mt-1">{total} order{total === 1 ? '' : 's'}</p>
      </div>

      {orders.length === 0 ? (
        <div className="p-8 border border-dashed border-rule rounded-sm text-center">
          <p className="font-body text-sm text-mid">You haven&apos;t placed any orders yet.</p>
          <Link href="/shop" className="mt-4 inline-block font-body text-xs tracking-widest uppercase text-forest hover:underline">
            Start Exploring
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="block p-6 border border-rule rounded-sm hover:border-forest/30 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="font-body text-xs font-bold text-text bg-rule px-2 py-1 rounded-sm">
                    {order.order_number}
                  </span>
                  <span className="ml-3 font-body text-xs text-mid">
                    {new Date(order.created_at || '').toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="ml-3 font-body text-xs text-mid">
                    {order.items?.length ?? 0} item{(order.items?.length ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-body text-xs tracking-wider uppercase ${
                    order.status === 'delivered' ? 'text-forest' :
                    order.status === 'cancelled' ? 'text-clay' :
                    'text-sage'
                  }`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                  <span className="font-body text-sm font-medium text-text tabular-nums">
                    {formatPrice(order.total_amount)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between font-body text-sm text-mid pt-4">
          <span>Page {page + 1} of {pageCount}</span>
          <div className="flex gap-4">
            {page > 0 && (
              <Link href={`/account/orders?page=${page - 1}`} className="hover:text-forest transition-colors">← Previous</Link>
            )}
            {page + 1 < pageCount && (
              <Link href={`/account/orders?page=${page + 1}`} className="hover:text-forest transition-colors">Next →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
