import Link from 'next/link'
import { requireAuth, getProfile } from '@/actions/auth'
import { getUserOrders } from '@/actions/orders'
import OrderThumbs from '@/components/account/OrderThumbs'
import { formatPrice } from '@/lib/utils'
import RecentlyViewed from '@/components/sections/RecentlyViewed'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
}

export default async function AccountPage() {
  const user = await requireAuth()
  const profile = await getProfile()
  const { orders, total } = await getUserOrders(user.id, 5)
  const totalSpent = orders
    .filter((o) => o.payment_status === 'paid' || o.payment_status === 'partially_refunded')
    .reduce((sum, o) => sum + o.total_amount, 0)

  return (
    <div className="space-y-12">
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 border border-rule rounded-sm bg-paper">
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-1">Name</div>
            <div className="font-body text-sm text-text">{profile?.full_name || '—'}</div>
          </div>
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-1">Email</div>
            <div className="font-body text-sm text-text">{user.email}</div>
          </div>
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-1">Orders Placed</div>
            <div className="font-body text-sm text-text">{total}</div>
          </div>
        </div>
        <Link href="/account/settings" className="mt-3 inline-block font-body text-xs text-forest hover:underline">
          Edit profile →
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-text">Recent Orders</h2>
          {total > 0 && (
            <Link href="/account/orders" className="font-body text-xs text-forest hover:underline">
              View all →
            </Link>
          )}
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
                  <div className="flex items-center gap-4">
                    <OrderThumbs items={order.items ?? []} size={40} />
                    <div>
                      <span className="font-body text-xs font-bold text-text bg-rule px-2 py-1 rounded-sm">
                        {order.order_number}
                      </span>
                      <span className="ml-3 font-body text-xs text-mid">
                        {new Date(order.created_at || '').toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
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
      </section>

      {totalSpent > 0 && (
        <p className="font-body text-xs text-mid">
          {formatPrice(totalSpent)} spent across {orders.filter((o) => o.payment_status === 'paid' || o.payment_status === 'partially_refunded').length} paid order{orders.length === 1 ? '' : 's'}.
        </p>
      )}

      <RecentlyViewed />
    </div>
  )
}
