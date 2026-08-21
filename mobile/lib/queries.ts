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
