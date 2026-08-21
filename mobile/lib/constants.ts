// ── Shop-wide numbers the app is allowed to know ──────────────────────────
//
// This file used to hold TWO of them, and one was a lie:
//
//   FREE_SHIPPING_THRESHOLD_PAISE = 200000  // ₹2,000
//   FLAT_SHIPPING_RATE_PAISE      = 15000   // ₹150
//
// with a comment claiming they mirrored the web app's default `store_settings`.
// The real default is ₹100, and the shop's live shipping zone charges ₹120 —
// so the number was wrong twice over. Worse, the pair of them WERE the app's
// pricing engine: cart and checkout rendered `subtotal + flat rate`, which
// omitted GST entirely because GST is additive. Measured against the live
// tax_rates, the app quoted ₹2,049 for a hoodie the server bills at ₹2,246.88,
// and since payment is cash on delivery, that ₹197.88 was collected at
// somebody's door by a courier.
//
// `lib/checkoutPricing.ts` on the web exists to make that impossible and says
// so in its header: one function prices the quote the customer approves and the
// order that bills them. The app now asks that function through
// /api/mobile/quote and does no arithmetic on money at all.
//
// The threshold survives because it is not a charge. It is the published
// number behind the "₹x to free shipping" meter — marketing copy that the
// server agrees with (store_settings.free_shipping_threshold = 200000). If the
// two ever disagree, the meter is cosmetic and the server still decides what
// delivery costs.
export const FREE_SHIPPING_THRESHOLD_PAISE = 200000; // ₹2,000
