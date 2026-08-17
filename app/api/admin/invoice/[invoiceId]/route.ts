import { NextResponse } from 'next/server'
import { requireAdmin } from '@/actions/auth'
import { getInvoiceWithLines } from '@/lib/invoicing'
import { renderInvoice, type InvoiceCopy } from '@/lib/invoice/renderInvoice'

// Serves an issued tax invoice as a printable document.
//
// Same pattern as the print-file route next door: auth first, params awaited
// (they are a Promise in Next 16), response hand-built. Route handlers are not
// cached by default in Next 16, which is what we want — an invoice must never
// be served from a shared cache, and one that has been cancelled must stop
// showing as live.
//
// Rule 48(1) wants three marked copies for a supply of goods, so the copy is a
// query parameter rather than three identical unmarked sheets.

const COPIES: InvoiceCopy[] = ['original', 'duplicate', 'triplicate', 'extra']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  await requireAdmin()

  const { invoiceId } = await params
  const requested = new URL(request.url).searchParams.get('copy')
  const copy: InvoiceCopy = COPIES.includes(requested as InvoiceCopy)
    ? (requested as InvoiceCopy)
    : 'original'

  const invoice = await getInvoiceWithLines(invoiceId)
  if (!invoice) {
    return NextResponse.json({ error: 'No such invoice' }, { status: 404 })
  }

  return new NextResponse(renderInvoice(invoice, copy), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Customer name, address and purchase detail. Never a shared cache, and
      // not kept on disk either — it is one query to regenerate.
      'Cache-Control': 'private, no-store',
    },
  })
}
