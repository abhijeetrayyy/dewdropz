import { Package } from 'lucide-react'
import { requireAuth } from '@/actions/auth'
import { getUserOrders } from '@/actions/orders'
import OrderCard from '@/components/account/OrderCard'
import Pagination from '@/components/account/Pagination'
import EmptyState from '@/components/ui/empty-state'

const PAGE_SIZE = 10

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const user = await requireAuth('/account/orders')
  const { page: pageParam } = await searchParams
  const page = Math.max(0, parseInt(pageParam ?? '0', 10) || 0)
  const { orders, total } = await getUserOrders(user.id, PAGE_SIZE, page * PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-text">Order history</h2>
        <p className="mt-1 font-body text-sm text-mid">
          {total} order{total === 1 ? '' : 's'}
          {pageCount > 1 && (
            <>
              <span className="mx-1.5 text-rule-warm">·</span>
              page {page + 1} of {pageCount}
            </>
          )}
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" strokeWidth={1.5} />}
          title="No orders yet."
          body="Everything you buy will be listed here, with its artwork and where it has got to."
          action={{ label: 'Browse the shop', href: '/shop' }}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} hrefFor={(p) => `/account/orders?page=${p}`} />
    </div>
  )
}
