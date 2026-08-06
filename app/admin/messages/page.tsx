'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { Fragment, useEffect, useState } from 'react'
import { getContactMessages, markContactMessageRead, type ContactMessage } from '@/actions/contact'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { MessageSquare, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

const PAGE_SIZE = 20

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    try {
      const { messages: rows, total: t } = await getContactMessages({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      setMessages(rows)
      setTotal(t)
    } catch {
      toast.error('Failed to load messages')
    }
  }
  useEffect(() => { load() }, [page])

  async function toggleRead(m: ContactMessage) {
    try {
      await markContactMessageRead(m.id, !m.is_read)
      setMessages((prev) => prev.map((row) => (row.id === m.id ? { ...row, is_read: !m.is_read } : row)))
    } catch {
      toast.error('Failed to update message')
    }
  }

  function toggleExpand(m: ContactMessage) {
    setExpanded((prev) => (prev === m.id ? null : m.id))
    if (!m.is_read) toggleRead(m)
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Messages</h2>
        <p className="text-sm text-gray-500 mt-1">{total} message{total === 1 ? '' : 's'} from the Contact page</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>From</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                    <p>No messages yet</p>
                  </TableCell>
                </TableRow>
              ) : (
                messages.map((m) => (
                  <Fragment key={m.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleExpand(m)}>
                      <TableCell>{expanded === m.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">{m.name}</div>
                        <div className="text-gray-500 text-xs">{m.email}</div>
                      </TableCell>
                      <TableCell>{m.is_read ? <Badge variant="secondary">Read</Badge> : <Badge variant="success">New</Badge>}</TableCell>
                      <TableCell className="text-gray-400 text-xs">{fmtDate(m.created_at)}</TableCell>
                    </TableRow>
                    {expanded === m.id && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-gray-50">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap py-2">{m.message}</p>
                          <div className="flex gap-2 pb-2">
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); toggleRead(m) }}>
                              Mark as {m.is_read ? 'unread' : 'read'}
                            </Button>
                            <a href={`mailto:${m.email}`}>
                              <Button variant="outline" size="sm">Reply by email</Button>
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
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
