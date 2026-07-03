import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price / 100)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length).trimEnd() + '...'
}

export function generateOrderNumber(): string {
  const prefix = 'DDZ'
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `${prefix}-${date}-${random}`
}

export function calculateShipping(subtotal: number): number {
  return subtotal >= 20000 ? 0 : 1000 // Free shipping above ₹200
}

export function calculateTax(subtotal: number): number {
  return Math.floor(subtotal * 0.05) // 5% GST
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function isErrorResponse(
  result: unknown
): result is { error: string } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as { error: string }).error === 'string'
  )
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const SHIPPING_THRESHOLD = 20000 // Free shipping threshold in paise (₹200)
export const SHIPPING_COST = 1000 // Standard shipping in paise (₹10)
export const TAX_RATE = 0.05 // 5% GST
export const CURRENCY = 'INR'
