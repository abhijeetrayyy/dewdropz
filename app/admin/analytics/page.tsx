'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getAnalyticsSummary } from '@/actions/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard'
import { TrendingUp, ShoppingCart, Receipt, UserPlus } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type Summary = Awaited<ReturnType<typeof getAnalyticsSummary>>

const statusColors: Record<string, string> = {
  pending: '#9ca3af', confirmed: '#60a5fa', processing: '#a78bfa',
  shipped: '#34d399', delivered: '#000000', cancelled: '#ef4444', refunded: '#f97316',
}

function fmtAmount(p: number) { return `₹${(p / 100).toLocaleString('en-IN')}` }
function fmtDay(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }

export default function AnalyticsPage() {
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getAnalyticsSummary(range).then(setData).finally(() => setLoading(false))
  }, [range])

  const cards = data ? [
    { label: 'Revenue', value: fmtAmount(data.totalRevenue), icon: TrendingUp, tone: 'success' as const },
    { label: 'Orders', value: data.orderCount.toLocaleString('en-IN'), icon: ShoppingCart, tone: 'info' as const },
    { label: 'Avg. Order Value', value: fmtAmount(data.avgOrderValue), icon: Receipt, tone: 'neutral' as const },
    { label: 'New Customers', value: data.newCustomers.toLocaleString('en-IN'), icon: UserPlus, tone: 'warning' as const },
  ] : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">Revenue, orders, and top products</p>
        </div>
        <Select value={String(range)} onValueChange={(v) => setRange(Number(v) as 7 | 30 | 90)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} />
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base text-black">Revenue Trend</CardTitle></CardHeader>
        <CardContent>
          {loading || !data ? (
            <div className="h-64 animate-pulse bg-gray-100 rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.revenueTrend}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip formatter={(v) => fmtAmount(Number(v))} labelFormatter={(d) => fmtDay(String(d))} />
                <Area type="monotone" dataKey="revenue" stroke="#000000" strokeWidth={2} fill="url(#revFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base text-black">Top Products</CardTitle></CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="h-56 animate-pulse bg-gray-100 rounded" />
            ) : data.topProducts.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No sales in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, data.topProducts.length * 34)}>
                <BarChart data={data.topProducts} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => fmtAmount(Number(v))} />
                  <Bar dataKey="revenue" fill="#000000" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base text-black">Order Status Mix</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading || !data ? (
              <div className="h-56 animate-pulse bg-gray-100 rounded" />
            ) : data.statusMix.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No orders in this range.</p>
            ) : (
              data.statusMix.map((s) => {
                const max = Math.max(...data.statusMix.map((x) => x.count))
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <Badge variant="outline" className="w-24 justify-center capitalize shrink-0">{s.status}</Badge>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(s.count / max) * 100}%`, backgroundColor: statusColors[s.status] ?? '#9ca3af' }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-8 text-right">{s.count}</span>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
