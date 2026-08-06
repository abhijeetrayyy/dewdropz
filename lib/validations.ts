import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
})

export const passwordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const profileUpdateSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().regex(/^\+?[\d\s-]{10,}$/, 'Invalid phone number').optional(),
  avatar_url: z.string().url().optional(),
})

export const addressSchema = z.object({
  type: z.enum(['shipping', 'billing']).default('shipping'),
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().regex(/^\+?[\d\s-]{10,}$/, 'Valid phone is required'),
  address_line1: z.string().min(5, 'Address is required'),
  address_line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postal_code: z.string().regex(/^\d{6}$/, 'Valid pincode is required'),
  country: z.string().default('India'),
  is_default: z.boolean().default(false),
})

export const cartItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  custom_design_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(99).default(1),
})

export const updateCartItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().min(0).max(99),
})

export const couponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
})

export const checkoutSchema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^\+?[\d\s-]{10,}$/).optional(),
  shipping_address_id: z.string().uuid(),
  billing_address_id: z.string().uuid().optional(),
  coupon_code: z.string().optional(),
  notes: z.string().max(500).optional(),
  payment_method: z.enum(['stripe', 'razorpay', 'cod']).default('razorpay'),
})

// Mobile checkout has no `addresses` row to reference yet (the app collects
// raw fields, not an existing address id) and no server-side cart (its cart
// is local device state) — this is the shape the mobile app POSTs directly,
// which app/api/mobile/checkout/route.ts turns into an address row + a
// synced DB cart before calling the same createOrder() the web app uses.
export const mobileCheckoutSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().regex(/^\+?[\d\s-]{10,}$/),
  addressLine1: z.string().min(1).max(300),
  addressLine2: z.string().max(300).optional(),
  city: z.string().min(1).max(120),
  state: z.string().min(1).max(120),
  postalCode: z.string().regex(/^\d{6}$/, 'Valid pincode is required'),
  notes: z.string().max(500).optional(),
  items: z.array(z.object({
    slug: z.string().min(1),
    size: z.string().optional(),
    quantity: z.number().int().min(1).max(99),
  })).min(1),
})

export const reviewSchema = z.object({
  product_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).optional(),
  content: z.string().max(2000).optional(),
})

export const newsletterSchema = z.object({
  email: z.string().email('Valid email is required'),
})

export const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  message: z.string().min(10, 'Message is a little short — give us more to go on').max(2000),
})

export const productSchema = z.object({
  collection_id: z.string().uuid().nullable().optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  name: z.string().min(2),
  description: z.string().optional(),
  short_description: z.string().max(200).optional(),
  price: z.number().int().positive(),
  compare_at_price: z.number().int().positive().optional(),
  sku: z.string().optional(),
  inventory_quantity: z.number().int().min(0).default(0),
  weight: z.number().positive().optional(),
  images: z.array(z.string().url()).default([]),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
  meta_title: z.string().max(70).optional(),
  meta_description: z.string().max(160).optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type AddressInput = z.infer<typeof addressSchema>
export type CartItemInput = z.infer<typeof cartItemSchema>
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>
export type CouponInput = z.infer<typeof couponSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
export type MobileCheckoutInput = z.infer<typeof mobileCheckoutSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
export type NewsletterInput = z.infer<typeof newsletterSchema>
export type ProductInput = z.infer<typeof productSchema>
