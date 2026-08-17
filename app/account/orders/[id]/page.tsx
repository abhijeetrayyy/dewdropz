import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/actions/auth'
import { getOrder } from '@/actions/orders'
import { getShipmentsForOrder } from '@/actions/shipments'
import { getOrderPromotions } from '@/actions/promotions'
import { splitTax } from '@/lib/tax'
import { getReturnEligibility, getReturnsForOrder } from '@/actions/returns'
import { getInvoiceForOrder } from '@/lib/invoicing'
import ReturnRequest from './ReturnRequest'
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

// The courier's vocabulary, said the way a customer would say it.
const SHIPMENT_LABEL: Record<string, string> = {
  pending: 'Packed',
  label_created: 'Label created',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  failed: 'Delivery failed',
  rto: 'Returning to us',
  cancelled: 'Cancelled',
}

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const { id } = await params
  const order = await getOrder(id, user.id)
  if (!order) notFound()

  const orderPromotions = await getOrderPromotions(id)
  const promotionTotal = orderPromotions.reduce((n, p) => n + p.amount, 0)

  // Both read through RLS, scoped to the caller's own orders.
  const eligibility = await getReturnEligibility(id)
  const returns = await getReturnsForOrder(id)

  // Ownership is already established: getOrder() above returned null for anyone
  // else's order and we called notFound(). The route that actually serves the
  // document re-checks it independently.
  const invoice = await getInvoiceForOrder(id)

  // RLS restricts this to the caller's own orders, so no extra ownership check.
  const shipments = (await getShipmentsForOrder(id)) as {
    id: string
    courier_name: string | null
    awb: string | null
    tracking_url: string | null
    status: string
    events: { id: string; status: string; description: string | null; location: string | null; occurred_at: string }[]
  }[]

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
            {/* Falls back to the order's own tracking columns for orders placed
                before shipments existed, so history does not go blank. */}
            {shipments.length === 0 && !order.tracking_number && (
              <div className="font-body text-sm text-mid">Not available yet</div>
            )}
            {shipments.length === 0 && order.tracking_number && (
              <div className="font-body text-sm text-text">
                {order.carrier} — <a href={order.tracking_url || '#'} className="text-forest hover:underline" target="_blank" rel="noreferrer">{order.tracking_number}</a>
              </div>
            )}
            {shipments.length > 0 && (
              <div className="font-body text-sm text-text">
                {shipments.length === 1 ? '1 parcel' : `${shipments.length} parcels`}
              </div>
            )}
          </div>
        </div>

        {/* The tax invoice, when one exists.
            Gated on the invoice ROW, deliberately — not on the order's status.
            Every order dispatched before invoicing existed is 'shipped' with no
            invoice behind it, and a link that 404s on a tax document is worse
            than no link at all. */}
        {invoice && (
          <div className="mt-10">
            <div className="mb-4 font-body text-xs uppercase tracking-[0.1em] text-mid">
              Tax invoice
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-rule p-4">
              <div>
                <div className="font-mono text-sm text-text">{invoice.serial}</div>
                <div className="font-body text-xs text-mid">
                  Issued {new Date(invoice.issued_at).toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </div>
              </div>
              <a
                href={`/api/invoice/${invoice.id}`} target="_blank" rel="noopener"
                className="rounded-sm border border-text px-4 py-2 font-body text-xs uppercase tracking-[0.1em] text-text transition hover:bg-text hover:text-white"
              >
                View / download
              </a>
            </div>
          </div>
        )}

        {/* Parcels. An order can ship in more than one box — each carries its
            own courier, AWB and scan history, which is the whole reason a single
            tracking column on the order was not enough. */}
        {shipments.length > 0 && (
          <div className="mt-10">
            <div className="mb-4 font-body text-xs uppercase tracking-[0.1em] text-mid">
              {shipments.length === 1 ? 'Your parcel' : 'Your parcels'}
            </div>
            <div className="space-y-4">
              {shipments.map((s, i) => (
                <div key={s.id} className="rounded-sm border border-rule p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="font-body text-sm text-text">
                      {shipments.length > 1 && (
                        <span className="mr-2 font-mono text-xs text-mid">{String(i + 1).padStart(2, '0')}</span>
                      )}
                      {s.courier_name ?? 'Parcel'}
                      {s.awb && <span className="ml-2 font-mono text-xs text-mid">{s.awb}</span>}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest">
                      {SHIPMENT_LABEL[s.status] ?? s.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {s.tracking_url && (
                    <a
                      href={s.tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block font-body text-sm text-forest hover:underline"
                    >
                      Track this parcel →
                    </a>
                  )}

                  {/* The history a bare status field can never give you. */}
                  {s.events?.length > 0 && (
                    <ol className="mt-4 space-y-2 border-t border-rule pt-3">
                      {[...s.events]
                        .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                        .map((e) => (
                          <li key={e.id} className="flex gap-3 font-body text-xs">
                            <span className="w-28 shrink-0 font-mono text-[10px] text-mid">
                              {new Date(e.occurred_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                            <span className="text-text">
                              {SHIPMENT_LABEL[e.status] ?? e.status.replace(/_/g, ' ')}
                              {e.description ? ` — ${e.description}` : ''}
                              {e.location ? ` · ${e.location}` : ''}
                            </span>
                          </li>
                        ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {order.items?.map((item) => {
            const preview = item.design?.front_preview_url ?? item.design?.back_preview_url ?? item.product?.images?.[0]
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
          {/* GST is shown the way it is levied: one line per rate, split into
              CGST/SGST for a delivery inside our own state and IGST outside it.
              A single "Tax" line is not something a customer can reconcile
              against an invoice. */}
          {order.tax_amount > 0 && (
            order.tax_breakdown?.length ? (
              order.tax_breakdown.map((b) => {
                const split = splitTax(b.tax, order.tax_is_igst)
                return order.tax_is_igst ? (
                  <div key={b.rate} className="flex items-center justify-between font-body text-sm text-mid">
                    <span>IGST {b.rate}%</span>
                    <span className="tabular-nums text-text">{formatPrice(split.igst)}</span>
                  </div>
                ) : (
                  <div key={b.rate} className="space-y-1.5">
                    <div className="flex items-center justify-between font-body text-sm text-mid">
                      <span>CGST {b.rate / 2}%</span>
                      <span className="tabular-nums text-text">{formatPrice(split.cgst)}</span>
                    </div>
                    <div className="flex items-center justify-between font-body text-sm text-mid">
                      <span>SGST {b.rate / 2}%</span>
                      <span className="tabular-nums text-text">{formatPrice(split.sgst)}</span>
                    </div>
                  </div>
                )
              })
            ) : (
              // Orders placed before per-line tax existed carry only a total.
              <div className="flex items-center justify-between font-body text-sm text-mid">
                <span>Tax</span>
                <span className="tabular-nums text-text">{formatPrice(order.tax_amount)}</span>
              </div>
            )
          )}
          {/* Promotions are named; anything left over is the coupon, which the
              customer typed themselves and already knows about. */}
          {orderPromotions.map((p) => (
            <div key={p.label} className="flex items-center justify-between font-body text-sm text-mid">
              <span>{p.label}</span>
              <span className="tabular-nums text-forest">−{formatPrice(p.amount)}</span>
            </div>
          ))}
          {order.discount_amount - promotionTotal > 0 && (
            <div className="flex items-center justify-between font-body text-sm text-mid">
              <span>Discount</span>
              <span className="tabular-nums text-forest">−{formatPrice(order.discount_amount - promotionTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-body text-base font-medium pt-2">
            <span className="text-text">Total</span>
            <span className="text-forest tabular-nums">{formatPrice(order.total_amount)}</span>
          </div>
        </div>

        {/* Returns already opened on this order, so a customer can see where a
            request got to instead of wondering whether it registered. */}
        {returns.length > 0 && (
          <div className="mt-10 border-t border-rule pt-6">
            <h2 className="font-body text-xs uppercase tracking-[0.1em] text-mid">Returns</h2>
            <div className="mt-3 space-y-2">
              {returns.map((r) => (
                <div key={r.id} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-mono text-xs text-mid">{r.rma_number}</span>
                  <span className="text-text capitalize">{String(r.status).replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {eligibility.eligible && <ReturnRequest orderId={id} lines={eligibility.lines} />}
      </div>
    </div>
  )
}
