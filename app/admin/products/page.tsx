'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  getAllProducts, toggleProductActive, archiveProduct, restoreProduct, updateProduct,
  bulkSetProductsActive, bulkArchiveProducts,
  type ProductListRow, type ProductListSort,
} from '@/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { EditableNumber } from '@/components/admin/EditableNumber'
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

type SortState = { key: ProductListSort; dir: 'asc' | 'desc' }

// Auto table layout was giving the price column whatever was left over after
// the product name, which is why an input sized for a four-digit rupee value
// kept landing in a cell too narrow to show it. So: fixed layout, and every
// column that holds a control of known size gets that size.
//
// Product is deliberately the one column WITHOUT a width. Under fixed layout an
// unsized column absorbs whatever is left, so the name gets the slack on a wide
// screen and the controls never move. Sizing all eight instead put the row at
// 1080px, which measured 74px wider than the content area on a 1280 laptop and
// pushed Edit and Delete off the right edge — the two things most often clicked.
const COLS = [
  { key: 'select', width: 'w-[44px]' },
  { key: 'image', width: 'w-[56px]' },
  { key: 'product', width: undefined },
  { key: 'sku', width: 'w-[130px]' },
  { key: 'price', width: 'w-[116px]' },
  { key: 'stock', width: 'w-[104px]' },
  { key: 'status', width: 'w-[150px]' },
  { key: 'actions', width: 'w-[112px]' },
] as const

function SortHeader({ label, sortKey, sort, onSort, align = 'left' }: {
  label: string; sortKey: ProductListSort; sort: SortState; onSort: (k: ProductListSort) => void; align?: 'left' | 'right'
}) {
  const active = sort.key === sortKey
  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex w-full items-center gap-1 transition-colors hover:text-gray-900 ${align === 'right' ? 'justify-end' : ''} ${active ? 'text-gray-900' : ''}`}
    >
      {label}
      <Icon className={`h-3 w-3 shrink-0 ${active ? 'opacity-100' : 'opacity-30'}`} />
    </button>
  )
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  // Sorting is now a query parameter, not a client-side array sort, so it
  // orders the catalogue rather than the twenty rows that happen to be loaded.
  const [sort, setSort] = useState<SortState>({ key: 'created', dir: 'desc' })
  // Archiving was reachable and reversal was not — the list only ever showed
  // live products, so an archived one disappeared from the one screen that
  // could bring it back.
  const [view, setView] = useState<'live' | 'archived'>('live')
  const [confirmTarget, setConfirmTarget] = useState<ProductListRow | null>(null)
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { products: prods, total: t } = await getAllProducts({
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sort: sort.key,
        dir: sort.dir,
        view,
      })
      setProducts(prods)
      setTotal(t)
      setSelected(new Set())
    } catch { toast.error('Failed to load products') }
    finally { setLoading(false) }
  }, [debouncedSearch, page, sort, view])

  useEffect(() => { load() }, [load])

  function onSort(key: ProductListSort) {
    setPage(0)
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'name' ? 'asc' : 'desc' }))
  }

  async function handleToggle(p: ProductListRow) {
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
    try { await archiveProduct(p.id); toast.success(`${p.name} archived`); load() }
    catch { toast.error('Could not archive') }
  }

  async function handleRestore(p: ProductListRow) {
    try { await restoreProduct(p.id); toast.success(`${p.name} restored as a draft`); load() }
    catch { toast.error('Could not restore') }
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
      toast.success(`${selected.size} product${selected.size === 1 ? '' : 's'} archived`)
      load()
    } catch { toast.error('Bulk archive failed') }
  }

  const savePrice = useCallback(async (id: string, rupees: number) => {
    const paise = Math.round(rupees * 100)
    await updateProduct(id, { price: paise })
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, price: paise } : p)))
  }, [])

  const saveStock = useCallback(async (id: string, next: number) => {
    await updateProduct(id, { inventory_quantity: next })
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, inventory_quantity: next } : p)))
  }, [])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const allSelected = products.length > 0 && selected.size === products.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Products</h2>
          <p className="mt-1 text-sm text-gray-500">{total} product{total === 1 ? '' : 's'}</p>
        </div>
        <Button onClick={() => router.push('/admin/products/new')} size="sm"><Plus className="mr-1 h-4 w-4" /> Add Product</Button>
      </div>

      {/* Fixed height so the bulk bar appearing on selection doesn't shove the
          table down a row-height and lose the reader's place. */}
      <div className="flex min-h-9 items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, slug, SKU..." className="pl-8" />
        </div>
        <div className="flex shrink-0 rounded-md border border-gray-300 p-0.5">
          {(['live', 'archived'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setView(v); setPage(0) }}
              className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${view === v ? 'bg-black text-white' : 'text-gray-600 hover:text-black'}`}
            >
              {v}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="mr-1 text-sm text-gray-500">{selected.size} selected</span>
            <Button variant="outline" size="sm" onClick={() => handleBulkActive(true)}>Set Active</Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkActive(false)}>Set Draft</Button>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setConfirmBulk(true)}>Archive</Button>
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton columns={8} rows={10} />
      ) : products.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="mb-1 text-lg font-medium text-gray-900">
              {view === 'archived' ? 'Nothing archived' : 'No products found'}
            </p>
            <p className="mb-4 max-w-sm text-sm text-gray-500">
              {debouncedSearch
                ? `Nothing matches "${debouncedSearch}".`
                : view === 'archived'
                  ? 'Archived products are hidden from the storefront but kept here, and can be restored at any time.'
                  : "You haven't added any products yet."}
            </p>
            {debouncedSearch
              ? <Button variant="outline" onClick={() => setSearch('')}>Clear search</Button>
              : view === 'archived'
                ? <Button variant="outline" onClick={() => setView('live')}>Back to live products</Button>
                : <Button onClick={() => router.push('/admin/products/new')}><Plus className="mr-2 h-4 w-4" /> Add your first product</Button>}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-0">
            <Table className="min-w-[900px] table-fixed">
              <colgroup>{COLS.map((c) => <col key={c.key} className={c.width} />)}</colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-10 px-3">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead className="h-10 px-0" />
                  <TableHead className="h-10 px-3"><SortHeader label="Product" sortKey="name" sort={sort} onSort={onSort} /></TableHead>
                  <TableHead className="h-10 px-3">SKU</TableHead>
                  <TableHead className="h-10 px-3"><SortHeader label="Price" sortKey="price" sort={sort} onSort={onSort} align="right" /></TableHead>
                  <TableHead className="h-10 px-3"><SortHeader label="Stock" sortKey="stock" sort={sort} onSort={onSort} align="right" /></TableHead>
                  <TableHead className="h-10 px-3">Status</TableHead>
                  <TableHead className="h-10 px-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const stock = p.inventory_quantity ?? 0
                  const outOfStock = stock <= 0
                  const lowStock = !outOfStock && stock <= (p.low_stock_threshold ?? 5)
                  const statusStyle = STATUS_STYLES[p.status] ?? STATUS_STYLES.draft
                  return (
                    <TableRow key={p.id} data-state={selected.has(p.id) ? 'selected' : undefined}>
                      <TableCell className="px-3 py-2">
                        <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelected(p.id)} aria-label={`Select ${p.name}`} />
                      </TableCell>
                      <TableCell className="px-0 py-2">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
                          {p.images?.[0] ? (
                            <Image src={p.images[0]} alt="" fill sizes="36px" className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[9px] font-medium text-gray-300">—</div>
                          )}
                        </div>
                      </TableCell>
                      {/* min-w-0 is what actually lets truncate work inside a
                          table cell; without it the cell grows to the text. */}
                      <TableCell className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/products/${p.id}`)}
                          className="block w-full min-w-0 text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-gray-900 hover:underline">{p.name}</span>
                            {p.is_featured && <Badge variant="secondary" className="shrink-0 text-[10px]">Featured</Badge>}
                          </div>
                          <div className="truncate font-mono text-[11px] text-gray-400">{p.slug}</div>
                        </button>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <span className="block truncate font-mono text-xs text-gray-500">{p.sku || '—'}</span>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <EditableNumber
                          mode="rupees"
                          value={p.price / 100}
                          ariaLabel={`Price for ${p.name}`}
                          onCommit={(rupees) => savePrice(p.id, rupees)}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <EditableNumber
                          mode="integer"
                          value={stock}
                          ariaLabel={`Stock for ${p.name}`}
                          onCommit={(next) => saveStock(p.id, next)}
                          className={outOfStock ? '[&_input]:text-red-600' : lowStock ? '[&_input]:text-amber-600' : ''}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge className={statusStyle.className}>{statusStyle.label}</Badge>
                          {outOfStock && <Badge variant="destructive" className="text-[10px]">Out of stock</Badge>}
                          {!outOfStock && lowStock && <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">Low</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex justify-end gap-0.5">
                          {view === 'archived' ? (
                            <Button variant="outline" size="sm" className="h-8" onClick={() => handleRestore(p)}>Restore</Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => router.push(`/admin/products/${p.id}`)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title={p.is_active ? 'Set to draft' : 'Set active'} onClick={() => handleToggle(p)}>
                                {p.is_active ? <PowerOff className="h-4 w-4 text-amber-600" /> : <Power className="h-4 w-4 text-green-600" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Archive" onClick={() => setConfirmTarget(p)}><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
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
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <span className="mr-1">Page {page + 1} of {pageCount}</span>
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="mr-1 h-4 w-4" /> Prev</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}
        title={`Archive "${confirmTarget?.name}"?`}
        description="It comes off the storefront immediately. Past orders keep it, and you can bring it back from the Archived tab — it returns as a draft."
        confirmLabel="Archive"
        onConfirm={handleArchiveConfirmed}
      />

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Archive ${selected.size} product${selected.size === 1 ? '' : 's'}?`}
        description="They come off the storefront immediately. Past orders keep them, and they can be restored from the Archived tab."
        confirmLabel="Archive"
        onConfirm={handleBulkArchiveConfirmed}
      />
    </div>
  )
}
