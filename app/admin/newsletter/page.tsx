'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getNewsletterSubscribers, exportNewsletterSubscribersCsv, type NewsletterSubscriber } from '@/actions/newsletter'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Mail, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'

const PAGE_SIZE = 20

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function load() {
    try {
      const { subscribers: rows, total: t } = await getNewsletterSubscribers({
        search: debouncedSearch || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      })
      setSubscribers(rows)
      setTotal(t)
    } catch { toast.error('Failed to load subscribers') }
  }
  useEffect(() => { load() }, [debouncedSearch, page])

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await exportNewsletterSubscribersCsv()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight text-black">Newsletter</h2><p className="text-sm text-gray-500 mt-1">{total} subscriber{total === 1 ? '' : 's'}</p></div>
        <Button onClick={handleExport} disabled={exporting} size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> {exporting ? 'Exporting...' : 'Export CSV'}</Button>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email..." className="pl-8" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8"><Mail className="h-8 w-8 mx-auto mb-2" /><p>{debouncedSearch ? 'No subscribers match your search' : 'No subscribers yet'}</p></TableCell></TableRow>
              ) : subscribers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-gray-900">{s.email}</TableCell>
                  <TableCell>{s.is_confirmed ? <Badge variant="success">Confirmed</Badge> : <Badge variant="secondary">Unconfirmed</Badge>}</TableCell>
                  <TableCell className="text-gray-500 text-xs uppercase">{s.source || '—'}</TableCell>
                  <TableCell className="text-gray-400 text-xs">{fmtDate(s.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
