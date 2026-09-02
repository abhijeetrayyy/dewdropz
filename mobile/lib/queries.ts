import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "./data";
import { supabase } from "./supabase";
import { ENV } from "./env";
import { getRecentlyViewed } from "./recentlyViewed";

// Centralized query-key factory — every screen imports keys from here rather
// than inlining string arrays, so invalidation (e.g. after placing an order)
// can target the right cache entries from anywhere.
export const qk = {
  products: ["products"] as const,
  product: (slug: string) => ["products", slug] as const,
  customizable: ["products", "customizable"] as const,
  productsBySlugs: (slugs: string[]) => ["products", "by-slugs", [...slugs].sort()] as const,
  collections: ["collections"] as const,
  categories: ["categories"] as const,
  home: ["home-config"] as const,
  orders: (userId: string) => ["orders", userId] as const,
  order: (id: string) => ["orders", "detail", id] as const,
  reviews: (productId: string) => ["reviews", productId] as const,
  rating: (productId: string) => ["reviews", "rating", productId] as const,
  addresses: (userId: string) => ["addresses", userId] as const,
  designs: (userId: string) => ["designs", userId] as const,
  notifications: (userId: string) => ["notifications", userId] as const,
  notificationPreferences: (userId: string) => ["notifications", "preferences", userId] as const,
  rentals: ["rentals"] as const,
  rentalItem: (slug: string) => ["rentals", slug] as const,
  // `where` is in this key because the PRICE DEPENDS ON IT: priceRental resolves
  // delivery through calculateShippingCost, which matches a shipping zone by
  // state, and then doubles it for the return leg. React Query refetches on a
  // key change, not on a queryFn closure change — so with the address outside
  // the key, typing a Maharashtra address never re-quoted and the screen kept
  // showing the no-address fallback price. Measured: ₹7,168.20 on the button,
  // ₹7,073.80 written to the booking.
  //
  // The file's own header says "NOTHING ON THIS SCREEN DOES ARITHMETIC ON
  // MONEY", and it doesn't. It cached the wrong answer instead. The rule was
  // written as "the client must not do arithmetic"; it needed to be "the figure
  // on screen must be for the terms on screen".
  rentalQuote: (
    slug: string, from: string, to: string, qty: number, ful: string, where: string,
  ) => ["rentals", "quote", slug, from, to, qty, ful, where] as const,
  rentalBookings: (userId: string) => ["rentals", "bookings", userId] as const,
  rentalCategories: ["rentals", "categories"] as const,
  rentalAvailability: (from: string, to: string) => ["rentals", "availability", from, to] as const,
  rentalDays: (itemId: string, from: string, to: string) => ["rentals", "days", itemId, from, to] as const,
  rentalHistory: (bookingId: string) => ["rentals", "history", bookingId] as const,
  rentalCancelQuote: (bookingId: string) => ["rentals", "cancel-quote", bookingId] as const,
  rentalBooking: (number: string) => ["rentals", "booking", number] as const,
};

export function useProductsQuery() {
  return useQuery({ queryKey: qk.products, queryFn: Data.getProducts, staleTime: 60_000 });
}

export function useProductQuery(slug: string | undefined) {
  return useQuery({
    queryKey: qk.product(slug ?? ""),
    queryFn: () => Data.getProductBySlug(slug!),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useCustomizableProductsQuery() {
  return useQuery({
    queryKey: qk.customizable,
    queryFn: Data.getCustomizableProducts,
    staleTime: 5 * 60_000,
  });
}

export function useProductsBySlugsQuery(slugs: string[]) {
  return useQuery({
    queryKey: qk.productsBySlugs(slugs),
    queryFn: () => Data.getProductsBySlugs(slugs),
    staleTime: 30_000,
  });
}

// The admin's homepage configuration (which rails, which collections and
// categories lead). Cached for five minutes like collections — merchandising
// config changes on a human timescale, not a per-scroll one.
export function useHomeQuery() {
  return useQuery({ queryKey: qk.home, queryFn: Data.getHomeData, staleTime: 5 * 60_000 });
}

export function useCollectionsQuery() {
  return useQuery({ queryKey: qk.collections, queryFn: Data.getCollections, staleTime: 5 * 60_000 });
}

// Taxonomy changes on a human timescale, same as collections.
export function useCategoriesQuery() {
  return useQuery({ queryKey: qk.categories, queryFn: Data.getCategories, staleTime: 5 * 60_000 });
}

export function useOrdersQuery(userId: string | undefined) {
  return useQuery({
    queryKey: qk.orders(userId ?? ""),
    queryFn: () => Data.getOrders(userId!),
    enabled: !!userId,
  });
}

export function useOrderQuery(id: string | undefined) {
  return useQuery({
    queryKey: qk.order(id ?? ""),
    queryFn: () => Data.getOrderById(id!),
    enabled: !!id,
  });
}

export function useProductReviewsQuery(productId: string | undefined) {
  return useQuery({
    queryKey: qk.reviews(productId ?? ""),
    queryFn: () => Data.getProductReviews(productId!),
    enabled: !!productId,
  });
}

export function useProductRatingQuery(productId: string | undefined) {
  return useQuery({
    queryKey: qk.rating(productId ?? ""),
    queryFn: () => Data.getProductRating(productId!),
    enabled: !!productId,
  });
}

export function useRecentlyViewedQuery(excludeSlug: string | undefined) {
  return useQuery({
    queryKey: ["recently-viewed", excludeSlug ?? ""],
    queryFn: async () => {
      const slugs = await getRecentlyViewed(excludeSlug);
      if (slugs.length === 0) return [];
      const products = await Data.getProductsBySlugs(slugs);
      // Preserve most-recent-first order — getProductsBySlugs' `.in(...)`
      // query doesn't guarantee it comes back in the same order as `slugs`.
      const bySlug = new Map(products.map((p) => [p.slug, p]));
      return slugs.map((s) => bySlug.get(s)).filter((p): p is Data.Product => !!p);
    },
    enabled: true,
  });
}

export function useAddressesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: qk.addresses(userId ?? ""),
    queryFn: () => Data.getAddresses(userId!),
    enabled: !!userId,
  });
}

export function useNotificationsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: qk.notifications(userId ?? ""),
    queryFn: () => Data.getNotifications(userId!),
    enabled: !!userId,
  });
}

export function useMarkNotificationReadMutation(userId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: Data.markNotificationRead,
    onSuccess: () => {
      if (userId) client.invalidateQueries({ queryKey: qk.notifications(userId) });
    },
  });
}

export function useMarkAllNotificationsReadMutation(userId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => Data.markAllNotificationsRead(userId!),
    onSuccess: () => {
      if (userId) client.invalidateQueries({ queryKey: qk.notifications(userId) });
    },
  });
}

export function useNotificationPreferencesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: qk.notificationPreferences(userId ?? ""),
    queryFn: () => Data.getNotificationPreferences(userId!),
    enabled: !!userId,
  });
}

export function useUpdateNotificationPreferencesMutation(userId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Data.NotificationPreferences) => Data.updateNotificationPreferences(userId!, prefs),
    onSuccess: (_, prefs) => {
      if (userId) client.setQueryData(qk.notificationPreferences(userId), prefs);
    },
  });
}

export function useCreateReviewMutation(productId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: Data.createReview,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.reviews(productId) });
      client.invalidateQueries({ queryKey: qk.rating(productId) });
    },
  });
}

export type CheckoutInput = {
  /** A saved address the shopper picked. The server reuses that row rather
   *  than writing a duplicate of it, which is what it used to do on every
   *  single order. */
  addressId?: string;
  /** Re-validated server-side by createOrder, not trusted from here. */
  couponCode?: string;
  fullName: string; phone: string; addressLine1: string; addressLine2?: string;
  city: string; state: string; postalCode: string;
  items: {
    slug: string;
    size?: string;
    quantity: number;
    // Customized lines carry their exact ids so the server links the saved
    // design to the order line instead of re-resolving by size string.
    productId?: string;
    variantId?: string | null;
    customDesignId?: string;
  }[];
};

export function useCheckoutMutation() {
  return useMutation({
    mutationFn: async (input: CheckoutInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");
      const res = await fetch(`${ENV.apiUrl}/api/mobile/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Some details couldn't be validated. Please check the form.";
        throw new Error(msg);
      }
      // `skippedItems` is what the server could NOT put on the order — a line
      // that went out of stock or was deactivated between adding it and
      // pressing the button. It was being discarded here while the cart was
      // cleared and a success screen was shown, so a customer could order
      // three things, receive two, and never be told which one was missing.
      return data as { orderId: string; skippedItems?: string[] };
    },
  });
}

/**
 * What this cart costs — asked of the server, never worked out here.
 *
 * The screens used to compute `subtotal + FLAT_SHIPPING_RATE` from two
 * constants in lib/constants.ts. That is the one thing lib/checkoutPricing.ts
 * on the web exists to prevent, and it had already drifted: the app quoted
 * ₹2,049 for a hoodie the server bills at ₹2,246.88, because GST is additive
 * and was missing entirely and the hardcoded ₹150 delivery is really a
 * zone rate of ₹120. On cash on delivery that gap is collected at the door.
 *
 * Kept `enabled` on a non-empty cart so an empty one does not fire a request,
 * and re-fetched when the destination changes because shipping and GST both
 * depend on it.
 */
export type CartQuote = {
  subtotal: number;
  discountAmount: number;
  promotions: { promotionId: string; label: string; amount: number }[];
  shippingCost: number;
  effectiveShipping: number;
  freeShipping: boolean;
  taxAmount: number;
  taxBreakdown: { rate: number; taxable: number; tax: number }[];
  taxIsIgst: boolean;
  taxEnabled: boolean;
  totalAmount: number;
  /** False until a destination is known — shipping and tax are provisional. */
  destinationKnown: boolean;
  /** Slugs the server could not price at all. */
  unavailable: string[];
};

export type QuoteLine = {
  slug: string;
  size?: string;
  quantity: number;
  productId?: string;
  variantId?: string | null;
  customDesignId?: string;
};

/**
 * One quote, fetched imperatively.
 *
 * Used to TRY a coupon. The obvious implementation — put the code straight into
 * `useQuoteQuery` — means a wrong code makes the whole quote fail, and the
 * order total on screen turns into an em dash because somebody mistyped
 * "SUMMER1O". So a code is validated on its own first, and only a code the
 * server accepted is allowed near the query that draws the total.
 */
export async function fetchQuote(
  items: QuoteLine[],
  opts?: { state?: string; postalCode?: string; couponCode?: string },
): Promise<CartQuote> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${ENV.apiUrl}/api/mobile/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({
      items,
      ...(opts?.state ? { state: opts.state } : {}),
      ...(opts?.postalCode?.length === 6 ? { postalCode: opts.postalCode } : {}),
      ...(opts?.couponCode ? { couponCode: opts.couponCode } : {}),
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Could not price this cart.");
  }
  return data as CartQuote;
}

export function useQuoteQuery(
  items: QuoteLine[],
  destination?: { state?: string; postalCode?: string; couponCode?: string },
) {
  const key = JSON.stringify({
    items: items.map((i) => [i.slug, i.size, i.quantity, i.variantId, i.customDesignId]),
    d: destination?.state ?? destination?.postalCode ?? null,
    c: destination?.couponCode ?? null,
  });

  return useQuery({
    queryKey: ["quote", key],
    enabled: items.length > 0,
    // A price is not something to serve from cache while it is being refetched.
    staleTime: 0,
    retry: 1,
    queryFn: () => fetchQuote(items, destination),
  });
}

export function useDeleteAddressMutation(userId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: Data.deleteAddress,
    onSuccess: () => client.invalidateQueries({ queryKey: qk.addresses(userId ?? "") }),
  });
}

export function useSetDefaultAddressMutation(userId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Data.setDefaultAddress(userId!, id),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.addresses(userId ?? "") }),
  });
}

/* ── Orders you can act on ────────────────────────────────────────────────
 * The app could not change an order after placing it. These are the two
 * things a customer actually needs: stop one that has not shipped, and send
 * back something that has arrived. Both are token-authed mobile routes over
 * the same rules the web uses — see app/api/mobile/orders/[id]/.
 * ─────────────────────────────────────────────────────────────────────── */

async function authed(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");
  const res = await fetch(`${ENV.apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "That did not work. Try again.");
  }
  return data;
}

export function useCancelOrderMutation(orderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      authed(`/api/mobile/orders/${orderId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }) as Promise<{ success: true; refundIssued: boolean }>,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.order(orderId) });
      client.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export type ReturnLine = { orderItemId: string; name: string; unitPrice: number; returnable: number };
export type ReturnEligibility = { eligible: boolean; reason: string | null; lines: ReturnLine[] };

export function useReturnEligibilityQuery(orderId: string, enabled = true) {
  return useQuery({
    queryKey: ["return-eligibility", orderId],
    enabled,
    staleTime: 0,
    queryFn: () => authed(`/api/mobile/orders/${orderId}/return`) as Promise<ReturnEligibility>,
  });
}

export function useRequestReturnMutation(orderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; note?: string; items: { orderItemId: string; quantity: number }[] }) =>
      authed(`/api/mobile/orders/${orderId}/return`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["return-eligibility", orderId] });
      client.invalidateQueries({ queryKey: qk.order(orderId) });
    },
  });
}

/**
 * Start an online payment.
 *
 * ⚠ UNVERIFIED — no Razorpay credentials exist in this repository, so nothing
 * below this line has been run against the gateway. See the header of
 * app/api/mobile/orders/razorpay/route.ts for what must be checked before it is
 * trusted with money.
 *
 * Creates the order and its Razorpay counterpart, and hands back the ids the
 * hosted payment page needs. The app never talks to Razorpay itself: it opens
 * `/pay/<orderId>` in a browser sheet, which keeps the key out of the bundle
 * and avoids a native module for a screen shown once per order.
 */
export function useRazorpayOrderMutation() {
  return useMutation({
    mutationFn: (input: CheckoutInput) =>
      authed("/api/mobile/orders/razorpay", {
        method: "POST",
        body: JSON.stringify(input),
      }) as Promise<{
        orderId: string;
        razorpayOrderId: string;
        amount: number;
        skippedItems?: string[];
      }>,
  });
}

export function useMyDesignsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: qk.designs(userId ?? ""),
    queryFn: () => Data.getMyDesigns(userId!),
    enabled: !!userId,
  });
}

/**
 * The design library, filtered to the blank the studio is open on.
 *
 * Keyed by blank so switching garment refetches rather than showing artwork
 * that cannot be printed on what the shopper is now holding. `enabled` keeps a
 * shopper who brings their own image from paying for a catalogue they will
 * never open — the panel fetches when it is first shown, not on studio mount.
 */
export function useLibraryDesignsQuery(blankId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["library-designs", blankId],
    queryFn: () => Data.getLibraryDesigns(blankId!),
    enabled: !!blankId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** The blank and artwork behind a finished print, for the product page badge. */
export function useCustomRangeQuery(product: {
  id: string; is_custom_range?: boolean | null; custom_blank_id?: string | null;
} | undefined) {
  return useQuery({
    queryKey: ["custom-range", product?.id, product?.is_custom_range, product?.custom_blank_id],
    queryFn: () => Data.getCustomRangeContext(product!),
    // Only asks when there is something to ask about — an ordinary product
    // never pays for this round trip. Keyed off the TICK, not the parent link:
    // a range product with no blank stocked still needs its card.
    enabled: !!product?.is_custom_range,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Rentals ─────────────────────────────────────────────────────────────────

export function useRentalItemsQuery() {
  return useQuery({ queryKey: qk.rentals, queryFn: Data.getRentalItems, staleTime: 5 * 60_000 });
}

export function useRentalItemQuery(slug: string | undefined) {
  return useQuery({
    queryKey: qk.rentalItem(slug ?? ""),
    queryFn: () => Data.getRentalItem(slug!),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export type RentalQuote = {
  price: {
    lines: {
      itemId: string; slug: string; name: string; days: number; quantity: number;
      dailyRate: number; rentAmount: number; discountAmount: number;
      depositAmount: number; taxAmount: number; gstRate: number;
    }[];
    rentAmount: number;
    discountAmount: number;
    deliveryAmount: number;
    taxAmount: number;
    depositAmount: number;
    totalAmount: number;
    payableWithDeposit: number;
    taxIsIgst: boolean;
    errors: string[];
  };
  /** Units free for exactly the dates that were just priced, keyed by slug. */
  availability: Record<string, number>;
};

export type RentalTerms = {
  slug: string;
  startsOn: string;
  endsOn: string;
  quantity: number;
  fulfilment: "pickup" | "ship";
  address?: { line1: string; city: string; state: string; postal_code: string } | null;
};

/**
 * The price of a rental and the state of the shelf, both from the server.
 *
 * Neither figure may be computed on the device. Rentals have more places to
 * drift than a cart does — days are counted inclusively, a long rental earns a
 * discount, posting is charged both ways, and the deposit is deliberately NOT
 * taxed — and `lib/rentalPricing.ts` is the only implementation of any of it.
 * The lesson is the one `useCartQuoteQuery` above exists to remember: the app
 * once quoted ₹2,049 for a hoodie the server billed at ₹2,226.88.
 *
 * Availability rides along in the same response on purpose. Fetched
 * separately, the price and the count can straddle somebody else's booking and
 * the screen ends up quoting for gear that is no longer there.
 */
export function useRentalForProductQuery(productId: string | undefined) {
  return useQuery({
    queryKey: ["rentals", "for-product", productId ?? ""],
    queryFn: () => Data.getRentalForProduct(productId!),
    enabled: !!productId,
    staleTime: 5 * 60_000,
  });
}

export function useRentalQuoteQuery(terms: RentalTerms | null) {
  return useQuery({
    queryKey: terms
      ? qk.rentalQuote(
          terms.slug,
          terms.startsOn,
          terms.endsOn,
          terms.quantity,
          terms.fulfilment,
          // Only the two fields the price actually turns on. Keying on the whole
          // address would refetch on every keystroke of a street name that
          // cannot change a single paisa.
          terms.fulfilment === "ship"
            ? `${terms.address?.state ?? ""}|${terms.address?.postal_code ?? ""}`
            : "pickup",
        )
      : ["rentals", "quote", "idle"],
    enabled: !!terms,
    // A quote is a claim about a shelf other people are also booking from, so
    // it is never served stale.
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async (): Promise<RentalQuote> => {
      const t = terms!;
      const res = await fetch(`${ENV.apiUrl}/api/mobile/rentals/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: [{ slug: t.slug, startsOn: t.startsOn, endsOn: t.endsOn, quantity: t.quantity }],
          fulfilment: t.fulfilment,
          // The schema wants an address for a posted rental because tax depends
          // on the destination state. Before one is entered we still want a
          // price, so a quote for "ship" with no address prices as Uttarakhand
          // and the total is refreshed the moment a pincode is typed.
          email: "quote@dewdropz.shop",
          address: t.fulfilment === "ship" && t.address ? t.address : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't price those dates.");
      return data as RentalQuote;
    },
  });
}

export function useRentalBookingMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: RentalTerms & { email: string; phone?: string },
    ): Promise<{ bookingId: string; bookingNumber: string; requiresPayment: boolean; holdExpiresAt: string }> => {
      // Signing in is optional — a guest can rent with an email, as on the web.
      // The token, when there is one, attaches the booking to the account so it
      // shows under "Your rentals" and RLS lets that person read it back.
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${ENV.apiUrl}/api/mobile/rentals/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          lines: [{ slug: input.slug, startsOn: input.startsOn, endsOn: input.endsOn, quantity: input.quantity }],
          fulfilment: input.fulfilment,
          email: input.email,
          phone: input.phone,
          address: input.fulfilment === "ship" && input.address
            ? { ...input.address, country: "India" }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "That booking didn't go through.");
      }
      // A 200 here means "we are HOLDING this for you", not "reserved" — the
      // booking keeps its units off the shelf and expires at `holdExpiresAt`
      // unless the rent is paid. The route returns `requiresPayment` precisely
      // so a screen cannot get that wrong by reading only `bookingNumber`,
      // which is what this app used to do and what quietly changed meaning
      // underneath it when pay-to-reserve shipped.
      return data as { bookingId: string; bookingNumber: string; requiresPayment: boolean; holdExpiresAt: string };
    },
    onSuccess: () => {
      // Every quote in the cache is now a statement about a shelf that has
      // changed. Drop them rather than let a stale count say a unit is free.
      client.invalidateQueries({ queryKey: qk.rentals });
    },
  });
}

export function useMyRentalBookingsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: qk.rentalBookings(userId ?? ""),
    queryFn: () => Data.getMyRentalBookings(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useRentalBookingQuery(bookingNumber: string | undefined) {
  return useQuery({
    queryKey: qk.rentalBooking(bookingNumber ?? ""),
    queryFn: () => Data.getRentalBookingByNumber(bookingNumber!),
    enabled: !!bookingNumber,
  });
}

// ─── The locker: shelves, the shelf itself, and the calendar ─────────────────

export function useRentalCategoriesQuery() {
  return useQuery({
    queryKey: qk.rentalCategories,
    queryFn: Data.getRentalCategories,
    // Shelves change when the shop reorganises the locker, which is roughly
    // never. An hour is generous and still self-correcting.
    staleTime: 60 * 60_000,
  });
}

/**
 * Every item's shelf for one date range.
 *
 * `staleTime: 0` and no cache, for the same reason the quote has neither: this
 * is a claim about a shelf other people are booking from, and a cached "4 free"
 * is a promise the shop may no longer be able to keep. It is one call for the
 * whole grid, so refetching it is cheap.
 */
export function useRentalAvailabilityQuery(from: string, to: string) {
  return useQuery({
    queryKey: qk.rentalAvailability(from, to),
    queryFn: () => Data.getRentalItemsAvailability(from, to),
    enabled: !!from && !!to && to >= from,
    staleTime: 0,
    gcTime: 0,
  });
}

/** One item, day by day — what the picker draws. Keyed on the month window, so
 *  stepping back to a month already seen is instant. */
export function useRentalItemDaysQuery(itemId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: qk.rentalDays(itemId ?? "", from, to),
    queryFn: () => Data.getRentalItemDays(itemId!, from, to),
    enabled: !!itemId && !!from && !!to,
    // Longer than the range availability above, deliberately: this drives which
    // days are TAPPABLE, not what is promised. The authoritative check still
    // happens on the quote for the exact range, so a minute of staleness here
    // costs a refused selection at worst, never an overbooking.
    staleTime: 60_000,
  });
}

// ─── One booking: its history, and calling it off ────────────────────────────

export function useRentalHistoryQuery(bookingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.rentalHistory(bookingId ?? ""),
    queryFn: () => Data.getRentalHistory(bookingId!),
    enabled: !!bookingId && enabled,
    staleTime: 30_000,
  });
}

export type CancellationQuote = {
  rentRefund: number;
  rentRetained: number;
  depositRefund: number;
  total: number;
  daysUntilStart: number;
  band: { daysBefore: number; refundShare: number; label: string; short: string };
  underGrace: boolean;
  shopCancelled: boolean;
  summary: string;
  startsOn: string | null;
  cancellable: boolean;
};

/**
 * What cancelling would give back — asked BEFORE the button is offered.
 *
 * The same `cancellationQuote` the refund itself runs, reached through
 * `/api/mobile/rentals/[id]/cancel`. Not a second implementation on the device:
 * a person pressing cancel has paid, the notice bands decide how much returns,
 * and finding that out from a bank statement four days later is how a
 * cancellation becomes a chargeback.
 */
export function useCancellationQuoteQuery(bookingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.rentalCancelQuote(bookingId ?? ""),
    queryFn: async (): Promise<CancellationQuote> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in to manage your bookings.");
      const res = await fetch(`${ENV.apiUrl}/api/mobile/rentals/${bookingId}/cancel`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't price that.");
      return data as CancellationQuote;
    },
    enabled: !!bookingId && enabled,
    // The bands turn on how many days remain, so a quote cached across midnight
    // would quote yesterday's band. Never stale.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useCancelRentalMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string): Promise<{ refunded: number }> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in to manage your bookings.");
      const res = await fetch(`${ENV.apiUrl}/api/mobile/rentals/${bookingId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "That didn't go through.");
      return data as { refunded: number };
    },
    onSuccess: () => {
      // The bookings list, and every cached statement about a shelf that just
      // gained its units back.
      client.invalidateQueries({ queryKey: ["rentals"] });
    },
  });
}

/**
 * Where the app sends somebody to pay.
 *
 * A hosted web page rather than a native SDK: `react-native-razorpay` means a
 * native module to maintain, a store rebuild to adopt it, and the publishable
 * key inside the app bundle. Razorpay's checkout IS a web widget, so the app
 * opens this in a browser sheet and is returned by deep link. Same reasoning as
 * the shop's `/pay/[orderId]`, and the page is shared with the web's own
 * "finish paying" link.
 */
export function rentalPayUrl(bookingId: string): string {
  return `${ENV.siteUrl}/rent/pay/${bookingId}`;
}
