import { supabase } from "./supabase";
import { PRODUCTS, COLLECTIONS } from "./constants";

export type ProductAttribute = {
  attribute?: { name: string } | null;
  value?: { value: string } | null;
  text_value?: string | null;
};

export type Product = {
  id: string; slug: string; name: string; price: number;
  images: string[]; collection?: { id: string; slug: string; name: string };
  variants?: { id: string; name: string; price_adjustment: number; inventory_quantity?: number | null }[];
  description?: string; short_description?: string;
  compare_at_price?: number | null;
  highlights?: string[];
  care_instructions?: string | null;
  low_stock_threshold?: number;
  inventory_quantity?: number | null;
  attributes?: ProductAttribute[];
};

const PRODUCT_SELECT =
  "id,slug,name,price,images,collection:collections(id,slug,name),variants:product_variants(id,name,price_adjustment),description,short_description,compare_at_price";

// Detail view needs the fields the list/grid views don't: highlights, care
// copy, low-stock threshold, per-variant inventory, and the attribute join
// that powers the "Specifications" accordion — kept out of PRODUCT_SELECT so
// list screens (Shop/Home/Collections) don't pull a heavier payload per card.
const PRODUCT_DETAIL_SELECT =
  "id,slug,name,price,images,collection:collections(id,slug,name,tagline),variants:product_variants(id,name,price_adjustment,inventory_quantity),description,short_description,compare_at_price,highlights,care_instructions,low_stock_threshold,inventory_quantity,attributes:product_attribute_values(text_value,attribute:attributes(name),value:attribute_values(value))";

// Always loads from Supabase first; falls back to constants data.
// This means the app shows real products immediately even before DB seed.

export async function getProducts(): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (data && data.length > 0) return data as unknown as Product[];

  // Fallback to constants
  return PRODUCTS.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    images: p.images,
    collection: { id: p.collectionId, slug: p.collectionId, name: p.collectionName },
    variants: p.variants,
    description: p.longDescription,
    short_description: p.short_description,
    compare_at_price: p.compare_at_price,
  }));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .is("deleted_at", null)
    .single();

  if (data) return data as unknown as Product;

  // Fallback to constants
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    images: p.images,
    collection: { id: p.collectionId, slug: p.collectionId, name: p.collectionName },
    variants: p.variants,
    description: p.longDescription,
    short_description: p.short_description,
    compare_at_price: p.compare_at_price,
  };
}

// Batch-hydrates a list of product slugs into real product records — used by
// the wishlist screen, which only ever stores slugs, not full product data.
// A single `.in(...)` query rather than one request per slug.
export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];

  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("slug", slugs)
    .eq("status", "active")
    .is("deleted_at", null);

  if (data && data.length > 0) return data as unknown as Product[];

  return PRODUCTS.filter((p) => slugs.includes(p.slug)).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    images: p.images,
    collection: { id: p.collectionId, slug: p.collectionId, name: p.collectionName },
    variants: p.variants,
    description: p.longDescription,
    short_description: p.short_description,
    compare_at_price: p.compare_at_price,
  }));
}

// Matches on the collection's real `slug` (e.g. "mist-and-morning") — the same
// identifier the [slug] route param already is. The previous version
// string-slugified the collection's *display name* instead ("Mist & Morning"
// -&gt; "mist-&amp;-morning") and compared that against the id, which never equals
// "mist-and-morning" for any collection whose name contains a symbol like "&amp;".
export async function getProductsByCollection(collectionSlug: string): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((p) => p.collection?.slug === collectionSlug);
}

export async function getCollections() {
  const { data } = await supabase
    .from("collections")
    .select("id,slug,name,tagline,image_url")
    .order("created_at", { ascending: true });

  if (data && data.length > 0) return data;

  return COLLECTIONS.map((c) => ({
    id: c.id,
    slug: c.id,
    name: c.name,
    tagline: c.tagline,
    image_url: c.image,
  }));
}

// getRelatedProducts / getCartRecommendations mirror the web app's
// lib/recommendations.ts heuristics exactly (same-collection first, then
// price-tier fallback, then catch-all) so a shopper sees the same "related"
// logic on both platforms — pure functions over an already-fetched list,
// no separate recs query.
export function getRelatedProducts(all: Product[], currentSlug: string, limit = 6): Product[] {
  const current = all.find((p) => p.slug === currentSlug);
  if (!current) return all.slice(0, limit);

  const out: Product[] = [];
  const seen = new Set([currentSlug]);

  for (const p of all) {
    if (out.length >= limit) break;
    if (seen.has(p.slug)) continue;
    if (p.collection?.id && p.collection.id === current.collection?.id) {
      out.push(p);
      seen.add(p.slug);
    }
  }

  if (out.length < limit) {
    const lo = current.price * 0.7;
    const hi = current.price * 1.3;
    for (const p of all) {
      if (out.length >= limit) break;
      if (seen.has(p.slug)) continue;
      if (p.price >= lo && p.price <= hi) {
        out.push(p);
        seen.add(p.slug);
      }
    }
  }

  for (const p of all) {
    if (out.length >= limit) break;
    if (seen.has(p.slug)) continue;
    out.push(p);
    seen.add(p.slug);
  }

  return out.slice(0, limit);
}

export function getCartRecommendations(all: Product[], cartSlugs: string[], limit = 6): Product[] {
  if (cartSlugs.length === 0) return all.slice(0, limit);

  const cartCollectionIds = new Set(
    all.filter((p) => cartSlugs.includes(p.slug)).map((p) => p.collection?.id).filter(Boolean),
  );
  const out: Product[] = [];
  const seen = new Set(cartSlugs);

  for (const p of all) {
    if (out.length >= limit) break;
    if (seen.has(p.slug)) continue;
    if (p.collection?.id && cartCollectionIds.has(p.collection.id)) {
      out.push(p);
      seen.add(p.slug);
    }
  }

  for (const p of all) {
    if (out.length >= limit) break;
    if (seen.has(p.slug)) continue;
    out.push(p);
    seen.add(p.slug);
  }

  return out.slice(0, limit);
}

export type Address = {
  id: string; full_name: string; phone: string; address_line1: string;
  address_line2: string | null; city: string; state: string; postal_code: string; is_default: boolean;
};

// Read-only: the mobile checkout endpoint (`/api/mobile/checkout`) always
// inserts a fresh address row server-side rather than accepting an
// address_id — this is only used to let a returning shopper tap a past
// address to prefill the form, not to submit against directly.
export async function getAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from("addresses")
    .select("id,full_name,phone,address_line1,address_line2,city,state,postal_code,is_default")
    .eq("user_id", userId)
    .eq("type", "shipping")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type Order = {
  id: string; order_number: string; status: string; payment_status: string;
  total_amount: number; subtotal: number; shipping_cost: number; created_at: string;
  items?: { product_name: string; quantity: number; unit_price: number }[];
};

// Orders never had a `lib/data.ts` wrapper — both order screens queried
// Supabase directly. Centralizing them here means both the orders list and
// order-detail screens now go through the same React Query cache/refetch
// path as everything else instead of hand-rolled useEffect+IIFE fetching.
export async function getOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,status,payment_status,total_amount,subtotal,shipping_cost,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getOrderById(id: string): Promise<Order> {
  const { data, error } = await supabase
    .from("orders")
    .select("*,items:order_items(product_name,quantity,unit_price)")
    .eq("id", id)
    .single();
  if (error || !data) throw error ?? new Error("Order not found");
  return data as unknown as Order;
}

export type Review = {
  id: string; product_id: string; user_id: string; rating: number;
  title: string | null; content: string | null; is_verified: boolean;
  is_approved: boolean; created_at: string;
  profile?: { full_name: string | null } | null;
};

// The web app has a full reviews backend (actions/reviews.ts) but ships no
// customer-facing UI for it anywhere — this is a net-new mobile feature,
// reading/writing the same `reviews` table directly (same direct-Supabase
// pattern the orders screens already use for tables without a REST layer).
export async function getProductReviews(productId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id,product_id,user_id,rating,title,content,is_verified,is_approved,created_at,profile:profiles(full_name)")
    .eq("product_id", productId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Review[];
}

export async function getProductRating(productId: string): Promise<{ average: number; count: number }> {
  const { data, error } = await supabase.from("reviews").select("rating").eq("product_id", productId).eq("is_approved", true);
  if (error) throw error;
  const ratings = data ?? [];
  if (ratings.length === 0) return { average: 0, count: 0 };
  const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  return { average: Math.round(avg * 10) / 10, count: ratings.length };
}

// Mirrors the web app's createReview: goes into the moderation queue
// (is_approved defaults false server-side / via RLS default) rather than
// appearing immediately. The web's verified-purchase auto-flag is computed
// server-side in a Next.js server action mobile has no equivalent path to —
// left for the backend to set, not faked client-side.
export async function createReview(input: { product_id: string; user_id: string; rating: number; title?: string; content?: string }) {
  const { error } = await supabase.from("reviews").insert({
    product_id: input.product_id,
    user_id: input.user_id,
    rating: input.rating,
    title: input.title || null,
    content: input.content || null,
  });
  if (error) throw error;
}
