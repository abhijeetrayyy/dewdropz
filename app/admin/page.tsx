'use client'

import { useEffect, useState } from 'react'
import { getLowStockReport } from '@/actions/variants'
import { getAllOrders } from '@/actions/orders'
import { getProducts } from '@/actions/products'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard'
import { AlertTriangle, Package, ShoppingCart } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const [stats, setStats] = useState<{
    lowStock: number
    pendingOrders: number
    activeProducts: number
  } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [stock, orders, products] = await Promise.all([
          getLowStockReport().catch(() => ({ products: [], variants: [] })),
          getAllOrders({ status: 'pending', limit: 1 }).catch(() => ({ orders: [], total: 0 })),
          getProducts().catch(() => []),
        ])
        setStats({
          lowStock: (stock.products?.length ?? 0) + (stock.variants?.length ?? 0),
          pendingOrders: orders?.total ?? 0,
          activeProducts: products?.length ?? 0,
        })
      } catch {
        setStats({ lowStock: 0, pendingOrders: 0, activeProducts: 0 })
      }
    }
    load()
  }, [])

  const cards = [
    { label: 'Active Products', value: stats?.activeProducts ?? '—', icon: Package, href: '/admin/products', tone: 'info' as const },
    { label: 'Pending Orders', value: stats?.pendingOrders ?? '—', icon: ShoppingCart, href: '/admin/orders', tone: 'neutral' as const },
    { label: 'Low Stock Items', value: stats?.lowStock ?? '—', icon: AlertTriangle, href: '/admin/products', tone: 'warning' as const },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Overview of your store</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats === null ? (
          Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : cards.map((card) => (
          <Link key={card.label} href={card.href}>
            <StatCard label={card.label} value={card.value} icon={card.icon} tone={card.tone} className="cursor-pointer" />
          </Link>
        ))}
      </div>

      <QuickLinks />
      <LowStockAlert />
    </div>
  )
}

function QuickLinks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-black">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2 flex-wrap">
        <Link href="/admin/products"><Button variant="default" size="sm">Add Product</Button></Link>
        <Link href="/admin/categories"><Button variant="outline" size="sm">Manage Categories</Button></Link>
        <Link href="/admin/attributes"><Button variant="outline" size="sm">Manage Attributes</Button></Link>
        <Link href="/admin/tags"><Button variant="outline" size="sm">Manage Tags</Button></Link>
        <Link href="/admin/orders"><Button variant="outline" size="sm">View Orders</Button></Link>
      </CardContent>
    </Card>
  )
}

function LowStockAlert() {
  const [items, setItems] = useState<{ products: Array<Record<string, unknown>>; variants: Array<Record<string, unknown>> } | null>(null)

  useEffect(() => {
    getLowStockReport().then(setItems as (d: unknown) => void).catch(() => setItems(null))
  }, [])

  if (!items || (items.products.length === 0 && items.variants.length === 0)) return null

  return (
    <Card className="border-amber-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          Low Stock Alert
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Threshold</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.products.map((p: Record<string, unknown>) => (
              <TableRow key={p.id as string}>
                <TableCell className="font-medium text-gray-900">{p.name as string}</TableCell>
                <TableCell className="text-gray-500">{(p.sku as string) ?? '—'}</TableCell>
                <TableCell className="text-right"><Badge variant="destructive">{String(p.inventory_quantity)}</Badge></TableCell>
                <TableCell className="text-right text-gray-500">{String(p.low_stock_threshold ?? 5)}</TableCell>
              </TableRow>
            ))}
            {items.variants.map((v: Record<string, unknown>) => (
              <TableRow key={v.id as string}>
                <TableCell className="font-medium text-gray-900">
                  {(v.product as Record<string, unknown> | null)?.['name'] as string ?? '—'} — {v.name as string}
                </TableCell>
                <TableCell className="text-gray-500">{(v.sku as string) ?? '—'}</TableCell>
                <TableCell className="text-right"><Badge variant="destructive">{String(v.inventory_quantity)}</Badge></TableCell>
                <TableCell className="text-right text-gray-500">{String(v.low_stock_threshold ?? 5)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
