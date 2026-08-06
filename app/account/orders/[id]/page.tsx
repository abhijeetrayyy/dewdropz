import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/actions/auth'
import { getOrder } from '@/actions/orders'
import { formatPrice } from '@/lib/utils'
import CancelOrderButton from './CancelOrderButton'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const { id } = await params
  const order = await getOrder(id, user.id)
  if (!order) notFound()

  const address = order.shipping_address as {
    full_name?: string
    address_line1?: string
    address_line2?: string
    city?: string
    state?: string
    postal_code?: string
    phone?: string
  } | null

  const canCancel = order.status === 'pending' || order.status === 'confirmed'

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/account/orders" className="font-body text-xs text-mid hover:text-forest transition-colors mb-4 inline-block">
            ← Back to Orders
          </Link>
          <h2 className="font-display text-2xl text-text">Order {order.order_number}</h2>
          <p className="font-body text-sm text-mid mt-1">
            Placed on {new Date(order.created_at || '').toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {canCancel && <CancelOrderButton orderId={order.id} userId={user.id} />}
      </div>

      <div className="p-6 border border-rule rounded-sm bg-paper space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-rule">
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-2">Shipping Address</div>
            <div className="font-body text-sm text-text leading-relaxed">
              {address?.full_name}<br />
              {address?.address_line1}{address?.address_line2 ? `, ${address.address_line2}` : ''}<br />
              {address?.city}, {address?.state} {address?.postal_code}
            </div>
          </div>
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-2">Order Status</div>
            <div className="font-body text-sm text-text">{STATUS_LABEL[order.status] ?? order.status}</div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-2 mt-4">Payment</div>
            <div className="font-body text-sm text-text capitalize">{order.payment_status.replace('_', ' ')} — {order.payment_method?.toUpperCase() ?? '—'}</div>
          </div>
          <div>
            <div className="font-body text-xs text-mid uppercase tracking-[0.1em] mb-2">Tracking</div>
            {order.tracking_number ? (
              <div className="font-body text-sm text-text">
                {order.carrier} — <a href={order.tracking_url || '#'} className="text-forest hover:underline" target="_blank" rel="noreferrer">{order.tracking_number}</a>
              </div>
            ) : (
              <div className="font-body text-sm text-mid">Not available yet</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {order.items?.map((item) => {
            const preview = item.design?.front_preview_url ?? item.design?.back_preview_url
            return (
              <div key={item.id} className="flex items-center gap-4">
                {preview && (
                  <div className="relative w-14 h-16 rounded-sm overflow-hidden flex-shrink-0 bg-rule/40">
                    <Image src={preview} alt="" fill sizes="56px" className="object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm text-text">
                    {item.product_name}{item.variant_name ? ` — ${item.variant_name}` : ''}
                  </div>
                  {item.custom_design_id && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded-sm bg-forest/10 text-forest text-[10px] tracking-[0.08em] uppercase">
                      Custom Design
                    </span>
                  )}
                  <div className="font-body text-xs text-mid mt-0.5">Qty {item.quantity} × {formatPrice(item.unit_price)}</div>
                </div>
                <div className="font-body text-sm text-text tabular-nums">{formatPrice(item.total_price)}</div>
              </div>
            )
          })}
        </div>

        <div className="pt-4 border-t border-rule space-y-1.5">
          <div className="flex items-center justify-between font-body text-sm text-mid">
            <span>Subtotal</span>
            <span className="tabular-nums text-text">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between font-body text-sm text-mid">
            <span>Shipping</span>
            <span className="tabular-nums text-text">{formatPrice(order.shipping_cost)}</span>
          </div>
          {order.tax_amount > 0 && (
            <div className="flex items-center justify-between font-body text-sm text-mid">
              <span>Tax</span>
              <span className="tabular-nums text-text">{formatPrice(order.tax_amount)}</span>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="flex items-center justify-between font-body text-sm text-mid">
              <span>Discount</span>
              <span className="tabular-nums text-forest">−{formatPrice(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-body text-base font-medium pt-2">
            <span className="text-text">Total</span>
            <span className="text-forest tabular-nums">{formatPrice(order.total_amount)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
