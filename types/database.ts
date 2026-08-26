export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      collections: {
        Row: Collection
        Insert: Omit<Collection, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Collection, 'id'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Product, 'id'>>
      }
      product_variants: {
        Row: ProductVariant
        Insert: Omit<ProductVariant, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProductVariant, 'id'>>
      }
      addresses: {
        Row: Address
        Insert: Omit<Address, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Address, 'id'>>
      }
      carts: {
        Row: Cart
        Insert: Omit<Cart, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Cart, 'id'>>
      }
      cart_items: {
        Row: CartItem
        Insert: Omit<CartItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CartItem, 'id'>>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'order_number'> & { order_number?: string }
        Update: Partial<Omit<Order, 'id' | 'order_number'>>
      }
      order_items: {
        Row: OrderItem
        Insert: Omit<OrderItem, 'id' | 'created_at'>
        Update: Partial<Omit<OrderItem, 'id'>>
      }
      coupons: {
        Row: Coupon
        Insert: Omit<Coupon, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Coupon, 'id'>>
      }
      coupon_usages: {
        Row: CouponUsage
        Insert: Omit<CouponUsage, 'id' | 'created_at'>
        Update: Partial<Omit<CouponUsage, 'id'>>
      }
      reviews: {
        Row: Review
        Insert: Omit<Review, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Review, 'id'>>
      }
      newsletter_subscribers: {
        Row: NewsletterSubscriber
        Insert: Omit<NewsletterSubscriber, 'id' | 'created_at'>
        Update: Partial<Omit<NewsletterSubscriber, 'id'>>
      }
      webhook_events: {
        Row: WebhookEvent
        Insert: Omit<WebhookEvent, 'id' | 'created_at'>
        Update: Partial<Omit<WebhookEvent, 'id'>>
      }
      notifications: {
        Row: AppNotification
        Insert: Omit<AppNotification, 'id' | 'created_at'>
        Update: Partial<Pick<AppNotification, 'read_at'>>
      }
      // Phase 1 new tables
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Category, 'id'>>
      }
      product_categories: {
        Row: ProductCategory
        Insert: Omit<ProductCategory, 'created_at'>
        Update: Partial<Omit<ProductCategory, 'product_id' | 'category_id'>>
      }
      tags: {
        Row: Tag
        Insert: Omit<Tag, 'id' | 'created_at'>
        Update: Partial<Omit<Tag, 'id'>>
      }
      product_tags: {
        Row: ProductTag
        Insert: Omit<ProductTag, 'created_at'>
        Update: Partial<Omit<ProductTag, 'product_id' | 'tag_id'>>
      }
      attributes: {
        Row: Attribute
        Insert: Omit<Attribute, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Attribute, 'id'>>
      }
      attribute_values: {
        Row: AttributeValue
        Insert: Omit<AttributeValue, 'id' | 'created_at'>
        Update: Partial<Omit<AttributeValue, 'id'>>
      }
      product_attribute_values: {
        Row: ProductAttributeValue
        Insert: Omit<ProductAttributeValue, 'created_at'>
        Update: Partial<Omit<ProductAttributeValue, 'product_id' | 'attribute_id' | 'attribute_value_id'>>
      }
      variant_option_values: {
        Row: VariantOptionValue
        Insert: Omit<VariantOptionValue, ''>
        Update: Partial<Omit<VariantOptionValue, 'variant_id' | 'attribute_id'>>
      }
      inventory_movements: {
        Row: InventoryMovement
        Insert: Omit<InventoryMovement, 'id' | 'created_at'>
        Update: Partial<Omit<InventoryMovement, 'id'>>
      }
      store_settings: {
        Row: StoreSettings
        Insert: Partial<StoreSettings>
        Update: Partial<StoreSettings>
      }
      shipping_zones: {
        Row: ShippingZone
        Insert: Omit<ShippingZone, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ShippingZone, 'id'>>
      }
      shipping_rates: {
        Row: ShippingRate
        Insert: Omit<ShippingRate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ShippingRate, 'id'>>
      }
    }
    Functions: {
      generate_order_number: {
        Args: Record<string, never>
        Returns: string
      }
      get_current_stock: {
        Args: { p_product_id: string; p_variant_id?: string }
        Returns: number
      }
      adjust_stock_atomic: {
        Args: {
          p_product_id: string
          p_quantity_change: number
          p_reason: string
          p_variant_id?: string | null
          p_notes?: string | null
          p_reference_type?: string
          p_reference_id?: string | null
        }
        Returns: void
      }
      increment_coupon_usage: {
        Args: { coupon_id: string }
        Returns: void
      }
    }
  }
}

export interface NotificationPreferences {
  order_updates: boolean
  promotions: boolean
  back_in_stock: boolean
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: 'customer' | 'admin'
  notification_preferences: NotificationPreferences
  created_at: string
  updated_at: string
}

export type NotificationType = 'order_update' | 'promotion' | 'back_in_stock'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  data: Json | null
  order_id: string | null
  read_at: string | null
  created_at: string
}

export interface Collection {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  gradient: string | null
  image_url: string | null
  sort_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// A print zone in the "canonical" mockup coordinate space — the studio
// always renders the mockup at a fixed reference width (800px) and scales
// the whole canvas uniformly for other viewport sizes, so x/y/widthPx/
// heightPx never need to change with screen size. widthIn/heightIn are the
// real-world print dimensions used to compute export DPI.
export interface CustomizationZone {
  mockupImage: string
  x: number
  y: number
  widthPx: number
  heightPx: number
  widthIn: number
  heightIn: number
}

// A single sellable colorway of a customizable product. `available` is the
// switch between "this color can actually be ordered" and "shown as a
// planned option, disabled until real mockup photos exist" — the studio
// renders every colorway as a swatch either way, so adding a real color
// later is just an admin edit, not a code change.
export interface CustomizationColorway {
  name: string
  hex: string
  available: boolean
  front?: CustomizationZone
  back?: CustomizationZone
}

export interface CustomizationConfig {
  colors: CustomizationColorway[]
}

export interface Product {
  id: string
  collection_id: string | null
  hsn_code: string | null
  slug: string
  name: string
  description: string | null
  short_description: string | null
  price: number
  compare_at_price: number | null
  sku: string | null
  inventory_quantity: number | null
  weight: number | null
  dimensions: Json | null
  images: string[]
  highlights: string[]
  care_instructions: string | null
  story_blocks: { images: string[]; heading: string; body: string }[]
  is_customizable: boolean
  customization_config: CustomizationConfig | null
  is_featured: boolean
  is_active: boolean
  status: 'draft' | 'active' | 'archived'
  low_stock_threshold: number
  deleted_at: string | null
  meta_title: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku: string | null
  price_adjustment: number | null
  inventory_quantity: number | null
  low_stock_threshold: number
  sort_order: number | null
  created_at: string
  updated_at: string
}

export interface Address {
  id: string
  user_id: string
  type: 'shipping' | 'billing'
  full_name: string
  phone: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
  country: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Cart {
  id: string
  user_id: string | null
  session_id: string | null
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: string
  cart_id: string
  product_id: string
  variant_id: string | null
  custom_design_id: string | null
  quantity: number
  created_at: string
  updated_at: string
}

// A shopper's saved front/back design for one customizable product.
// Immutable once created — editing a design already in a cart/order means
// creating a new row, never mutating one that might already be ordered.
export interface CustomDesign {
  id: string
  user_id: string | null
  product_id: string
  variant_id: string | null
  front_design: Json | null
  back_design: Json | null
  front_preview_url: string | null
  back_preview_url: string | null
  front_print_url: string | null
  back_print_url: string | null
  front_print_dpi: number | null
  back_print_dpi: number | null
  // Which garment colorway this was designed against. Null on designs
  // created before colorways existed.
  color_name: string | null
  color_hex: string | null
  created_at: string
}

export interface Order {
  id: string
  user_id: string | null
  order_number: string
  email: string
  phone: string | null
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
  payment_method: 'stripe' | 'razorpay' | 'cod' | null
  /** The gateway's ORDER/SESSION handle — Razorpay `order_…`, Stripe `cs_…`. */
  payment_intent_id: string | null
  /** The CAPTURED payment — Razorpay `pay_…`, Stripe `pi_…`. What a refund is
   *  issued against. Split out in migration 043: both used to share the column
   *  above, and whichever wrote last won, which silently broke every refund. */
  gateway_payment_id: string | null
  subtotal: number
  shipping_cost: number
  tax_amount: number
  /** One entry per distinct rate, as printed on a GST invoice. */
  tax_breakdown: { rate: number; taxable: number; tax: number }[]
  /** Stored, not recomputed — the split must keep matching the invoice even if
   *  the store later moves state. */
  tax_is_igst: boolean
  discount_amount: number
  total_amount: number
  currency: string
  shipping_address: Json
  billing_address: Json | null
  tracking_number: string | null
  tracking_url: string | null
  carrier: string | null
  notes: string | null
  admin_notes: string | null
  refunded_amount: number
  refund_needs_attention: boolean
  created_at: string
  updated_at: string
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  variant_id: string | null
  custom_design_id: string | null
  product_name: string
  variant_name: string | null
  sku: string | null
  unit_price: number
  quantity: number
  total_price: number
  // Tax snapshotted per line, the way an invoice needs it.
  hsn_code: string | null
  tax_rate: number
  taxable_value: number
  tax_amount: number
  // Production, for customised lines. printed_at NULL on a line with a
  // custom_design_id means it is still in the print queue.
  printed_at: string | null
  printed_by: string | null
  production_note: string | null
  created_at: string
  // Only populated by admin queries that explicitly join it (getAllOrders) —
  // the customer-facing order preview URLs, for fulfillment.
  // The admin order detail and the print queue select the whole row — the
  // print files and the saved canvas are what production actually needs.
  design?: CustomDesign | null
  // Only populated by queries that explicitly join it — the product's own
  // photos, used as the order-line thumbnail when the item isn't a custom
  // design (which has no `design` preview to fall back to).
  product?: Pick<Product, 'images'> | null
}

export interface Coupon {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  min_order_amount: number | null
  max_discount_amount: number | null
  usage_limit: number | null
  usage_count: number | null
  user_limit: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CouponUsage {
  id: string
  coupon_id: string
  user_id: string | null
  order_id: string | null
  discount_amount: number
  created_at: string
}

export interface Review {
  id: string
  product_id: string
  user_id: string
  order_id: string | null
  rating: number
  title: string | null
  content: string | null
  is_verified: boolean
  is_approved: boolean
  created_at: string
  updated_at: string
}

export interface NewsletterSubscriber {
  id: string
  email: string
  is_confirmed: boolean
  confirmed_at: string | null
  source: string | null
  created_at: string
}

export interface WebhookEvent {
  id: string
  provider: 'stripe' | 'razorpay'
  event_type: string
  event_id: string | null
  payload: Json
  processed: boolean
  error: string | null
  created_at: string
  processed_at: string | null
}

// Phase 1: Product Taxonomy & Attributes
export interface Category {
  id: string
  parent_id: string | null
  slug: string
  name: string
  description: string | null
  image_url: string | null
  is_primary_eligible: boolean
  sort_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductCategory {
  product_id: string
  category_id: string
  is_primary: boolean
  created_at: string
}

export interface Tag {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface ProductTag {
  product_id: string
  tag_id: string
  created_at: string
}

export interface Attribute {
  id: string
  name: string
  slug: string
  input_type: 'text' | 'select' | 'multiselect' | 'boolean' | 'number'
  is_variant_attribute: boolean
  is_filterable: boolean
  sort_order: number | null
  created_at: string
  updated_at: string
}

export interface AttributeValue {
  id: string
  attribute_id: string
  value: string
  slug: string
  sort_order: number | null
  created_at: string
}

export interface ProductAttributeValue {
  product_id: string
  attribute_id: string
  attribute_value_id: string | null
  text_value: string | null
  created_at: string
}

export interface VariantOptionValue {
  variant_id: string
  attribute_id: string
  attribute_value_id: string
}

export interface InventoryMovement {
  id: string
  product_id: string
  variant_id: string | null
  quantity_change: number
  reason: 'restock' | 'sale' | 'return' | 'adjustment' | 'damaged' | 'initial'
  reference_type: 'order' | 'manual' | 'return' | null
  reference_id: string | null
  created_by: string | null
  notes: string | null
  created_at: string
}

// Derived types
export interface CartItemWithProduct extends CartItem {
  product: Product
  variant: ProductVariant | null
}

export interface CartWithItems extends Cart {
  items: CartItemWithProduct[]
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
}

export interface ProductWithCollection extends Product {
  collection: Collection | null
  variants: ProductVariant[]
  categories: ProductCategory[]
  /** Only loaded where it is actually rendered — the product page, via
   *  getProductBySlug. List reads (getProducts) leave it out, because resolving
   *  it costs a three-level join per product for a panel no list ever shows.
   *  Optional rather than absent so the one consumer, ProductDetail, keeps its
   *  existing null-guard and needs no change. */
  attributes?: (ProductAttributeValue & { attribute: Attribute; value: AttributeValue | null })[]
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[]
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[]
}

export interface AttributeWithValues extends Attribute {
  values: AttributeValue[]
}

export interface VariantWithOptions extends ProductVariant {
  options: (VariantOptionValue & { attribute: Attribute; value: AttributeValue })[]
}

export interface ProductWithAll extends Product {
  collection: Collection | null
  variants: VariantWithOptions[]
  categories: ProductCategory[]
  tags: (ProductTag & { tag: Tag })[]
  attributes: (ProductAttributeValue & { attribute: Attribute; value?: AttributeValue })[]
}

export interface InventoryMovementWithDetails extends InventoryMovement {
  product: Product | null
  variant: ProductVariant | null
  admin: Profile | null
}

// The homepage's two product-showcase sections (Season Kit, The Climb) read
// their copy and product picks from here instead of a hardcoded catalogue
// snapshot — see migration 025_home_config.sql for the full rationale.
export interface HomeClimbStation {
  product_slug: string
  label: string
  line: string
}

export interface HomeConfig {
  season_kit: {
    enabled: boolean
    eyebrow: string
    headline: string
    line: string
    collection_slug: string | null
    product_slugs: string[]
  }
  climb: {
    enabled: boolean
    headline: string
    intro: string
    stations: HomeClimbStation[]
  }
  // Empty array means "show all" — CollectionsRow's original behaviour.
  featured_collection_slugs: string[]
  // Same convention: empty means every active top-level category.
  featured_category_slugs: string[]
  // Empty means the numbers band hides itself. Deliberately not seeded with
  // defaults — the previous hardcoded figures were invented.
  stats: HomeStat[]
  showcase: HomeShowcaseRail[]
  /** The Trails section's cards. Optional because settings rows written before
   *  migration 092 do not have the key; `app/page.tsx` falls back to
   *  DEFAULT_HOME_TRAILS, which is the four routes that used to be hardcoded. */
  trails?: HomeTrail[]
}

/**
 * One piece of pre-set DEWDROPZ artwork offered in the customisation studio.
 *
 * The brief's "pre-set design ready library of DEWDROPZ", which the studio has
 * never had — until now it offered exactly one way in, "upload your own", which
 * silently excluded every customer who is not a designer.
 *
 * See migration 092 for the table and `actions/designLibrary.ts` for the reads
 * and writes. `collection` is free text, NOT a foreign key into `collections`:
 * those are ranges of physical garments, and a design collection is a different
 * thing that happens to share the word.
 */
export interface LibraryDesign {
  id: string
  name: string
  slug: string
  image_url: string
  collection: string
  sort: number
  active: boolean
  created_at: string
}

/**
 * One card in the homepage's Trails section.
 *
 * The brief: "Keep options so that DEWDROPZ team can add more treks etc in this
 * section with the current layout — Easy-Moderate, Season, days and writeup."
 * That is exactly these fields, and nothing beyond them: this shape is what the
 * card renders, so a route added in /admin/homepage cannot arrive missing
 * something the layout needs.
 *
 * Deliberately NOT a reference into lib/constants' TRAILS. The point of the
 * request is that a route can be added without a deploy, so a card carries its
 * own copy of everything it draws.
 */
export interface HomeTrail {
  /** Used as the React key and, when a matching route exists in the /treks
   *  guide, to deep-link the card at it. A slug with no guide entry still
   *  renders — the card just links to the guide index. */
  slug: string
  name: string
  /** Free text, e.g. "3,800m". Shown as the corner badge on the photograph. */
  altitude: string
  /** "Easy", "Moderate", "Easy–Moderate", "Hard" — free text on purpose, the
   *  brief names grades the old fixed union did not have. */
  difficulty: string
  /** e.g. "4–6 days". */
  duration: string
  /** Three-letter month names, matching MONTHS in the section. Anything else
   *  simply never lights a cell rather than breaking the strip. */
  bestMonths: string[]
  /** The writeup under the month strip. One or two sentences. */
  season: string
  /** Absolute URL. Must be on an allowed remote host — see next.config.ts. */
  image: string
}

export interface HomeStat {
  value: number
  suffix: string
  label: string
  /** Render the number bare (e.g. a year) instead of locale-grouped. */
  plain: boolean
}

/** How a rail picks its products. All are evaluated against live catalogue
 *  data, so a rail fills up on its own once real products/orders exist. */
export type HomeShowcaseKind = 'recent' | 'best_sellers' | 'category' | 'collection'

export interface HomeShowcaseRail {
  id: string
  kind: HomeShowcaseKind
  title: string
  category_slug: string | null
  collection_slug: string | null
  limit: number
  enabled: boolean
}

export interface StoreSettings {
  id: number
  store_name: string
  support_email: string
  flat_shipping_rate: number
  free_shipping_threshold: number
  enable_tax: boolean
  /** Fallback rate for products with no HSN mapping. Real rates live in tax_rates. */
  gst_percentage: number
  /** Place of supply origin — decides CGST+SGST vs IGST. */
  origin_state: string
  gstin: string | null
  currency: string
  timezone: string
  home_config: HomeConfig
  updated_at: string

  // Rule 46(a) needs the supplier's registered name and ADDRESS on the face of
  // every invoice. These are nullable because the shop has not supplied them
  // yet, and `issue_invoice` refuses rather than printing a document without
  // them. Take them from the GST certificate — NOT from lib/constants.ts, whose
  // address is marketing copy.
  seller_legal_name: string | null
  seller_address_line1: string | null
  seller_address_line2: string | null
  seller_city: string | null
  seller_postal_code: string | null
  seller_country: string
  /** Numeric GST state code. Must match the first two digits of the GSTIN. */
  seller_state_code: string | null
  /** Rule 46(q): who the invoice is signed by. */
  invoice_signatory_name: string | null
  einvoice_declaration_required: boolean
  /**
   * Whether freight forms part of the taxable value (s.15(2)(c)). Currently
   * false, matching what checkout actually computes. Turning it on without
   * teaching lib/tax.ts to charge tax on shipping makes `issue_invoice` refuse,
   * so the two halves cannot silently disagree.
   */
  shipping_is_taxable: boolean
}

/** One entry of an invoice's rate-wise tax summary, the shape GST returns take. */
export interface InvoiceTaxSummaryRow {
  rate: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  cess: number
}

/**
 * An issued tax invoice.
 *
 * Every party detail is COPIED here at issue rather than joined, so the
 * document keeps saying what it said even after the store is renamed, a product
 * is retitled, an address is edited or a tax rate changes. The row is immutable
 * once written — the only permitted change is recording a cancellation.
 */
export interface Invoice {
  id: string
  order_id: string
  document_type: 'tax_invoice' | 'bill_of_supply'
  /** Financial-year label, e.g. '2627' for 2026-27. */
  fy: string
  seq: number
  /** What is printed: DDZ/2627/000001. At most 16 characters, per Rule 46(b). */
  serial: string
  issued_at: string

  seller_legal_name: string
  seller_trade_name: string | null
  seller_address: Record<string, string | null>
  seller_gstin: string | null
  seller_state: string
  seller_state_code: string
  signatory_name: string
  einvoice_declaration: boolean

  buyer_name: string
  buyer_legal_name: string | null
  buyer_email: string | null
  buyer_phone: string | null
  buyer_gstin: string | null
  supply_type: 'B2B' | 'B2C'

  billing_address: Record<string, unknown>
  shipping_address: Record<string, unknown>
  delivery_address_differs: boolean

  place_of_supply_state: string
  place_of_supply_code: string
  is_igst: boolean
  reverse_charge: boolean

  gross_value: number
  discount_total: number
  taxable_total: number
  shipping_charge: number
  shipping_taxable_value: number
  shipping_tax_rate: number
  shipping_tax_amount: number
  cgst_total: number
  sgst_total: number
  igst_total: number
  cess_total: number
  grand_total: number
  currency: string
  tax_summary: InvoiceTaxSummaryRow[]

  order_number: string
  order_placed_at: string
  payment_method: string | null
  payment_status_at_issue: string | null

  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  order_item_id: string | null
  line_no: number
  description: string
  hsn_code: string
  quantity: number
  /** Unit Quantity Code — 'PCS' for garments. */
  uqc: string
  unit_price: number
  gross_value: number
  discount: number
  taxable_value: number
  tax_rate: number
  /**
   * The price band that produced the rate, snapshotted. Without it an auditor
   * reading two garments at different rates cannot see why.
   */
  rate_band_min: number | null
  rate_band_max: number | null
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  cess_amount: number
  line_total: number
}

export interface InvoiceWithLines extends Invoice {
  lines: InvoiceLine[]
}

/** Section 34 credit note — the document that reverses tax on a refund. */
export interface CreditNote {
  id: string
  invoice_id: string
  refund_id: string | null
  fy: string
  seq: number
  serial: string
  issued_at: string
  reason: string
  original_invoice_number: string
  original_invoice_date: string
  seller_legal_name: string
  seller_address: Record<string, string | null>
  seller_gstin: string
  buyer_name: string
  buyer_gstin: string | null
  buyer_address: Record<string, unknown>
  place_of_supply_state: string
  place_of_supply_code: string
  signatory_name: string
  is_igst: boolean
  taxable_value_reduced: number
  shipping_reduced: number
  cgst_reduced: number
  sgst_reduced: number
  igst_reduced: number
  cess_reduced: number
  total_reduced: number
  tax_summary: InvoiceTaxSummaryRow[]
  created_at: string
}

export interface ShippingZone {
  id: string
  name: string
  countries: string[]
  states: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ShippingRate {
  id: string
  zone_id: string
  name: string
  type: 'flat' | 'weight_based' | 'price_based'
  price: number
  min_value: number
  max_value: number | null
  estimated_min_days: number | null
  estimated_max_days: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ShippingZoneWithRates extends ShippingZone {
  rates: ShippingRate[]
}
