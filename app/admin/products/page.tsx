'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getAllProducts, toggleProductActive, archiveProduct, createProduct, getCollections,
  bulkSetProductsActive, bulkArchiveProducts,
} from '@/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Pencil, Power, PowerOff, Trash2, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { TableSkeleton } from '@/components/admin/TableSkeleton'
import type { Product, Collection } from '@/types/database'

const PAGE_SIZE = 20

function fmtPrice(p: number) { return `₹${(p / 100).toLocaleString('en-IN')}` }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Debounce search input and reset to page 0 whenever the query actually changes,
  // so typing doesn't fire a request per keystroke or leave the list on a stale page.
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
      const { products: prods, total: t } = await getAllProducts({ search: debouncedSearch || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      setProducts(prods)
      setTotal(t)
      setSelected(new Set())
    } catch { toast.error('Failed to load products') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [debouncedSearch, page])



  async function handleToggle(p: Product) {
    try {
      await toggleProductActive(p.id, !p.is_active)
      toast.success(p.is_active ? 'Product deactivated' : 'Product activated')
      load()
    } catch { toast.error('Failed to toggle') }
  }

  async function handleArchive(p: Product) {
    if (!confirm(`Delete "${p.name}"?`)) return
    try { await archiveProduct(p.id); toast.success('Product deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))))
  }

  async function handleBulkActive(active: boolean) {
    try {
      await bulkSetProductsActive([...selected], active)
      toast.success(`${selected.size} product${selected.size === 1 ? '' : 's'} ${active ? 'activated' : 'deactivated'}`)
      load()
    } catch { toast.error('Bulk update failed') }
  }

  async function handleBulkArchive() {
    if (!confirm(`Delete ${selected.size} product${selected.size === 1 ? '' : 's'}?`)) return
    try {
      await bulkArchiveProducts([...selected])
      toast.success(`${selected.size} product${selected.size === 1 ? '' : 's'} deleted`)
      load()
    } catch { toast.error('Bulk delete failed') }
  }



  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight text-black">Products</h2><p className="text-sm text-gray-500 mt-1">{total} product{total === 1 ? '' : 's'}</p></div>
        <Button onClick={() => router.push('/admin/products/new')} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, slug, SKU..." className="pl-8" />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 mr-2">{selected.size} selected</span>
            <Button variant="outline" size="sm" onClick={() => handleBulkActive(true)}>Set Active</Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkActive(false)}>Set Draft</Button>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={handleBulkArchive}>Delete</Button>
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton columns={6} rows={10} />
      ) : products.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-1">No products found</p>
            <p className="text-sm text-gray-500 max-w-sm mb-4">You haven&apos;t added any products yet, or none match your search criteria.</p>
            <Button onClick={() => router.push('/admin/products/new')}><Plus className="h-4 w-4 mr-2" /> Add your first product</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={products.length > 0 && selected.size === products.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelected(p.id)} /></TableCell>
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex items-center gap-2">{p.name}<span className="text-gray-400 text-xs">{p.slug}</span>{p.is_featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}</div>
                  </TableCell>
                  <TableCell>{fmtPrice(p.price)}</TableCell>
                  <TableCell><span className={(p.inventory_quantity ?? 0) <= (p.low_stock_threshold ?? 5) && (p.inventory_quantity ?? 0) > 0 ? 'text-amber-600 font-medium' : ''}>{p.inventory_quantity ?? 0}</span></TableCell>
                  <TableCell>{p.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/products/${p.id}`)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleToggle(p)}>{p.is_active ? <PowerOff className="h-4 w-4 text-amber-600" /> : <Power className="h-4 w-4 text-green-600" />}</Button>
                      <Button variant="ghost" size="icon" onClick={() => handleArchive(p)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      )}

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
