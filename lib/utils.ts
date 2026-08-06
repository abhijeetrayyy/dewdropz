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
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}
