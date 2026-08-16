import Link from 'next/link'
import { getDashboardSummary } from '@/actions/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatCard } from '@/components/admin/StatCard'
import { AlertTriangle, Package, ShoppingCart } from 'lucide-react'

// A server component now.
//
// It was a client component firing four server actions on mount, which Next
// queues one at a time — so four sequential round-trips, from functions running
// in US East, to render three numbers and a short table. Two of the four were
// the identical getLowStockReport call, and a third read the whole catalogue to
// take its length. It is one call, made next to the database, and the page
// arrives with its data.
export default async function AdminDashboard() {
  const { counts, lowStock } = await getDashboardSummary()

  const cards = [
    { label: 'Active Products', value: counts.activeProducts, icon: Package, href: '/admin/products', tone: 'info' as const },
    { label: 'Pending Orders', value: counts.pendingOrders, icon: ShoppingCart, href: '/admin/orders', tone: 'neutral' as const },
    { label: 'Low Stock Items', value: counts.lowStock, icon: AlertTriangle, href: '/admin/products', tone: 'warning' as const },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">Overview of your store</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href}>
            <StatCard label={card.label} value={card.value} icon={card.icon} tone={card.tone} className="cursor-pointer" />
          </Link>
        ))}
      </div>

      <QuickLinks />
      <LowStockAlert items={lowStock} />
    </div>
  )
}

function QuickLinks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-black">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link href="/admin/products/new"><Button variant="default" size="sm">Add Product</Button></Link>
        <Link href="/admin/categories"><Button variant="outline" size="sm">Manage Categories</Button></Link>
        <Link href="/admin/attributes"><Button variant="outline" size="sm">Manage Attributes</Button></Link>
        <Link href="/admin/tags"><Button variant="outline" size="sm">Manage Tags</Button></Link>
        <Link href="/admin/orders"><Button variant="outline" size="sm">View Orders</Button></Link>
      </CardContent>
    </Card>
  )
}

type LowStock = Awaited<ReturnType<typeof getDashboardSummary>>['lowStock']

function LowStockAlert({ items }: { items: LowStock }) {
  if (items.products.length === 0 && items.variants.length === 0) return null

  return (
    <Card className="border-amber-300">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          Low Stock Alert
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[620px] table-fixed">
          <colgroup>
            <col /><col className="w-[180px]" /><col className="w-[110px]" /><col className="w-[120px]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="h-10 px-4">Item</TableHead>
              <TableHead className="h-10 px-4">SKU</TableHead>
              <TableHead className="h-10 px-4 text-right">Stock</TableHead>
              <TableHead className="h-10 px-4 text-right">Threshold</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="px-4 py-2 font-medium text-gray-900"><span className="block truncate">{p.name}</span></TableCell>
                <TableCell className="px-4 py-2 font-mono text-xs text-gray-500"><span className="block truncate">{p.sku ?? '—'}</span></TableCell>
                <TableCell className="px-4 py-2 text-right"><Badge variant="destructive">{String(p.inventory_quantity)}</Badge></TableCell>
                <TableCell className="px-4 py-2 text-right tabular-nums text-gray-500">{String(p.low_stock_threshold ?? 5)}</TableCell>
              </TableRow>
            ))}
            {items.variants.map((raw) => {
              const v = raw as { id: string; name: string; sku: string | null; inventory_quantity: number; low_stock_threshold: number | null; product: { name: string } | null }
              return (
                <TableRow key={v.id}>
                  <TableCell className="px-4 py-2 font-medium text-gray-900">
                    <span className="block truncate">{v.product?.name ?? '—'} — {v.name}</span>
                  </TableCell>
                  <TableCell className="px-4 py-2 font-mono text-xs text-gray-500"><span className="block truncate">{v.sku ?? '—'}</span></TableCell>
                  <TableCell className="px-4 py-2 text-right"><Badge variant="destructive">{String(v.inventory_quantity)}</Badge></TableCell>
                  <TableCell className="px-4 py-2 text-right tabular-nums text-gray-500">{String(v.low_stock_threshold ?? 5)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
