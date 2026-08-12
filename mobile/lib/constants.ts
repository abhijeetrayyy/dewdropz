// ── All data from the DewDropz web app's lib/constants.ts ──
// Prices are in whole rupees on web; we store in paise for mobile.

// Mirrors the web app's default `store_settings` (actions/settings.ts) —
// hardcoded here the same way CartView.tsx hardcodes its own local copy,
// since mobile has no settings query yet. Centralized to one constant so
// Cart and Checkout can't drift from each other the way the two web files do.
export const FREE_SHIPPING_THRESHOLD_PAISE = 200000; // ₹2,000
export const FLAT_SHIPPING_RATE_PAISE = 15000; // ₹150

