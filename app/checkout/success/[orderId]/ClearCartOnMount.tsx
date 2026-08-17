'use client'

import { useEffect } from 'react'
import { useCart } from '@/providers/CartProvider'

// Empties the cart here, and only here.
//
// It used to happen in the checkout component, one line before router.push():
//
//   clear()
//   router.push(`/account/orders/${result.orderId}?success=true`)
//
// clear() updates state synchronously, so React re-rendered the checkout with
// an empty cart and hit its own early return — "Your cart is empty. Add
// something before checking out." — and that is what the customer stared at
// while the next page loaded. They had just paid.
//
// Moving it here fixes that and one more thing: if the navigation had failed
// for any reason, the old order left the customer with no cart AND no order
// page. Now the cart survives until the confirmation has actually rendered, so
// the two can never come apart.
export default function ClearCartOnMount() {
  const { clear } = useCart()

  useEffect(() => {
    clear()
    // Runs once, on the confirmation. `clear` is stable, but listing it would
    // re-run this if the provider ever re-created it — and clearing an already
    // empty cart repeatedly is pointless churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
