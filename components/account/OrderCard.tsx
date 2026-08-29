import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Surface } from '@/components/ui/surface'
import StatusBadge, { PAYMENT_STATUS } from '@/components/ui/status-badge'
import OrderThumbs from '@/components/account/OrderThumbs'
import { formatPrice } from '@/lib/utils'
import type { CustomerOrderRow } from '@/actions/orders'

// One order, as a row. Written once because the overview and the history page
// were carrying two drifting copies of the same 30 lines — and neither of them
// was on the design system.

export default function OrderCard({ order }: { order: CustomerOrderRow }) {
  const count = order.items?.length ?? 0
  // Payment is only worth surfacing when it is *not* the happy path. A "Paid"
  // badge on every row is noise; an unpaid one is the whole message.
  const showPayment = order.payment_status !== 'paid'

  return (
    <Surface
      as={Link}
      href={`/account/orders/${order.id}`}
      interactive
      className="block p-4 md:p-5"
    >
      <div className="flex items-center gap-4">
        <OrderThumbs items={order.items ?? []} size={48} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-mono text-[11px] tracking-[0.06em] text-text">
              {order.order_number}
            </span>
            <StatusBadge status={order.status} size="sm" />
            {showPayment && (
              <StatusBadge status={order.payment_status} map={PAYMENT_STATUS} size="sm" />
            )}
          </div>
          <p className="mt-1.5 font-body text-xs text-mid">
            {new Date(order.created_at || '').toLocaleDateString('en-IN', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
            <span className="mx-1.5 text-rule-warm">·</span>
            {count} item{count === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <span className="font-body text-sm font-medium tabular-nums text-text">
            {formatPrice(order.total_amount)}
          </span>
          <ChevronRight
            className="h-4 w-4 text-light transition-transform duration-300 group-hover:translate-x-0.5"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>
      </div>
    </Surface>
  )
}
