import { requireAuth, getProfile } from '@/actions/auth'
import { getUserOrders } from '@/actions/orders'
import Link from 'next/link'
import RecentlyViewed from './RecentlyViewed'

export default async function AccountPage() {
  const user = await requireAuth()
  const profile = await getProfile()
  const orders = await getUserOrders(user.id, 10)

  return (
    <div className="space-y-12">
      <section>
        <h2 className="font-display text-2xl text-text mb-6">Profile Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border border-rule rounded-sm bg-paper">
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-1">Full Name</div>
            <div className="font-body text-sm text-text">{profile?.full_name || '—'}</div>
          </div>
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-1">Email Address</div>
            <div className="font-body text-sm text-text">{user.email}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl text-text mb-6">Order History</h2>
        
        {orders.length === 0 ? (
          <div className="p-8 border border-dashed border-rule rounded-sm text-center">
            <p className="font-body text-sm text-mid">You haven't placed any orders yet.</p>
            <Link href="/shop" className="mt-4 inline-block font-body text-xs tracking-widest uppercase text-forest hover:underline">
              Start Exploring
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="p-6 border border-rule rounded-sm hover:border-forest/30 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <span className="font-body text-xs font-bold text-text bg-rule px-2 py-1 rounded-sm">
                      {order.order_number}
                    </span>
                    <span className="ml-3 font-body text-xs text-mid">
                      {new Date(order.created_at || '').toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-body text-xs tracking-wider uppercase ${
                      order.status === 'delivered' ? 'text-forest' :
                      order.status === 'cancelled' ? 'text-clay' :
                      'text-sage'
                    }`}>
                      {order.status}
                    </span>
                    <span className="font-body text-sm font-medium text-text tabular-nums">
                      Rs. {(order.total_amount / 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Optional: Add a link to view order details page if it existed */}
                <div className="text-right">
                  <Link href={`/account/orders/${order.id}`} className="font-body text-[10px] uppercase tracking-widest text-mid hover:text-forest transition-colors">
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <RecentlyViewed />
    </div>
  )
}
