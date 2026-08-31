import { supabase } from "./supabase";
import { resolveAssetUrl } from "./customize/assetUrl";

export type ProductAttribute = {
  attribute?: { name: string } | null;
  value?: { value: string } | null;
  text_value?: string | null;
};

// A print-safe area on one side of one garment colourway, in the same
// canonical 800px-wide coordinate space the web studio authors zones in — so
// a zone drawn once in admin lines up on web and on both mobile platforms.
export type CustomizationZone = {
  mockupImage: string;
  x: number;
  y: number;
  widthPx: number;
  heightPx: number;
  widthIn: number;
  heightIn: number;
};

export type CustomizationColorway = {
  name: string;
  hex: string;
  available: boolean;
  front?: CustomizationZone;
  back?: CustomizationZone;
};

export type CustomizationConfig = { colors: CustomizationColorway[] };

export type Product = {
  id: string; slug: string; name: string; price: number;
  /** Ticked in admin: this finished, already-printed garment belongs to the
   *  custom range. The switch. See migration 095. */
  is_custom_range?: boolean | null;
  /** Optional parent: the blank it was printed on. Null means we do not stock
   *  that garment, and the page offers the blanks we do. */
  custom_blank_id?: string | null;
  images: string[]; collection?: { id: string; slug: string; name: string };
  /** Taxonomy junction rows — a product can sit in several categories. */
  categories?: { category_id: string; is_primary?: boolean }[];
  variants?: { id: string; name: string; price_adjustment: number; inventory_quantity?: number | null }[];
  description?: string; short_description?: string;
  compare_at_price?: number | null;
  highlights?: string[];
  care_instructions?: string | null;
  low_stock_threshold?: number;
  inventory_quantity?: number | null;
  created_at?: string;
  attributes?: ProductAttribute[];
  is_customizable?: boolean;
  customization_config?: CustomizationConfig | null;
};

// `inventory_quantity` and `created_at` are pulled here (not just in the
// detail select) so the "N LEFT" / "NEW" tags on grid/rail cards have real
// data to render against — without these, ProductCard's badge logic is
// silently dead on every list screen even though the JSX is correct.
// `categories` joins the taxonomy junction so list screens can filter by
// category the same way the web shop does (ShopContent.tsx matches on
// `product.categories?.some(...)`). Mobile had no category axis at all — the
// tables have existed since migration 004 and nothing on the phone read them.
const PRODUCT_SELECT =
  "id,slug,name,price,images,collection:collections(id,slug,name),categories:product_categories(category_id,is_primary),variants:product_variants(id,name,price_adjustment),description,short_description,compare_at_price,is_customizable,inventory_quantity,created_at";

// Only the customizable blanks, with the colourway config the studio and the
// home showcase need. Kept separate from PRODUCT_SELECT so ordinary list
// screens don't pull a JSONB blob per card they'd never render.
const CUSTOMIZABLE_SELECT =
  "id,slug,name,price,images,short_description,is_customizable,customization_config,variants:product_variants(id,name,price_adjustment,inventory_quantity),inventory_quantity,created_at";

// Detail view needs the fields the list/grid views don't: highlights, care
// copy, low-stock threshold, per-variant inventory, and the attribute join
// that powers the "Specifications" accordion — kept out of PRODUCT_SELECT so
// list screens (Shop/Home/Collections) don't pull a heavier payload per card.
const PRODUCT_DETAIL_SELECT =
  "id,slug,name,price,images,collection:collections(id,slug,name,tagline),variants:product_variants(id,name,price_adjustment,inventory_quantity),description,short_description,compare_at_price,highlights,care_instructions,low_stock_threshold,inventory_quantity,created_at,is_customizable,customization_config,is_custom_range,custom_blank_id,attributes:product_attribute_values(text_value,attribute:attributes(name),value:attribute_values(value))";

// Product and collection imagery is authored in admin as a mix of absolute
// URLs (Supabase storage, Unsplash) and site-relative paths (e.g.
// "/custom/tee/tee-front.png") that only resolve against the web app's own
// origin. Native has no origin, so a relative path renders as nothing — no
// error, no broken-image glyph, just an empty box. That's what was blanking
// the Home hero whenever the newest product happened to be a studio blank.
//
// Normalising here rather than at each render site means every screen —
// cards, rails, galleries, hero, cart thumbnails — is fixed once and can't
// regress by forgetting the call.
function resolveImages<T extends { images?: string[] | null }>(row: T): T {
  if (!row?.images?.length) return row;
  return { ...row, images: row.images.map(resolveAssetUrl).filter(Boolean) };
}

// Always loads from Supabase first; falls back to constants data.
// This means the app shows real products immediately even before DB seed.

export async function getProducts(): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    // Without this, embedded variants come back in arbitrary order and size
    // pickers render as e.g. "L XL M S". `sort_order` exists for exactly this.
    .order("sort_order", { referencedTable: "product_variants", ascending: true });

  if (data && data.length > 0) return (data as unknown as Product[]).map(resolveImages);

  // No constants fallback. This used to fall back to a hardcoded demo
  // catalogue, which meant an empty or unreachable database silently rendered
  // products that don't exist and can't be ordered. An empty shop is the
  // truth; the screens all have empty states for it.
  return [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("sort_order", { referencedTable: "product_variants", ascending: true })
    .single();

  if (data) return resolveImages(data as unknown as Product);

  return null;
}

// The customizable blanks, cheapest-first so the showcase reads as an
// approachable ladder (tee → sweatshirt → hoodie). No constants fallback:
// customization depends on real per-colourway mockup URLs and print zones
// that only exist in the DB, so faking it offline would render a studio that
// can't actually produce a print file.
export async function getCustomizableProducts(): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select(CUSTOMIZABLE_SELECT)
    .eq("status", "active")
    .eq("is_customizable", true)
    .is("deleted_at", null)
    .order("price", { ascending: true })
    .order("sort_order", { referencedTable: "product_variants", ascending: true });

  return ((data as unknown as Product[]) ?? []).map(resolveImages);
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

  return ((data as unknown as Product[]) ?? []).map(resolveImages);
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

export type CollectionRow = {
  id: string; slug: string; name: string; tagline: string | null; image_url: string | null;
  description?: string | null;
  /** CSS gradient string authored in admin. Parsed for native use by
   *  `lib/gradient.ts` — it's the one piece of per-collection art direction
   *  that exists for every collection whether or not it has a photograph. */
  gradient?: string | null;
};

export type CategoryRow = {
  id: string; slug: string; name: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
};

// The product taxonomy — four top-level categories since migration 004, and
// never surfaced on mobile until now. This is the axis a shopper with a trek
// booked actually navigates by ("I need a shell"), as opposed to collections,
// which are the brand's editorial grouping ("Silent Altitude").
export async function getCategories(): Promise<CategoryRow[]> {
  const { data } = await supabase
    .from("categories")
    .select("id,slug,name,description,image_url,parent_id,sort_order")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (data ?? []).map((c) => ({ ...c, image_url: resolveAssetUrl(c.image_url) })) as CategoryRow[];
}

export async function getCollections(): Promise<CollectionRow[]> {
  const { data } = await supabase
    .from("collections")
    .select("id,slug,name,tagline,image_url,description,gradient")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []).map((c) => ({ ...c, image_url: resolveAssetUrl(c.image_url) }));
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
  // `product_name`/`unit_price`/image fields are only present on the detail
  // query — the list query joins `quantity` alone, so they're optional per-line.
  // `image` is resolved server-side from whichever of design preview / product
  // photo is available (see getOrderById) so screens don't need to know the
  // fallback order themselves.
  // `product` is joined on the detail query so "Buy again" can put the same
  // pieces back in the cart. Without it an order line carried a name and a
  // price but nothing that identified the product, so the button could only
  // ever dump the customer in the shop.
  items?: {
    product_name?: string;
    quantity: number;
    unit_price?: number;
    image?: string | null;
    product?: {
      id: string;
      slug: string;
      price: number;
      images?: string[];
      variants?: { id: string; name: string; inventory_quantity?: number | null }[];
    } | null;
  }[];
};

// Orders never had a `lib/data.ts` wrapper — both order screens queried
// Supabase directly. Centralizing them here means both the orders list and
// order-detail screens now go through the same React Query cache/refetch
// path as everything else instead of hand-rolled useEffect+IIFE fetching.
export async function getOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    // `product_name` joins alongside `quantity` because the list row names what
    // was bought. It used to select `quantity` alone — described as "far lighter
    // than pulling product names for rows that never display them" — which is
    // precisely why every row could only say "1 piece", "2 pieces". A purchase
    // history that doesn't say what you purchased isn't history. The thumbnail
    // is joined too, so a row can show the thing rather than describe it.
    .select(
      "id,order_number,status,payment_status,total_amount,subtotal,shipping_cost,created_at," +
        "items:order_items(quantity,product_name,product:products(images))",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Product images are stored as site-relative paths ("/custom/tshirt/...")
  // because the web app serves them out of /public. A native app has no origin
  // to resolve those against, so they load as nothing — which is why the
  // catalogue queries all run through `resolveImages`. The order queries never
  // did, so every thumbnail here was a blank grey rectangle.
  return ((data ?? []) as unknown as Order[]).map((o) => ({
    ...o,
    items: o.items?.map((it) => ({
      ...it,
      product: it.product
        ? { ...it.product, images: (it.product.images ?? []).map(resolveAssetUrl).filter(Boolean) }
        : it.product,
    })),
  }));
}

export async function getOrderById(id: string): Promise<Order> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*,items:order_items(product_name,quantity,unit_price,design:custom_designs(front_preview_url,back_preview_url),product:products(id,slug,price,images,variants:product_variants(id,name,inventory_quantity)))"
    )
    .eq("id", id)
    .single();
  if (error || !data) throw error ?? new Error("Order not found");
  // Web's order detail resolves the same design-preview-then-product-photo
  // fallback (see actions/orders.ts) — mirrored here so mobile order history
  // isn't the one surface showing no image at all for what was ordered.
  const raw = data as unknown as {
    items?: {
      product_name?: string; quantity: number; unit_price?: number;
      design?: { front_preview_url?: string | null; back_preview_url?: string | null } | null;
      product?: NonNullable<Order["items"]>[number]["product"];
    }[];
  } & Record<string, unknown>;
  const items = raw.items?.map((item) => ({
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    // `resolveAssetUrl` on every branch: design previews are absolute Supabase
    // storage URLs and pass straight through, but the product-photo fallback is
    // a site-relative path that a native app cannot fetch as-is.
    image:
      resolveAssetUrl(
        // `||` — an empty preview column must fall through, not win.
        item.design?.front_preview_url || item.design?.back_preview_url || item.product?.images?.[0],
      ) || null,
    product: item.product
      ? { ...item.product, images: (item.product.images ?? []).map(resolveAssetUrl).filter(Boolean) }
      : null,
  }));
  return { ...raw, items } as unknown as Order;
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

export type AppNotification = {
  id: string;
  type: "order_update" | "promotion" | "back_in_stock";
  title: string;
  body: string | null;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,title,body,order_id,read_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export type NotificationPreferences = { order_updates: boolean; promotions: boolean; back_in_stock: boolean };

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase.from("profiles").select("notification_preferences").eq("id", userId).single();
  if (error) throw error;
  return (data?.notification_preferences as NotificationPreferences) ?? { order_updates: true, promotions: true, back_in_stock: true };
}

export async function updateNotificationPreferences(userId: string, prefs: NotificationPreferences) {
  const { error } = await supabase.from("profiles").update({ notification_preferences: prefs }).eq("id", userId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Home configuration — the same light CMS the website reads
// ─────────────────────────────────────────────────────────────────────────────
// `store_settings.home_config` is publicly readable (migration 007), so the
// phone reads the admin's homepage configuration straight from Supabase rather
// than through the Next.js API. That matters: the app already works with the
// website offline, and the home screen is the last place that should start
// depending on a second server being reachable.
//
// The rail resolution below mirrors actions/showcase.ts on the web — the same
// deliberate duplication as getRelatedProducts, so both platforms merchandise
// identically. Best-sellers goes through the product_sales_ranking RPC
// (migration 028) because order_items is correctly closed to storefront reads.

export type HomeShowcaseKind = "recent" | "best_sellers" | "category" | "collection";

export type HomeShowcaseRail = {
  id: string;
  kind: HomeShowcaseKind;
  title: string;
  category_slug: string | null;
  collection_slug: string | null;
  limit: number;
  enabled: boolean;
};

export type HomeConfig = {
  featured_collection_slugs: string[];
  featured_category_slugs: string[];
  showcase: HomeShowcaseRail[];
};

export type ResolvedRail = { id: string; title: string; kind: HomeShowcaseKind; products: Product[] };

export type HomeData = {
  rails: ResolvedRail[];
  featuredCollectionSlugs: string[];
  featuredCategorySlugs: string[];
};

const EMPTY_HOME: HomeData = { rails: [], featuredCollectionSlugs: [], featuredCategorySlugs: [] };

export async function getHomeData(): Promise<HomeData> {
  const { data: settings } = await supabase
    .from("store_settings")
    .select("home_config")
    .eq("id", 1)
    .maybeSingle();

  const cfg = (settings?.home_config ?? null) as Partial<HomeConfig> | null;
  if (!cfg) return EMPTY_HOME;

  const rails = await Promise.all((cfg.showcase ?? []).filter((r) => r.enabled).map(resolveRail));

  return {
    // An empty rail is dropped, not rendered as a heading over nothing — the
    // catalogue is small and several rails legitimately have nothing to show.
    rails: rails.filter((r): r is ResolvedRail => r !== null && r.products.length > 0),
    featuredCollectionSlugs: cfg.featured_collection_slugs ?? [],
    featuredCategorySlugs: cfg.featured_category_slugs ?? [],
  };
}

async function resolveRail(rail: HomeShowcaseRail): Promise<ResolvedRail | null> {
  const limit = Math.min(Math.max(rail.limit || 8, 1), 24);
  let products: Product[] = [];

  if (rail.kind === "recent") {
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    products = ((data as unknown as Product[]) ?? []).map(resolveImages);
  } else if (rail.kind === "collection" && rail.collection_slug) {
    const { data: col } = await supabase
      .from("collections")
      .select("id")
      .eq("slug", rail.collection_slug)
      .maybeSingle();
    if (col) {
      const { data } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .is("deleted_at", null)
        .eq("collection_id", col.id)
        .limit(limit);
      products = ((data as unknown as Product[]) ?? []).map(resolveImages);
    }
  } else if (rail.kind === "category" && rail.category_slug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", rail.category_slug)
      .maybeSingle();
    if (cat) {
      const { data: links } = await supabase
        .from("product_categories")
        .select("product_id")
        .eq("category_id", cat.id)
        .limit(limit);
      const ids = (links ?? []).map((l) => l.product_id as string);
      if (ids.length) {
        const { data } = await supabase
          .from("products")
          .select(PRODUCT_SELECT)
          .eq("status", "active")
          .is("deleted_at", null)
          .in("id", ids);
        products = ((data as unknown as Product[]) ?? []).map(resolveImages);
      }
    }
  } else if (rail.kind === "best_sellers") {
    const { data: ranked } = await supabase.rpc("product_sales_ranking", { p_limit: limit });
    const ids = ((ranked as { product_id: string }[] | null) ?? []).map((r) => r.product_id);
    if (ids.length) {
      const { data } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .is("deleted_at", null)
        .in("id", ids);
      const byId = new Map(((data as unknown as Product[]) ?? []).map((p) => [p.id, resolveImages(p)]));
      // `in()` returns rows in arbitrary order — re-apply the sales ranking.
      products = ids.map((id) => byId.get(id)).filter(Boolean) as Product[];
    }
  }

  return { id: rail.id, title: rail.title, kind: rail.kind, products };
}

/**
 * Address management, straight through RLS.
 *
 * `002_rls_policies.sql` grants `FOR ALL USING (auth.uid() = user_id)` on
 * addresses, so the signed-in client can do this itself — no endpoint needed,
 * and the policy is the check rather than a `where` clause somebody has to
 * remember to write.
 */
export async function deleteAddress(id: string) {
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Exactly one default, enforced by doing both writes.
 *
 * There is no partial unique index on `is_default`, so "set this one" has to
 * also mean "clear the others" — otherwise the picker ends up with two rows
 * both claiming to be the default and the order between them is whatever
 * `created_at` happens to say.
 */
export async function setDefaultAddress(userId: string, id: string) {
  const { error: clearError } = await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("type", "shipping");
  if (clearError) throw clearError;

  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id);
  if (error) throw error;
}

/**
 * Designs this member has made.
 *
 * The studio could create a design and attach it to a cart line, and after that
 * the design was unreachable: no screen listed them, so a shirt somebody spent
 * ten minutes on could not be found again, reused, or reordered. The web has
 * had /account/designs since launch.
 *
 * Read through the session client so `045_custom_design_privacy.sql` decides —
 * "Owner, or anyone who owns an order the design is attached to. Never
 * world-readable." A guest design (user_id NULL) is deliberately NOT visible
 * here: 045 removed the `OR user_id IS NULL` read, so a design made before
 * signing in belongs to nobody and cannot be claimed. Worth knowing, and worth
 * saying on the screen rather than silently showing a shorter list.
 */
export type SavedDesign = {
  id: string;
  product_id: string;
  variant_id: string | null;
  color_name: string | null;
  front_preview_url: string | null;
  back_preview_url: string | null;
  front_print_dpi: number | null;
  back_print_dpi: number | null;
  created_at: string;
  product?: { slug: string; name: string; price: number } | null;
};

export async function getMyDesigns(userId: string): Promise<SavedDesign[]> {
  const { data, error } = await supabase
    .from("custom_designs")
    .select(
      "id,product_id,variant_id,color_name,front_preview_url,back_preview_url,front_print_dpi,back_print_dpi,created_at,product:products(slug,name,price)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as SavedDesign[];
}

// ─────────────────────────────────────────────────────────────────────────────
// The DEWDROPZ design library
// ─────────────────────────────────────────────────────────────────────────────
//
// Pre-set artwork the studio offers alongside "upload your own". The web studio
// has had this since the 23 August brief; the phone only ever had the upload
// door, so half the customisation offer was invisible on mobile.
//
// Read straight from Supabase with the session client, like every other
// catalogue read here — `design_library` is public-read by policy (migration
// 092) because it is a shop window, and there is no API route to go through.

export type LibraryDesign = {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  collection: string;
  sort: number;
};

/**
 * The artwork offered on one blank.
 *
 * `blank_ids` empty means EVERY blank — the default (094), and the common case,
 * so a design added without thinking about garments shows up everywhere rather
 * than nowhere. The containment test runs in Postgres so a growing library does
 * not turn opening the panel into a full-table read.
 */
export async function getLibraryDesigns(blankId: string): Promise<LibraryDesign[]> {
  const { data, error } = await supabase
    .from("design_library")
    .select("id,name,slug,image_url,collection,sort")
    .eq("active", true)
    .or(`blank_ids.eq.{},blank_ids.cs.{${blankId}}`)
    .order("sort", { ascending: true });

  // An unreachable shelf is not worth breaking the studio over — the upload
  // door still works, which is what the phone had before this existed.
  if (error) return [];
  return (data ?? []) as LibraryDesign[];
}


/**
 * What the product page needs to render the custom-range card.
 *
 * Returns null for an ordinary product. `blank` is null when we do not stock
 * that garment as a blank — not a failure, just the other honest answer, and
 * `alternatives` is what the card offers instead.
 *
 * Mirrors actions/customRange.ts on the web.
 */
export async function getCustomRangeContext(product: {
  id: string;
  is_custom_range?: boolean | null;
  custom_blank_id?: string | null;
}): Promise<{
  blank: { id: string; slug: string; name: string } | null;
  alternatives: Product[];
} | null> {
  if (!product.is_custom_range) return null;

  if (!product.custom_blank_id) {
    return { blank: null, alternatives: await getCustomizableProducts() };
  }

  const { data: blank } = await supabase
    .from("products")
    .select("id,slug,name,is_customizable,is_active")
    .eq("id", product.custom_blank_id)
    .maybeSingle();

  // Stale link: the blank was archived or had customization switched off.
  // Treat it exactly like "not stocked" rather than offering a dead studio.
  const usable = blank && (blank as { is_customizable: boolean }).is_customizable
    && (blank as { is_active: boolean }).is_active;
  if (!usable) return { blank: null, alternatives: await getCustomizableProducts() };

  return { blank: blank as { id: string; slug: string; name: string }, alternatives: [] };
}

// ─── Rentals ─────────────────────────────────────────────────────────────────
//
// Gear for rent, read straight from the device.
//
// The catalogue and the availability count are safe to read here because both
// are public by design: `rental_items` has a "Public read active rental items"
// policy, and `rental_available_units` is SECURITY DEFINER precisely so an
// anonymous caller gets a TRUTHFUL count (migration 097 — before that fix RLS
// hid every reservation from anon and the shelf always claimed everything was
// free). What it returns is a unit id and the code on the tag; who booked what
// stays private.
//
// PRICE IS NOT READ HERE, and cannot be. Nothing on this screen multiplies a
// daily rate by a number of days — inclusive day counting, the long-rental
// discount, return postage charged both ways and a deposit that must stay
// outside the taxable base all live in `lib/rentalPricing.ts` on the server.
// The quote and the booking both go through /api/mobile/rentals/*. `daily_rate`
// and `deposit` below are shown as headline figures on a card, never summed.

export type RentalItem = {
  id: string;
  slug: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  images: string[];
  daily_rate: number;
  deposit: number;
  weekly_discount_pct: number;
  min_days: number;
  max_days: number;
  buffer_days: number;
  gst_rate: number;
  allows_pickup: boolean;
  allows_shipping: boolean;
  /** The same gear, to own. NULL for kits and bundles we assemble but do not
   *  sell. Never a stock link — see migration 098. */
  product?: { slug: string; name: string; price: number; inventory_quantity: number | null } | null;
};

export type RentalBookingSummary = {
  id: string;
  booking_number: string;
  status: "reserved" | "out" | "returned" | "closed" | "cancelled";
  fulfilment: "pickup" | "ship";
  total_amount: number;
  deposit_amount: number;
  deposit_state: string;
  late_fee: number;
  damage_fee: number;
  created_at: string;
  reservations?: {
    id: string;
    starts_on: string;
    ends_on: string;
    days: number;
    item?: { name: string; images: string[] | null } | null;
    unit?: { code: string } | null;
  }[];
};

const RENTAL_SELECT =
  "id,slug,name,summary,description,images,daily_rate,deposit,weekly_discount_pct,min_days,max_days,buffer_days,gst_rate,allows_pickup,allows_shipping";

// The detail read also carries the sellable product, so the page can offer
// "own it instead" without a second round trip.
const RENTAL_DETAIL_SELECT =
  RENTAL_SELECT + ",product:products(slug,name,price,inventory_quantity)";

export async function getRentalItems(): Promise<RentalItem[]> {
  const { data } = await supabase
    .from("rental_items")
    .select(RENTAL_SELECT)
    .eq("is_active", true)
    .order("sort", { ascending: true });
  // Same image normalisation every other list read gets — admin authors a mix
  // of absolute URLs and site-relative paths, and a relative path renders as
  // nothing at all on native.
  return ((data ?? []) as unknown as RentalItem[]).map(resolveImages);
}

export async function getRentalItem(slug: string): Promise<RentalItem | null> {
  const { data } = await supabase
    .from("rental_items")
    .select(RENTAL_DETAIL_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data ? resolveImages(data as unknown as RentalItem) : null;
}

/**
 * How many units of an item are free between two dates.
 *
 * Calls the SAME database function the booking write calls, so the shelf shown
 * on the phone and the shelf booked against cannot disagree. The cleaning
 * buffer is applied inside the function — the app does not know or need to
 * know that a wet tent is held back for two days.
 */
export async function getRentalAvailability(
  itemId: string,
  startsOn: string,
  endsOn: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("rental_available_units", {
    p_item_id: itemId,
    p_start: startsOn,
    p_end: endsOn,
  });
  // Zero on error, never "probably fine". Advertising gear that may already be
  // out is the one failure mode worth being pessimistic about.
  if (error) return 0;
  return ((data ?? []) as unknown[]).length;
}

/**
 * Can this product also be rented, and from how much a day?
 *
 * The link lives on `rental_items.product_id`, not on the product — renting is
 * the narrower case and every product list would otherwise pay for a join it
 * never uses. So the product page asks this question separately, and only for
 * the one product it is showing.
 */
export async function getRentalForProduct(
  productId: string,
): Promise<{ slug: string; daily_rate: number; deposit: number } | null> {
  const { data } = await supabase
    .from("rental_items")
    .select("slug,daily_rate,deposit")
    .eq("product_id", productId)
    .eq("is_active", true)
    .maybeSingle();
  return (data as { slug: string; daily_rate: number; deposit: number }) ?? null;
}

export async function getMyRentalBookings(userId: string): Promise<RentalBookingSummary[]> {
  const { data } = await supabase
    .from("rental_bookings")
    .select(
      "id,booking_number,status,fulfilment,total_amount,deposit_amount,deposit_state,late_fee,damage_fee,created_at," +
        "reservations:rental_reservations(id,starts_on,ends_on,days,item:rental_items(name,images),unit:rental_units(code))",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as RentalBookingSummary[];
}

/** One booking by its number — for the confirmation screen after booking. */
export async function getRentalBookingByNumber(
  bookingNumber: string,
): Promise<RentalBookingSummary | null> {
  const { data } = await supabase
    .from("rental_bookings")
    .select(
      "id,booking_number,status,fulfilment,total_amount,deposit_amount,deposit_state,late_fee,damage_fee,created_at," +
        "reservations:rental_reservations(id,starts_on,ends_on,days,item:rental_items(name,images),unit:rental_units(code))",
    )
    .eq("booking_number", bookingNumber)
    .maybeSingle();
  return (data as unknown as RentalBookingSummary) ?? null;
}
