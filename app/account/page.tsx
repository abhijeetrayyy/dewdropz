import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Package, Palette } from 'lucide-react'
import { requireAuth } from '@/actions/auth'
import { getUserOrders } from '@/actions/orders'
import { getUserDesigns } from '@/actions/designs'
import { Surface, Panel, PanelHeader } from '@/components/ui/surface'
import StatusBadge from '@/components/ui/status-badge'
import EmptyState from '@/components/ui/empty-state'
import OrderCard from '@/components/account/OrderCard'
import OrderThumbs from '@/components/account/OrderThumbs'
import OrderTrack from '@/components/account/OrderTrack'
import RecentlyViewed from '@/components/sections/RecentlyViewed'
import { formatPrice } from '@/lib/utils'
import { BLUR_DATA_URL } from '@/lib/constants'

// ── The overview ─────────────────────────────────────────────────────────────
//
// This page used to be a three-cell box reading Name / Email / Orders Placed.
// Every one of those is a fact the person already had — they typed two of them
// and the third is a number with nothing to do. It was the landing screen for
// signing in and it gave no reason to have signed in.
//
// What a customer of a print-to-order shop actually wants on arrival, in order:
// where is the thing I bought, what did I make, and what do I do next. So the
// page leads with the order still in flight — the one live thing in the
// account — and everything else is secondary to it.

export default async function AccountPage() {
  const user = await requireAuth()
  const [{ orders, total }, designs] = await Promise.all([
    getUserOrders(user.id, 5),
    getUserDesigns(),
  ])

  // "In flight" is anything that has not landed and has not stopped. Taking the
  // most recent means a customer with three open orders sees the newest, which
  // is the one they are most likely wondering about.
  const inFlight = orders.find(
    (o) => !['delivered', 'cancelled', 'refunded'].includes(o.status)
  )

  const paidOrders = orders.filter(
    (o) => o.payment_status === 'paid' || o.payment_status === 'partially_refunded'
  )
  const totalSpent = paidOrders.reduce((sum, o) => sum + o.total_amount, 0)

  return (
    <div className="space-y-10">
      {/* ── The live order ─────────────────────────────────────────────────
          Given a panel of its own and the dawn accent, because it is the only
          thing on this screen that is happening right now. */}
      {inFlight ? (
        <Panel className="overflow-hidden">
          <div className="relative border-b border-rule-soft bg-gradient-to-r from-dawn-soft/50 to-transparent px-5 py-4 md:px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember">
              In progress
            </p>
          </div>

          <div className="px-5 py-6 md:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <OrderThumbs items={inFlight.items ?? []} size={56} />
                <div>
                  <p className="font-mono text-[11px] tracking-[0.06em] text-text">
                    {inFlight.order_number}
                  </p>
                  <p className="mt-1 font-body text-xs text-mid">
                    Placed{' '}
                    {new Date(inFlight.created_at || '').toLocaleDateString('en-IN', {
                      month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <StatusBadge status={inFlight.status} />
            </div>

            <OrderTrack status={inFlight.status} className="mt-8" />

            <div className="mt-7 flex items-center justify-between border-t border-rule-soft pt-4">
              <span className="font-body text-sm font-medium tabular-nums text-text">
                {formatPrice(inFlight.total_amount)}
              </span>
              <Link
                href={`/account/orders/${inFlight.id}`}
                className="inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.14em] text-forest transition-colors hover:text-forest-mid"
              >
                Track this order
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Panel>
      ) : total === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" strokeWidth={1.5} />}
          title="Nothing on its way yet."
          body="When you order something, this is where you will watch it get made and sent."
          action={{ label: 'Browse the shop', href: '/shop' }}
          secondary={{ label: 'Design your own', href: '/customize' }}
        />
      ) : null}

      {/* ── The numbers ────────────────────────────────────────────────────
          Kept, but demoted to a strip and made of things that are actually
          worth knowing — not the customer's own email address. */}
      {total > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Orders', value: String(total) },
            { label: 'Spent', value: formatPrice(totalSpent) },
            { label: 'Designs saved', value: String(designs.length) },
          ].map((stat) => (
            <Surface key={stat.label} className="px-4 py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-light">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-[clamp(20px,2.6vw,26px)] leading-none tabular-nums text-text">
                {stat.value}
              </p>
            </Surface>
          ))}
        </div>
      )}

      {/* ── Recent orders ──────────────────────────────────────────────── */}
      {orders.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-text">Recent orders</h2>
            {total > orders.length && (
              <Link
                href="/account/orders"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest hover:underline"
              >
                All {total} →
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}

      {/* ── Saved artwork ──────────────────────────────────────────────────
          The account holds the customer's own designs and used to list them on
          a separate page as bordered boxes. They are pictures; on the landing
          screen they get shown as pictures. */}
      {designs.length > 0 && (
        <Panel>
          <PanelHeader
            title="Your designs"
            action={
              <Link
                href="/account/designs"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest hover:underline"
              >
                See all
              </Link>
            }
          />
          <div className="flex gap-3 overflow-x-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {designs.slice(0, 6).map((design) => {
              const preview = design.front_preview_url || design.back_preview_url
              const href = design.product?.slug
                ? `/products/${design.product.slug}/customize`
                : '/customize'
              return (
                <Link
                  key={design.id}
                  href={href}
                  className="group relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-[var(--r-input)] border border-rule bg-paper-warm transition-[border-color,box-shadow] hover:border-forest/30 hover:shadow-[var(--shadow-card)]"
                >
                  {preview ? (
                    <Image
                      src={preview}
                      alt={design.product?.name ?? 'Saved design'}
                      fill
                      sizes="112px"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center">
                      <Palette className="h-5 w-5 text-light" strokeWidth={1.5} />
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </Panel>
      )}

      <RecentlyViewed />
    </div>
  )
}
