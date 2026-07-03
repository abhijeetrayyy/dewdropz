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
    }
    Functions: {
      generate_order_number: {
        Args: Record<string, never>
        Returns: string
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
