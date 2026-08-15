import { ShippingEngine } from './ShippingEngine'

// Shipping used to be a tab inside Settings, which put zones, rates and the
// free-shipping threshold — things the team touches often — three clicks and a
// tab behind a page about the store's name.
export default function ShippingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Shipping</h2>
        <p className="text-sm text-gray-500 mt-1">
          Zones, rates and the free-shipping threshold. Parcels themselves live on each order.
        </p>
      </div>
      <ShippingEngine />
    </div>
  )
}
