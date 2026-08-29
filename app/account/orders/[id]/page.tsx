import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText, Package2 } from 'lucide-react'
import { requireAuth } from '@/actions/auth'
import { getOrder } from '@/actions/orders'
import { getShipmentsForOrder } from '@/actions/shipments'
import { getOrderPromotions } from '@/actions/promotions'
import { splitTax } from '@/lib/tax'
import { getReturnEligibility, getReturnsForOrder } from '@/actions/returns'
import { getInvoiceForOrder } from '@/lib/invoicing'
import { Surface, Panel, PanelHeader } from '@/components/ui/surface'
import StatusBadge, { PAYMENT_STATUS } from '@/components/ui/status-badge'
import OrderTrack from '@/components/account/OrderTrack'
import ReturnRequest from './ReturnRequest'
import { formatPrice } from '@/lib/utils'
import CancelOrderButton from './CancelOrderButton'

// ── One order, in full ───────────────────────────────────────────────────────
//
// Every section of this page — address, payment, tracking, the invoice, the
// parcels, the line items, the tax breakdown, the returns — used to live inside
// a single `p-6 border rounded-sm bg-paper` box. Nine unrelated subjects in one
// enclosure, on a card the same colour as the page behind it, which is why the
// most information-dense screen in the account read as the least organised.
//
// The content is unchanged. What changes is that it now has structure: the
// order's *state* leads, the things you might act on sit in the main column,
// and the reference material — where it is going, what it cost — moves to a
// column that stays put while you read.

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

  const label = 'font-mono text-[9px] uppercase tracking-[0.18em] text-light'
  const money = 'flex items-center justify-between font-body text-sm text-mid'

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 font-body text-xs text-mid transition-colors hover:text-forest"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          All orders
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-text">Order {order.order_number}</h2>
            <p className="mt-1 font-body text-sm text-mid">
              Placed on{' '}
              {new Date(order.created_at || '').toLocaleDateString('en-IN', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
          {canCancel && <CancelOrderButton orderId={order.id} userId={user.id} />}
        </div>
      </div>

      {/* ── State, first ───────────────────────────────────────────────────
          The question the page exists to answer, above everything else. */}
      <Panel className="px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <StatusBadge status={order.payment_status} map={PAYMENT_STATUS} />
        </div>
        <OrderTrack status={order.status} className="mt-7" />
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-6 lg:order-1">
          {/* Items */}
          <Panel>
            <PanelHeader title={`${order.items?.length ?? 0} item${(order.items?.length ?? 0) === 1 ? '' : 's'}`} />
            <div className="divide-y divide-rule-soft">
              {order.items?.map((item) => {
                // `||` — an empty preview column must fall through, not win.
                const preview =
                  item.design?.front_preview_url || item.design?.back_preview_url || item.product?.images?.[0]
                return (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-4 md:px-6">
                    {preview && (
                      <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-[var(--r-input)] border border-rule bg-paper-warm">
                        <Image src={preview} alt="" fill sizes="56px" className="object-cover" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-body text-sm text-text">
                        {item.product_name}
                        {item.variant_name ? ` — ${item.variant_name}` : ''}
                      </div>
                      {item.custom_design_id && (
                        <span className="mt-1 inline-block rounded-[var(--r-tag)] bg-sage-soft px-1.5 py-0.5 font-body text-[10px] uppercase tracking-[0.08em] text-forest">
                          Your design
                        </span>
                      )}
                      <div className="mt-0.5 font-body text-xs text-mid">
                        Qty {item.quantity} × {formatPrice(item.unit_price)}
                      </div>
                    </div>
                    <div className="font-body text-sm tabular-nums text-text">
                      {formatPrice(item.total_price)}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Parcels. An order can ship in more than one box — each carries its
              own courier, AWB and scan history, which is the whole reason a
              single tracking column on the order was not enough. */}
          {shipments.length > 0 && (
            <Panel>
              <PanelHeader title={shipments.length === 1 ? 'Your parcel' : 'Your parcels'} />
              <div className="space-y-4 p-5 md:p-6">
                {shipments.map((s, i) => (
                  <Surface key={s.id} elevation="flat" className="bg-paper-warm/60 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div className="font-body text-sm text-text">
                        {shipments.length > 1 && (
                          <span className="mr-2 font-mono text-xs text-mid">
                            {String(i + 1).padStart(2, '0')}
                          </span>
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
                      <ol className="mt-4 space-y-2 border-t border-rule-soft pt-3">
                        {[...s.events]
                          .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                          .map((e) => (
                            <li key={e.id} className="flex gap-3 font-body text-xs">
                              <span className="w-24 shrink-0 font-mono text-[10px] text-light">
                                {new Date(e.occurred_at).toLocaleDateString('en-IN', {
                                  day: '2-digit', month: 'short',
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
                  </Surface>
                ))}
              </div>
            </Panel>
          )}

          {/* Returns already opened on this order, so a customer can see where a
              request got to instead of wondering whether it registered. */}
          {returns.length > 0 && (
            <Panel>
              <PanelHeader title="Returns" />
              <div className="divide-y divide-rule-soft">
                {returns.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3 md:px-6">
                    <span className="font-mono text-xs text-mid">{r.rma_number}</span>
                    <StatusBadge status={String(r.status)} size="sm" />
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {eligibility.eligible && <ReturnRequest orderId={id} lines={eligibility.lines} />}
        </div>

        {/* ── Reference column ─────────────────────────────────────────────
            Sticky: the totals and the address are what a customer scrolls back
            up to check, and on an order with a long scan history that was a
            long way back up. */}
        <div className="space-y-6 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <Panel className="p-5 md:p-6">
            <p className={label}>Delivering to</p>
            <address className="mt-2 font-body text-sm not-italic leading-relaxed text-text">
              {address?.full_name}
              <br />
              {address?.address_line1}
              {address?.address_line2 ? `, ${address.address_line2}` : ''}
              <br />
              {address?.city}, {address?.state} {address?.postal_code}
            </address>

            <p className={`${label} mt-5`}>Payment</p>
            <p className="mt-2 font-body text-sm capitalize text-text">
              {order.payment_status.replace('_', ' ')} — {order.payment_method?.toUpperCase() ?? '—'}
            </p>

            {/* Falls back to the order's own tracking columns for orders placed
                before shipments existed, so history does not go blank. */}
            <p className={`${label} mt-5`}>Tracking</p>
            {shipments.length === 0 && !order.tracking_number && (
              <p className="mt-2 font-body text-sm text-mid">Not available yet</p>
            )}
            {shipments.length === 0 && order.tracking_number && (
              <p className="mt-2 font-body text-sm text-text">
                {order.carrier} —{' '}
                <a
                  href={order.tracking_url || '#'}
                  className="text-forest hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {order.tracking_number}
                </a>
              </p>
            )}
            {shipments.length > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 font-body text-sm text-text">
                <Package2 className="h-3.5 w-3.5 text-light" strokeWidth={1.75} aria-hidden="true" />
                {shipments.length === 1 ? '1 parcel' : `${shipments.length} parcels`}
              </p>
            )}
          </Panel>

          {/* Totals */}
          <Panel className="p-5 md:p-6">
            <div className="space-y-1.5">
              <div className={money}>
                <span>Subtotal</span>
                <span className="tabular-nums text-text">{formatPrice(order.subtotal)}</span>
              </div>
              <div className={money}>
                <span>Shipping</span>
                <span className="tabular-nums text-text">{formatPrice(order.shipping_cost)}</span>
              </div>
              {/* GST is shown the way it is levied: one line per rate, split into
                  CGST/SGST for a delivery inside our own state and IGST outside
                  it. A single "Tax" line is not something a customer can
                  reconcile against an invoice. */}
              {order.tax_amount > 0 &&
                (order.tax_breakdown?.length ? (
                  order.tax_breakdown.map((b) => {
                    const split = splitTax(b.tax, order.tax_is_igst)
                    return order.tax_is_igst ? (
                      <div key={b.rate} className={money}>
                        <span>IGST {b.rate}%</span>
                        <span className="tabular-nums text-text">{formatPrice(split.igst)}</span>
                      </div>
                    ) : (
                      <div key={b.rate} className="space-y-1.5">
                        <div className={money}>
                          <span>CGST {b.rate / 2}%</span>
                          <span className="tabular-nums text-text">{formatPrice(split.cgst)}</span>
                        </div>
                        <div className={money}>
                          <span>SGST {b.rate / 2}%</span>
                          <span className="tabular-nums text-text">{formatPrice(split.sgst)}</span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  // Orders placed before per-line tax existed carry only a total.
                  <div className={money}>
                    <span>Tax</span>
                    <span className="tabular-nums text-text">{formatPrice(order.tax_amount)}</span>
                  </div>
                ))}
              {/* Promotions are named; anything left over is the coupon, which
                  the customer typed themselves and already knows about. */}
              {orderPromotions.map((p) => (
                <div key={p.label} className={money}>
                  <span>{p.label}</span>
                  <span className="tabular-nums text-forest">−{formatPrice(p.amount)}</span>
                </div>
              ))}
              {order.discount_amount - promotionTotal > 0 && (
                <div className={money}>
                  <span>Discount</span>
                  <span className="tabular-nums text-forest">
                    −{formatPrice(order.discount_amount - promotionTotal)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-rule-soft pt-3 font-body text-base font-medium">
              <span className="text-text">Total</span>
              <span className="tabular-nums text-forest">{formatPrice(order.total_amount)}</span>
            </div>
          </Panel>

          {/* The tax invoice, when one exists.
              Gated on the invoice ROW, deliberately — not on the order's status.
              Every order dispatched before invoicing existed is 'shipped' with
              no invoice behind it, and a link that 404s on a tax document is
              worse than no link at all. */}
          {invoice && (
            <Panel className="p-5 md:p-6">
              <p className={label}>Tax invoice</p>
              <p className="mt-2 font-mono text-sm text-text">{invoice.serial}</p>
              <p className="font-body text-xs text-mid">
                Issued{' '}
                {new Date(invoice.issued_at).toLocaleDateString('en-IN', {
                  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
                })}
              </p>
              <a
                href={`/api/invoice/${invoice.id}`}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[var(--r-input)] border border-rule bg-surface px-4 font-body text-[11px] uppercase tracking-[0.12em] text-text transition-colors hover:border-forest hover:text-forest"
              >
                <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                View / download
              </a>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
