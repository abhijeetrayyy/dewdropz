'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/actions/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { issueInvoiceForOrder } from '@/lib/invoicing'
import { auditLog } from '@/lib/audit'

/**
 * Issuing a tax invoice by hand, for a supply that already went out.
 *
 * WHY THIS IS NEEDED. `issueInvoiceForOrder` is called from exactly one place:
 * the moment a parcel is dispatched (actions/shipments.ts). That call refuses
 * harmlessly when the shop has no GSTIN — a parcel must still be able to leave
 * — and the order lands in the `uninvoiced_supplies` view. But nothing ever
 * revisits it. Once the GSTIN is filled in, every future dispatch invoices
 * itself and every past one stays uninvoiced forever, because its dispatch
 * moment has been and gone. This is the way back.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not pass a supply date. The RPC
 * already resolves one — dispatch, then confirmation, then placement — and that
 * chain is the considered answer; restating it here would be a second copy to
 * keep in step. The consequence is worth being explicit about: `issued_at` on
 * the invoice is the SUPPLY timestamp, not the moment the button was pressed,
 * so this back-dates the document to when the goods actually left. That is
 * s.31(1)(a) working as intended rather than a liberty being taken.
 *
 * Serials are gapless and ascend. Back-dating one behind an invoice that has
 * already been issued would leave the register ordered by number but not by
 * date, so the honest time to do this is before later invoices exist. The
 * function does not enforce that — a shopkeeper catching up on two old orders
 * in the right sequence is fine, and refusing it would be worse than the
 * irregularity — but it is why the screen says what it says.
 *
 * The financial-year guard lives in the RPC and is left there: a supply from a
 * closed FY is a filing decision, not a button.
 */
export type IssueInvoiceResult =
  | { ok: true; serial: string; alreadyExisted: boolean }
  | { ok: false; error: string }

export async function issueInvoiceNow(orderId: string): Promise<IssueInvoiceResult> {
  const admin = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status, shipped_at, delivered_at')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { ok: false, error: 'That order no longer exists.' }

  // The RPC has no dispatch guard — it falls back to the confirmation and
  // placement dates, which is right for a retry of a dispatch that happened,
  // and wrong for a button somebody can press on an order still sitting in the
  // workshop. An invoice is due at the removal of the goods; nothing has been
  // removed yet.
  if (!order.shipped_at && !order.delivered_at) {
    return {
      ok: false,
      error: `${order.order_number} has not been dispatched. The invoice is due when the goods leave, and it will be raised automatically then.`,
    }
  }

  if (order.status === 'cancelled') {
    return {
      ok: false,
      error: `${order.order_number} is cancelled. A cancelled supply is not invoiced; if goods did go out, reopen the order first.`,
    }
  }

  const result = await issueInvoiceForOrder(orderId, { actorId: admin?.id })

  if ('refused' in result) return { ok: false, error: result.refused }

  // issueInvoiceForOrder already logs `invoice.issued`. This second entry
  // records that a person chose to issue it outside the dispatch flow, which is
  // the part a later reader of the register will want explained.
  if (!result.alreadyExisted) {
    await auditLog({
      actorId: admin?.id,
      actorEmail: admin?.email,
      action: 'invoice.issued_manually',
      entityType: 'order',
      entityId: orderId,
      after: { serial: result.issued.serial, issued_at: result.issued.issued_at },
      note: `Issued by hand for a supply dispatched on ${order.shipped_at ?? order.delivered_at}.`,
    })
  }

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')

  return {
    ok: true,
    serial: result.issued.serial,
    alreadyExisted: result.alreadyExisted,
  }
}
