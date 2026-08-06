'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  getAllProducts, toggleProductActive, archiveProduct, updateProduct,
  bulkSetProductsActive, bulkArchiveProducts,
} from '@/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { toast } from 'sonner'
import { Plus, Pencil, Power, PowerOff, Trash2, Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { TableSkeleton } from '@/components/admin/TableSkeleton'
import type { Product } from '@/types/database'

const PAGE_SIZE = 20

const STATUS_STYLES: Record<Product['status'], { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
  archived: { label: 'Archived', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
}

type SortKey = 'name' | 'price' | 'stock'
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null

// Debounced inline-edit cell for Price/Stock — same optimistic-update +
// per-field-debounce pattern as VariantRow.tsx, but wrapped in try/catch so a
// failed save surfaces a toast instead of silently vanishing.
function EditableCell({
  value,
  onCommit,
  className,
  prefix,
}: {
  value: number
  onCommit: (next: number) => Promise<void>
  className?: string
  prefix?: string
}) {
  const [local, setLocal] = useState(String(value))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setLocal(String(value)), [value])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function handleChange(next: string) {
    setLocal(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const parsed = parseInt(next, 10)
      const finalValue = isNaN(parsed) ? 0 : parsed
      try {
        await onCommit(finalValue)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save')
        setLocal(String(value))
      }
    }, 400)
  }

  return (
    <div className="relative inline-flex items-center">
      {prefix && <span className="absolute left-2 text-xs text-gray-400">{prefix}</span>}
      <Input
        type="number"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        className={`h-7 w-20 text-xs text-right ${prefix ? 'pl-5' : ''} ${className ?? ''}`}
      />
    </div>
  )
}

function SortHeader({ label, sortKey, sort, onSort, align = 'left' }: {
  label: string; sortKey: SortKey; sort: SortState; onSort: (k: SortKey) => void; align?: 'left' | 'right'
}) {
  const active = sort?.key === sortKey
  const Icon = active ? (sort!.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 hover:text-gray-900 transition-colors ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-gray-900' : ''}`}
    >
      {label}
      <Icon className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-30'}`} />
    </button>
  )
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortState>(null)
  const [confirmTarget, setConfirmTarget] = useState<Product | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
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

  function onSort(key: SortKey) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const sortedProducts = (() => {
    if (!sort) return products
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...products].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
      if (sort.key === 'price') return (a.price - b.price) * dir
      return ((a.inventory_quantity ?? 0) - (b.inventory_quantity ?? 0)) * dir
    })
  })()

  async function handleToggle(p: Product) {
    try {
      await toggleProductActive(p.id, !p.is_active)
      toast.success(p.is_active ? 'Product deactivated' : 'Product activated')
      load()
    } catch { toast.error('Failed to toggle') }
  }

  async function handleArchiveConfirmed() {
    if (!confirmTarget) return
    const p = confirmTarget
    setConfirmTarget(null)
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

  async function handleBulkArchiveConfirmed() {
    setConfirmBulk(false)
    try {
      await bulkArchiveProducts([...selected])
      toast.success(`${selected.size} product${selected.size === 1 ? '' : 's'} deleted`)
      load()
    } catch { toast.error('Bulk delete failed') }
  }

  const savePrice = useCallback(async (id: string, next: number) => {
    await updateProduct(id, { price: next })
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, price: next } : p)))
  }, [])

  const saveStock = useCallback(async (id: string, next: number) => {
    await updateProduct(id, { inventory_quantity: next })
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, inventory_quantity: next } : p)))
  }, [])

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
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setConfirmBulk(true)}>Delete</Button>
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton columns={7} rows={10} />
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
                <TableHead className="w-14" />
                <TableHead><SortHeader label="Product" sortKey="name" sort={sort} onSort={onSort} /></TableHead>
                <TableHead><SortHeader label="Price" sortKey="price" sort={sort} onSort={onSort} /></TableHead>
                <TableHead><SortHeader label="Stock" sortKey="stock" sort={sort} onSort={onSort} /></TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProducts.map((p) => {
                const stock = p.inventory_quantity ?? 0
                const outOfStock = stock <= 0
                const lowStock = !outOfStock && stock <= (p.low_stock_threshold ?? 5)
                const statusStyle = STATUS_STYLES[p.status] ?? STATUS_STYLES.draft
                return (
                <TableRow key={p.id}>
                  <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelected(p.id)} /></TableCell>
                  <TableCell>
                    <div className="h-10 w-10 rounded-md overflow-hidden bg-gray-100 relative shrink-0">
                      {p.images?.[0] ? (
                        <Image src={p.images[0]} alt={p.name} fill sizes="40px" className="object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[9px] text-gray-300 font-medium">No img</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex items-center gap-2">{p.name}<span className="text-gray-400 text-xs">{p.slug}</span>{p.is_featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}</div>
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={p.price / 100}
                      prefix="₹"
                      onCommit={(nextRupees) => savePrice(p.id, Math.round(nextRupees * 100))}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={stock}
                      onCommit={(next) => saveStock(p.id, next)}
                      className={outOfStock ? 'text-red-600 font-medium' : lowStock ? 'text-amber-600 font-medium' : ''}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge className={statusStyle.className}>{statusStyle.label}</Badge>
                      {outOfStock && <Badge variant="destructive" className="text-xs">Out of stock</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/products/${p.id}`)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleToggle(p)}>{p.is_active ? <PowerOff className="h-4 w-4 text-amber-600" /> : <Power className="h-4 w-4 text-green-600" />}</Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmTarget(p)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
                )
              })}
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

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}
        title={`Delete "${confirmTarget?.name}"?`}
        description="This removes the product from the storefront. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleArchiveConfirmed}
      />

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Delete ${selected.size} product${selected.size === 1 ? '' : 's'}?`}
        description="This removes the selected products from the storefront. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleBulkArchiveConfirmed}
      />
    </div>
  )
}
