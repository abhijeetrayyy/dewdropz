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
  home: ["home-config"] as const,
  orders: (userId: string) => ["orders", userId] as const,
  order: (id: string) => ["orders", "detail", id] as const,
  reviews: (productId: string) => ["reviews", productId] as const,
  rating: (productId: string) => ["reviews", "rating", productId] as const,
  addresses: (userId: string) => ["addresses", userId] as const,
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
      return data as { orderId: string };
    },
  });
}
