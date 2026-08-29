import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/actions/auth'
import { getOrder } from '@/actions/orders'
import { getStoreSettings } from '@/actions/settings'
import { Check } from 'lucide-react'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import { formatPrice } from '@/lib/utils'
import { splitTax } from '@/lib/tax'
import ClearCartOnMount from './ClearCartOnMount'

export const metadata: Metadata = {
  title: 'Order confirmed — DEWDROPZ',
  // Nobody should land here from a search result, and it carries an address.
  robots: { index: false, follow: false },
}

// The moment after paying.
//
// There was nothing here at all. The checkout called clear() and then
// router.push(), so the cart emptied, React re-rendered, and the customer who
// had just paid was shown "Your cart is empty. Add something before checking
// out." while a server page loaded behind it. The push carried ?success=true
// and nothing anywhere read it.
//
// A route of its own rather than a flag on the account order page, for reasons
// that all bite in practice: it survives a refresh and the back button, it can
// be linked from the confirmation email, it is the only page that should ever
// clear the cart, and it is the one URL worth measuring a conversion on.
//
// Deliberately NOT a celebration for its own sake. What settles someone who has
// just spent money is specifics: the order number, what they paid, what happens
// next and roughly when, and how to reach a human. The reassurance comes from
// the facts being present, not from confetti.
export default async function OrderConfirmedPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const user = await requireAuth()
  const { orderId } = await params

  const [order, settings] = await Promise.all([getOrder(orderId, user.id), getStoreSettings()])
  if (!order) notFound()

  const isCod = order.payment_method === 'cod'
  const tax = splitTax(order.tax_amount ?? 0, order.tax_is_igst ?? false)
  const addr = order.shipping_address as Record<string, string> | null

  // Print-on-demand: nothing is sitting on a shelf. Saying "ships in 2 days"
  // would be a lie, and the vaguer "we'll let you know" is what makes people
  // email asking where their order is.
  const madeToOrder = (order.items ?? []).some((i) => i.custom_design_id)

  return (
    <>
      <NavBar />
      <main className="relative min-h-[70vh] overflow-hidden bg-paper-warm px-6 pb-24 pt-32 md:px-10 md:pt-40">
        <ClearCartOnMount />

        {/* First light, breaking behind the confirmation. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-dawn/15 blur-3xl"
        />

        <div className="relative mx-auto max-w-2xl">
          <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-dawn text-ink shadow-[var(--shadow-lift)]">
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </span>
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-ember">
            Order confirmed
          </p>
          <h1 className="mt-3 font-display font-light text-[clamp(30px,5vw,44px)] leading-tight text-text">
            Thank you{addr?.full_name ? `, ${addr.full_name.split(' ')[0]}` : ''}.
          </h1>
          <p className="mt-3 font-body text-sm text-mid max-w-md">
            {isCod
              ? `We've got your order. Keep ${formatPrice(order.total_amount)} ready in cash for the courier.`
              : `We've got your order and your payment came through.`}
          </p>

          <div className="mt-8 overflow-hidden rounded-[var(--r-panel)] border border-rule/70 bg-surface shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule-soft px-5 py-4">
              <div>
                <div className="font-body text-[10px] tracking-[0.14em] uppercase text-mid">Order number</div>
                <div className="font-mono text-base text-text mt-0.5">{order.order_number}</div>
              </div>
              <Link
                href={`/account/orders/${order.id}`}
                className="font-body text-xs tracking-[0.1em] uppercase text-forest underline underline-offset-4"
              >
                Track this order
              </Link>
            </div>

            <div className="px-5 py-4 space-y-3 border-b border-rule">
              {(order.items ?? []).map((it) => (
                <div key={it.id} className="flex items-baseline justify-between gap-4 font-body text-sm">
                  <span className="text-text">
                    {it.product_name}
                    {it.variant_name ? <span className="text-mid"> · {it.variant_name}</span> : null}
                    {it.quantity > 1 ? <span className="text-mid"> × {it.quantity}</span> : null}
                  </span>
                  <span className="text-mid tabular-nums shrink-0">{formatPrice(it.total_price)}</span>
                </div>
              ))}
            </div>

            {/* The same breakdown they approved at checkout, so the two agree. */}
            <div className="px-5 py-4 space-y-1.5 font-body text-sm">
              <div className="flex justify-between text-mid">
                <span>Subtotal</span><span className="tabular-nums">{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-forest">
                  <span>Discount</span><span className="tabular-nums">−{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-mid">
                <span>Delivery</span>
                <span className="tabular-nums">
                  {order.shipping_cost === 0 ? 'Free' : formatPrice(order.shipping_cost)}
                </span>
              </div>
              {(order.tax_amount ?? 0) > 0 && (
                order.tax_is_igst ? (
                  <div className="flex justify-between text-mid">
                    <span>IGST</span><span className="tabular-nums">{formatPrice(tax.igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-mid">
                      <span>CGST</span><span className="tabular-nums">{formatPrice(tax.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-mid">
                      <span>SGST</span><span className="tabular-nums">{formatPrice(tax.sgst)}</span>
                    </div>
                  </>
                )
              )}
              <div className="flex justify-between pt-2 mt-1 border-t border-rule text-base font-medium">
                <span className="text-text">{isCod ? 'To pay on delivery' : 'Paid'}</span>
                <span className="text-forest tabular-nums">{formatPrice(order.total_amount)}</span>
              </div>
            </div>
          </div>

          {addr && (
            <div className="mt-6">
              <div className="font-body text-[10px] tracking-[0.14em] uppercase text-mid">Delivering to</div>
              <p className="mt-1.5 font-body text-sm text-text leading-relaxed">
                {[addr.full_name, addr.line1, addr.line2, [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')]
                  .filter(Boolean)
                  .map((line, i) => <span key={i} className="block">{line}</span>)}
              </p>
            </div>
          )}

          <div className="mt-8 border-l-2 border-forest pl-4">
            <div className="font-body text-[10px] tracking-[0.14em] uppercase text-mid">What happens next</div>
            <ol className="mt-2 space-y-1.5 font-body text-sm text-mid">
              <li>
                <span className="text-text">1.</span>{' '}
                {madeToOrder
                  ? 'Your artwork goes to the press. Each piece is printed for you, so this takes a few days — nothing is sitting in a warehouse.'
                  : 'We pick and pack your order.'}
              </li>
              <li><span className="text-text">2.</span> We hand it to the courier and send you a tracking link.</li>
              <li>
                <span className="text-text">3.</span>{' '}
                {isCod
                  ? `The courier collects ${formatPrice(order.total_amount)} in cash at your door.`
                  : 'It arrives. Nothing further to pay.'}
              </li>
            </ol>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="rounded-full border border-text px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-text transition-colors hover:bg-text hover:text-paper"
            >
              Keep shopping
            </Link>
            <Link
              href={`/account/orders/${order.id}`}
              className="rounded-full bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper shadow-[var(--shadow-card)] transition-colors hover:bg-forest-mid"
            >
              View order
            </Link>
          </div>

          <p className="mt-8 font-body text-xs text-mid">
            Something wrong? Reply to your confirmation email or write to{' '}
            <a href={`mailto:${settings.support_email}`} className="text-forest underline underline-offset-4">
              {settings.support_email}
            </a>{' '}
            quoting {order.order_number}. You can cancel from your order page until it ships.
          </p>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
