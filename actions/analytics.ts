'use server'

import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { getLowStockReport } from './variants'

const CANCELLED_STATUSES = new Set(['cancelled'])

// Everything the dashboard opens with, in one call.
//
// It used to fire four server actions on mount — and Next runs a client's
// actions one at a time, so they queued. Two of the four were the SAME call:
// getLowStockReport ran once for the headline count and again inside the
// low-stock table, fetching identical rows twice.
//
// The third was worse than a duplicate. "Active products" was `getProducts()`
// — the entire catalogue, with collections, variants, categories and attributes
// embedded — read across the wire so the page could take `.length` of it. It is
// a COUNT now, which Postgres answers from an index without returning a row.
export async function getDashboardSummary() {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const [lowStock, pendingOrders, activeProducts] = await Promise.all([
    getLowStockReport(),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('products').select('id', { count: 'exact', head: true })
      .eq('is_active', true).is('deleted_at', null),
  ])

  return {
    lowStock,
    counts: {
      lowStock: lowStock.products.length + lowStock.variants.length,
      pendingOrders: pendingOrders.count ?? 0,
      activeProducts: activeProducts.count ?? 0,
    },
  }
}

export async function getAnalyticsSummary(days: 7 | 30 | 90 = 30) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, subtotal, total_amount, created_at, items:order_items(product_id, product_name, quantity, total_price)')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  const rows = orders ?? []
  const counted = rows.filter((o) => !CANCELLED_STATUSES.has(o.status))

  const totalRevenue = counted.reduce((sum, o) => sum + o.total_amount, 0)
  const orderCount = counted.length
  const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0

  // Daily revenue trend — zero-filled so the chart doesn't skip days with no orders.
  const byDay = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setDate(d.getDate() + i)
    byDay.set(d.toISOString().slice(0, 10), 0)
  }
  for (const o of counted) {
    const key = o.created_at.slice(0, 10)
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + o.total_amount)
  }
  const revenueTrend = Array.from(byDay.entries()).map(([date, revenue]) => ({ date, revenue }))

  // Top products by revenue, aggregated from order_items across the range.
  const productTotals = new Map<string, { name: string; revenue: number; quantity: number }>()
  for (const o of counted) {
    for (const item of o.items ?? []) {
      const key = item.product_id ?? item.product_name
      const existing = productTotals.get(key) ?? { name: item.product_name, revenue: 0, quantity: 0 }
      existing.revenue += item.total_price
      existing.quantity += item.quantity
      productTotals.set(key, existing)
    }
  }
  const topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  // Order status mix across the same range (includes cancelled, unlike the revenue figures above).
  const statusCounts = new Map<string, number>()
  for (const o of rows) {
    statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1)
  }
  const statusMix = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }))

  const { count: customerCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since.toISOString())

  return {
    totalRevenue,
    orderCount,
    avgOrderValue,
    newCustomers: customerCount ?? 0,
    revenueTrend,
    topProducts,
    statusMix,
  }
}
