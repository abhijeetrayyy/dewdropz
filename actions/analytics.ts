'use server'

import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { getLowStockReport } from './variants'

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

  // Aggregated in Postgres. This used to select every order in the range
  // TOGETHER WITH ALL THEIR LINE ITEMS and reduce them five ways in Node —
  // revenue, count, a zero-filled daily trend, top products and the status mix.
  // The items were the bulk of the payload and existed only to be summed.
  //
  // Checked field-by-field against the implementation it replaces, over the
  // live data at 7/30/90 days and over synthetic orders covering what the live
  // data cannot: several products competing for the top-eight, revenue spread
  // across days, a cancelled order, and a line whose product was deleted after
  // the sale. See migration 042.
  const [summary, customers] = await Promise.all([
    supabase.rpc('analytics_summary', { p_days: days }),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - days * 86_400_000).toISOString()),
  ])

  const s = summary.data as {
    totalRevenue: number | string
    orderCount: number | string
    avgOrderValue: number | string
    revenueTrend: { date: string; revenue: number | string }[]
    topProducts: { name: string; revenue: number | string; quantity: number | string }[]
    statusMix: { status: string; count: number | string }[]
  } | null

  // BIGINT comes back as a string once it has been through JSON; every figure
  // is coerced rather than assumed, since a string would propagate silently
  // into a chart axis instead of failing.
  return {
    totalRevenue: Number(s?.totalRevenue ?? 0),
    orderCount: Number(s?.orderCount ?? 0),
    avgOrderValue: Number(s?.avgOrderValue ?? 0),
    newCustomers: customers.count ?? 0,
    revenueTrend: (s?.revenueTrend ?? []).map((t) => ({ date: t.date, revenue: Number(t.revenue) })),
    topProducts: (s?.topProducts ?? []).map((p) => ({
      name: p.name, revenue: Number(p.revenue), quantity: Number(p.quantity),
    })),
    statusMix: (s?.statusMix ?? []).map((m) => ({ status: m.status, count: Number(m.count) })),
  }
}
