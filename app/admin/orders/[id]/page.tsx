import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrderForAdmin } from '@/actions/orders'
import DesignPanel from '@/components/admin/DesignPanel'
import PrintedToggle from '@/components/admin/PrintedToggle'
import { getOrderPromotions } from '@/actions/promotions'
import { splitTax } from '@/lib/tax'
import { getShipmentsForOrderAdmin, getFulfillmentForOrder } from '@/actions/shipments'
import { getInvoiceForOrder } from '@/lib/invoicing'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import ShipmentManager from './ShipmentManager'
import IssueInvoiceButton from '@/components/admin/IssueInvoiceButton'

// One order, one page.
//
// Everything used to live inline on the list, so there was nowhere to see a
// single order's full story — its parcels, their scan history, or who changed
// what. For a team operating this daily that is the difference between
// answering a customer's question and guessing at it.

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Started together, not one after another. These four reads are independent —
  // nothing here needs the order row to know what to ask for — but they were
  // written as four sequential awaits, which measured 1,436ms against 721ms for
  // the same work in parallel. On a page whose whole job is to answer a
  // customer's question while they are on the phone, that is the difference
  // people feel.
  const [order, shipments, fulfillment, promotions, invoice] = await Promise.all([
    getOrderForAdmin(id),
    getShipmentsForOrderAdmin(id),
    getFulfillmentForOrder(id),
    getOrderPromotions(id),
    getInvoiceForOrder(id),
  ])
  if (!order) notFound()

  // Broken out so the money line reads "Monsoon Sale −₹300" rather than one
  // unattributed discount that nobody can trace back to a campaign.
  // Customised lines are pulled out because they are the ones that carry work:
  // artwork to check and a file to send to the press before anything can ship.
  const customLines = (order.items ?? []).filter((it) => it.custom_design_id)

  const promotionTotal = promotions.reduce((n, p) => n + p.amount, 0)

  // The money column, assembled once. GST prints one line per rate, split into
  // CGST/SGST inside our own state and IGST outside it — the way it is levied,
  // and the way it has to reconcile against a filed return.
  const moneyLines: [string, number][] = [
    ['Subtotal', order.subtotal],
    ['Shipping', order.shipping_cost],
    ...(order.tax_breakdown?.length
      ? order.tax_breakdown.flatMap((b): [string, number][] => {
          const split = splitTax(b.tax, order.tax_is_igst)
          return order.tax_is_igst
            ? [[`IGST ${b.rate}%`, split.igst]]
            : [[`CGST ${b.rate / 2}%`, split.cgst], [`SGST ${b.rate / 2}%`, split.sgst]]
        })
      // Orders placed before per-line tax existed carry only a total.
      : ([['Tax', order.tax_amount]] as [string, number][])),
    ...promotions.map((p): [string, number] => [p.label, -p.amount]),
    ...(order.discount_amount - promotionTotal > 0
      ? ([['Coupon', -(order.discount_amount - promotionTotal)]] as [string, number][])
      : []),
  ]

  // The audit trail for this order, read here rather than through a helper
  // because this is the only surface that needs it.
  const { data: audit } = await createAdminSupabaseClient()
    .from('admin_audit_log')
    .select('action, actor_email, before, after, note, created_at')
    .eq('entity_type', 'order')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const addr = order.shipping_address as Record<string, string> | null
  // The moment of supply. Dispatch is what an invoice is due against, and an
  // order can reach 'delivered' in one click without ever being stamped shipped.
  const dispatchedAt = (order.shipped_at ?? order.delivered_at) as string | null

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/admin/orders" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{order.order_number}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {new Date(order.created_at).toLocaleString('en-IN')} — {order.email}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs uppercase tracking-wide text-white">
            {order.status}
          </span>
          <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs uppercase tracking-wide text-neutral-600">
            {order.payment_status}
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-neutral-900">Items</h2>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {order.items?.map((it) => (
                  <tr key={it.id} className="border-t border-neutral-100">
                    <td className="py-2.5 text-neutral-900">
                      {it.product_name}
                      {it.variant_name && <span className="text-neutral-500"> — {it.variant_name}</span>}
                      {it.custom_design_id && (
                        <span className="ml-2 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
                          Custom
                        </span>
                      )}
                      {it.hsn_code && (
                        <span className="ml-2 text-[11px] text-neutral-400">HSN {it.hsn_code}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-neutral-500">×{it.quantity}</td>
                    <td className="py-2.5 text-right tabular-nums text-neutral-900">{formatPrice(it.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 space-y-1 border-t border-neutral-200 pt-3 text-sm">
              {moneyLines.map(([label, val]) => (
                <div key={label as string} className="flex justify-between text-neutral-500">
                  <span>{label}</span>
                  <span className="tabular-nums">{formatPrice(val as number)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 font-semibold text-neutral-900">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(order.total_amount)}</span>
              </div>
            </div>
          </section>

          {/* The reason this page exists: parcels are managed here, not just created. */}
          {customLines.length > 0 && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900">Artwork &amp; print files</h2>
                <Link href="/admin/production" className="text-xs text-neutral-500 underline hover:text-neutral-900">
                  Print queue
                </Link>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                This order cannot ship until these are printed.
              </p>
              <div className="mt-4 space-y-5">
                {customLines.map((it) => (
                  <div key={it.id}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-neutral-900">
                        {it.product_name}
                        {it.variant_name && <span className="text-neutral-500"> — {it.variant_name}</span>}
                        <span className="ml-2 text-neutral-400">×{it.quantity}</span>
                      </div>
                      <PrintedToggle
                        itemId={it.id}
                        printed={Boolean(it.printed_at)}
                        printedBy={it.printed_by}
                        printedAt={it.printed_at}
                      />
                    </div>
                    <DesignPanel design={it.design ?? null} itemId={it.id} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <ShipmentManager orderId={id} shipments={shipments} fulfillment={fulfillment} />
        </div>

        <div className="space-y-6">
          {/* The tax invoice. Present only once the order has dispatched, since
              that is when the serial is allocated — and shown as an explicit
              absence rather than hidden, so "where is the invoice?" has an
              answer on the page instead of in someone's head. */}
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-neutral-900">Tax invoice</h2>
            {invoice ? (
              <>
                <p className="mt-2 font-mono text-sm text-neutral-900">{invoice.serial}</p>
                <p className="text-xs text-neutral-500">
                  Issued {new Date(invoice.issued_at).toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
                  })}
                  {invoice.cancelled_at && ' · cancelled'}
                </p>
                {/* Rule 48(1) wants three marked copies for a supply of goods. */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['original', 'duplicate', 'triplicate'] as const).map((copy) => (
                    <a
                      key={copy}
                      href={`/api/admin/invoice/${invoice.id}?copy=${copy}`}
                      target="_blank" rel="noopener"
                      className="rounded border border-neutral-300 px-2 py-1 text-xs capitalize text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                    >
                      {copy}
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-neutral-500">
                  Not issued. The invoice is raised automatically when the first parcel is
                  dispatched, and needs the shop&apos;s GSTIN and registered address filled in
                  under Tax settings.
                </p>
                {/* Automatic issuance only ever fires at dispatch. An order that
                    dispatched while the GSTIN was still blank was refused then
                    and will never be retried, so the only way it is ever
                    invoiced is by hand from here. */}
                {dispatchedAt && order.status !== 'cancelled' && (
                  <>
                    <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                      This order already went out, so its automatic moment has passed and will
                      not come round again.
                    </p>
                    <IssueInvoiceButton
                      orderId={order.id}
                      orderNumber={order.order_number}
                      dispatchedAt={dispatchedAt}
                    />
                  </>
                )}
              </>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-neutral-900">Ship to</h2>
            {addr ? (
              <address className="mt-2 not-italic text-sm leading-relaxed text-neutral-600">
                {addr.full_name}<br />
                {addr.address_line1}{addr.address_line2 ? <>, {addr.address_line2}</> : null}<br />
                {addr.city}, {addr.state} {addr.postal_code}<br />
                {addr.phone}
              </address>
            ) : (
              <p className="mt-2 text-sm text-neutral-400">No address on file</p>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-neutral-900">History</h2>
            {audit?.length ? (
              <ol className="mt-3 space-y-3">
                {audit.map((a, i) => (
                  <li key={i} className="text-xs">
                    <div className="text-neutral-900">
                      {a.action.replace(/[._]/g, ' ')}
                      {a.before && a.after && typeof a.before === 'object' && 'status' in a.before ? (
                        <span className="text-neutral-500">
                          {' '}— {String((a.before as Record<string, unknown>).status)} →{' '}
                          {String((a.after as Record<string, unknown>).status)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-neutral-400">
                      {a.actor_email ?? 'system'} · {new Date(a.created_at).toLocaleString('en-IN')}
                    </div>
                    {a.note && <div className="mt-0.5 text-neutral-500">“{a.note}”</div>}
                  </li>
                ))}
              </ol>
            ) : (
              // Only actions taken since the audit log existed appear here.
              <p className="mt-2 text-xs text-neutral-400">No recorded changes yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
