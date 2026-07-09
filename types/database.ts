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

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: 'customer' | 'admin'
  created_at: string
  updated_at: string
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

export interface Product {
  id: string
  collection_id: string | null
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
  quantity: number
  created_at: string
  updated_at: string
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
  payment_intent_id: string | null
  subtotal: number
  shipping_cost: number
  tax_amount: number
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
  product_name: string
  variant_name: string | null
  sku: string | null
  unit_price: number
  quantity: number
  total_price: number
  created_at: string
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

export interface StoreSettings {
  id: number
  store_name: string
  support_email: string
  flat_shipping_rate: number
  free_shipping_threshold: number
  enable_tax: boolean
  gst_percentage: number
  currency: string
  timezone: string
  updated_at: string
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
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ShippingZoneWithRates extends ShippingZone {
  rates: ShippingRate[]
}
