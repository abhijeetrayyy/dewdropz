import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// All prices in the database are integer paise (matches admin/email formatting
// already in use — see app/admin/*/page.tsx, lib/email.ts). Storefront
// components historically formatted lib/constants.ts's whole-rupee mock prices
// directly; anything reading real product/order data must go through this.
export function formatPrice(paise: number): string {
  // Whole rupees print bare (₹1,899), anything with paise prints both digits
  // (₹189.90, not ₹189.9). Catalogue prices are all whole rupees, so this only
  // showed up once percentage discounts started producing real fractions — and
  // a price ending in a single decimal reads as a typo.
  const rupees = paise / 100
  const fraction = paise % 100 === 0 ? 0 : 2
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: fraction, maximumFractionDigits: fraction })}`
}
