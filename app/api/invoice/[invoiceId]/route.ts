import { NextResponse } from 'next/server'
import { requireAuth } from '@/actions/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getInvoiceWithLines } from '@/lib/invoicing'
import { renderInvoice } from '@/lib/invoice/renderInvoice'

// The customer's own copy of their tax invoice.
//
// Ownership is checked HERE, explicitly, against the order behind the invoice —
// not left to RLS. The read goes through the service-role client (RLS bypassed)
// because that is what `getInvoiceWithLines` uses, so relying on the policy
// would be relying on something this code path does not actually apply. The
// policy stays as defence in depth for direct PostgREST access.
//
// Access is keyed on the invoice UUID plus the session, never on order_number:
// `generate_order_number` has only a 4-digit random suffix per day, so anything
// keyed on it is guessable.
//
// The buyer always gets the ORIGINAL FOR RECIPIENT copy — the duplicate and
// triplicate are the transporter's and the supplier's, and handing a customer a
// sheet marked "Triplicate for Supplier" is wrong.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const user = await requireAuth()
  const { invoiceId } = await params

  const { data: owner } = await createAdminSupabaseClient()
    .from('invoices')
    .select('id, order:orders!inner(user_id, email)')
    .eq('id', invoiceId)
    .maybeSingle()

  const order = (owner as { order?: { user_id: string | null; email: string | null } } | null)?.order

  // Match on the account, or on the email the order was placed with — a guest
  // checkout has no user_id, and that customer is still entitled to their own
  // invoice once they sign in with the same address.
  const isOwner =
    !!order &&
    ((order.user_id !== null && order.user_id === user.id) ||
      (!!order.email && !!user.email && order.email.toLowerCase() === user.email.toLowerCase()))

  // Same response whether the invoice belongs to someone else or does not
  // exist, so this cannot be used to probe which invoice ids are real.
  if (!isOwner) {
    return NextResponse.json({ error: 'No such invoice' }, { status: 404 })
  }

  const invoice = await getInvoiceWithLines(invoiceId)
  if (!invoice) {
    return NextResponse.json({ error: 'No such invoice' }, { status: 404 })
  }

  return new NextResponse(renderInvoice(invoice, 'original'), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}
