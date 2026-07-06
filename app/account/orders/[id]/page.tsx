import { requireAuth } from '@/actions/auth'
import { getOrder } from '@/actions/orders'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth()
  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()

  return (
    <div className="space-y-8">
      <div>
        <Link href="/account" className="font-body text-xs text-mid hover:text-forest transition-colors mb-4 inline-block">
          ← Back to Orders
        </Link>
        <h2 className="font-display text-2xl text-text">Order {order.order_number}</h2>
        <p className="font-body text-sm text-mid mt-1">
          Placed on {new Date(order.created_at || '').toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="p-6 border border-rule rounded-sm bg-paper space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-2">Shipping Address</div>
            <div className="font-body text-sm text-text whitespace-pre-wrap">
              {/* @ts-ignore */}
              {order.shipping_address?.full_name}<br/>
              {/* @ts-ignore */}
              {order.shipping_address?.address_line1}<br/>
              {/* @ts-ignore */}
              {order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.postal_code}
            </div>
          </div>
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-2">Order Status</div>
            <div className="font-body text-sm capitalize text-text">{order.status}</div>
            
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-2 mt-4">Tracking</div>
            {order.tracking_number ? (
              <div className="font-body text-sm text-text">
                {order.carrier} - <a href={order.tracking_url || '#'} className="text-forest hover:underline" target="_blank" rel="noreferrer">{order.tracking_number}</a>
              </div>
            ) : (
              <div className="font-body text-sm text-mid">Not available yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
