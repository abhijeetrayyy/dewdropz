'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getCustomers } from '@/actions/customers'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Users, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { TableSkeleton } from '@/components/admin/TableSkeleton'
import type { CustomerRow } from '@/actions/customers'

const PAGE_SIZE = 20

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { customers: rows, total: t } = await getCustomers({
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      setCustomers(rows)
      setTotal(t)
    } catch { toast.error('Failed to load customers') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [debouncedSearch, page])

  function fmtAmount(p: number) { return `₹${(p / 100).toLocaleString('en-IN')}` }
  function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Customers</h2>
        <p className="text-sm text-gray-500 mt-1">{total} customer{total === 1 ? '' : 's'}</p>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email..." className="pl-8" />
      </div>

      {loading ? (
        <TableSkeleton columns={6} rows={8} />
      ) : customers.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-1">No customers found</p>
            <p className="text-sm text-gray-500 max-w-sm mb-4">You don&apos;t have any customers yet, or none match your search criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8"><Users className="h-8 w-8 mx-auto mb-2" /><p>{debouncedSearch ? 'No customers match your search' : 'No customers yet'}</p></TableCell></TableRow>
              ) : customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-gray-900">{c.full_name || '—'}</TableCell>
                  <TableCell className="text-gray-500">{c.email}</TableCell>
                  <TableCell>{c.role === 'admin' ? <Badge variant="info">Admin</Badge> : <Badge variant="secondary">Customer</Badge>}</TableCell>
                  <TableCell className="text-right">{c.order_count}</TableCell>
                  <TableCell className="text-right font-medium">{fmtAmount(c.total_spent)}</TableCell>
                  <TableCell className="text-gray-400 text-xs">{fmtDate(c.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page + 1} of {pageCount}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
