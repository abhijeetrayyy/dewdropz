import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { auditLog } from '@/lib/audit'
import type { Invoice, InvoiceLine, InvoiceWithLines, CreditNote } from '@/types/database'

// Issuing GST documents.
//
// The rules that matter are all enforced in Postgres (migration 048), not here:
// the serial is allocated by a row-locked counter inside the same transaction
// that writes the document, so a rollback gives the number back, and every
// refusal happens before a number is spent. This file is the thin layer that
// calls it, decides when, and records that it happened.
//
// Deliberately NOT a 'use server' file. Issuance is triggered by other server
// code — a dispatch, a refund — and must not be reachable as a POST endpoint of
// its own: allocating a GST serial is not something a browser should be able to
// ask for directly.

/** The counter's row lock is held to COMMIT, so issuance must never wrap I/O. */
type IssueResult =
  | { issued: Invoice; alreadyExisted: boolean }
  | { refused: string }

/**
 * Issue the tax invoice for an order, at dispatch.
 *
 * Dispatch rather than payment because s.31(1)(a) wants the invoice issued
 * before or at the removal of the goods — and because it is the only trigger
 * that works for COD, where the money arrives days later and nothing in this
 * codebase ever marks a COD order paid.
 *
 * Safe to call repeatedly: the function returns the existing invoice rather
 * than allocating a second number, which matters because `syncOrderFromShipments`
 * runs on every parcel update and the jobs queue is explicitly at-least-once.
 *
 * Never throws. A refusal is an expected outcome — the shop has no GSTIN today,
 * so every call refuses until someone fills that in — and a dispatch must not
 * fail because a document could not be produced. The reason is returned so the
 * admin can see it, and `uninvoiced_supplies` lists anything that slipped.
 */
export async function issueInvoiceForOrder(
  orderId: string,
  opts?: { supplyAt?: string; actorId?: string }
): Promise<IssueResult> {
  const supabase = createAdminSupabaseClient()

  const { data: existing } = await supabase
    .from('invoices')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()
  if (existing) return { issued: existing as Invoice, alreadyExisted: true }

  const { data, error } = await supabase.rpc('issue_invoice', {
    p_order_id: orderId,
    p_supply_at: opts?.supplyAt ?? null,
  })

  if (error) {
    // Every refusal is deliberate and its message is written to be read by a
    // shopkeeper, so it is passed through rather than flattened to "failed".
    return { refused: error.message.replace(/^cannot issue:?\s*/i, '') }
  }

  const invoice = (Array.isArray(data) ? data[0] : data) as Invoice | null
  if (!invoice) return { refused: 'the database returned no invoice' }

  // A serial number is at least as consequential as a refund, and refunds are
  // audited. Logged after the fact deliberately: this must not be inside the
  // transaction holding the counter lock.
  await auditLog({
    action: 'invoice.issued',
    entityType: 'order',
    entityId: orderId,
    actorId: opts?.actorId,
    after: {
      serial: invoice.serial,
      issued_at: invoice.issued_at,
      grand_total: invoice.grand_total,
      taxable_total: invoice.taxable_total,
      cgst: invoice.cgst_total,
      sgst: invoice.sgst_total,
      igst: invoice.igst_total,
      place_of_supply: invoice.place_of_supply_code,
    },
  })

  return { issued: invoice, alreadyExisted: false }
}

/**
 * Issue the credit note for a refund that has already succeeded.
 *
 * Section 34 requires one when the value of a supply is reduced after the
 * invoice was issued — a refund on an invoiced order is exactly that, and
 * without it the GST charged on the refunded portion is never reversed.
 *
 * Same contract as above: never throws, refuses loudly. A refund on an order
 * that was never invoiced needs no credit note and is not an error.
 */
export async function issueCreditNoteForRefund(
  refundId: string,
  reason: string,
  opts?: { actorId?: string }
): Promise<IssueResult | { skipped: string }> {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase.rpc('issue_credit_note', {
    p_refund_id: refundId,
    p_reason: reason,
  })

  if (error) {
    if (/no invoice/i.test(error.message)) {
      return { skipped: 'the order was never invoiced, so there is nothing to credit' }
    }
    return { refused: error.message.replace(/^cannot issue:?\s*/i, '') }
  }

  const note = (Array.isArray(data) ? data[0] : data) as CreditNote | null
  if (!note) return { refused: 'the database returned no credit note' }

  await auditLog({
    action: 'credit_note.issued',
    entityType: 'refund',
    entityId: refundId,
    actorId: opts?.actorId,
    after: {
      serial: note.serial,
      against_invoice: note.original_invoice_number,
      total_reduced: note.total_reduced,
      taxable_reduced: note.taxable_value_reduced,
      cgst: note.cgst_reduced,
      sgst: note.sgst_reduced,
      igst: note.igst_reduced,
    },
  })

  return { issued: note as unknown as Invoice, alreadyExisted: false }
}

/** An invoice with its lines, for rendering. Ordered as printed. */
export async function getInvoiceWithLines(invoiceId: string): Promise<InvoiceWithLines | null> {
  const supabase = createAdminSupabaseClient()

  const [{ data: invoice }, { data: lines }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle(),
    supabase.from('invoice_lines').select('*').eq('invoice_id', invoiceId).order('line_no'),
  ])

  if (!invoice) return null
  return { ...(invoice as Invoice), lines: (lines ?? []) as InvoiceLine[] }
}

/** The invoice for an order, if one was ever issued. */
export async function getInvoiceForOrder(orderId: string): Promise<Invoice | null> {
  const { data } = await createAdminSupabaseClient()
    .from('invoices')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()
  return (data as Invoice) ?? null
}
