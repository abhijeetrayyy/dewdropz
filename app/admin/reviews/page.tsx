'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getAllReviews, approveReview, deleteReview } from '@/actions/reviews'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Check, Trash2, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { useConfirm } from '@/components/admin/useConfirm'

const PAGE_SIZE = 20

export default function ReviewsPage() {
  const { confirm, dialog } = useConfirm()
  const [reviews, setReviews] = useState<Array<Record<string, unknown>>>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)

  // Reviews grow with every sale, so this loaded the entire table on every
  // visit — one page at a time now, same shape as the customers list.
  async function load() {
    try {
      const { reviews: rows, total: t } = await getAllReviews({
        approved: undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      })
      setReviews(rows as Array<Record<string, unknown>>)
      setTotal(t)
    }
    catch { toast.error('Failed to load reviews') }
  }
  useEffect(() => { load() }, [page])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Deleting the last row on a page would otherwise leave the admin staring at
  // an empty table with no hint that there are earlier pages.
  async function reload() {
    if (reviews.length === 1 && page > 0) setPage((p) => p - 1)
    else load()
  }

  async function approve(id: string) {
    try { await approveReview(id); toast.success('Review approved'); load() }
    catch { toast.error('Failed') }
  }

  async function remove(id: string) {
    if (!(await confirm({
      title: 'Delete this review?',
      description: "The customer's rating and words are removed for good. This cannot be undone.",
      confirmLabel: 'Delete',
    }))) return
    try { await deleteReview(id); toast.success('Deleted'); reload() }
    catch { toast.error('Failed') }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Reviews</h2>
        <p className="text-sm text-gray-500 mt-1">
          Moderate customer reviews · {total} total
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">No reviews yet</TableCell></TableRow>
              ) : reviews.map((r) => {
                const product = (r.product as Record<string, unknown> | null)
                const user = (r.user as Record<string, unknown> | null)
                return (
                  <TableRow key={r.id as string}>
                    <TableCell className="font-medium text-gray-900">{product?.['name'] as string ?? '—'}</TableCell>
                    <TableCell className="text-gray-600">{user?.['full_name'] as string ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{r.rating as number}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-gray-500">{r.title ? `${r.title}: ` : ''}{(r.content as string)?.slice(0, 80) ?? ''}</TableCell>
                    <TableCell>{r.is_approved ? <Badge variant="success">Approved</Badge> : <Badge variant="warning">Pending</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!r.is_approved && <Button variant="ghost" size="icon" onClick={() => approve(r.id as string)}><Check className="h-4 w-4 text-green-600" /></Button>}
                        <Button variant="ghost" size="icon" onClick={() => remove(r.id as string)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page + 1} of {pageCount}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
      {dialog}
    </div>
  )
}
