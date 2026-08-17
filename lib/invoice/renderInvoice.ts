import type { InvoiceWithLines } from '@/types/database'
import { addressLines, documentShell, esc, istDate, money } from './documentShell'

// Renders an issued tax invoice.
//
// Reads ONLY the invoice row and its lines. No joins to orders, products,
// store_settings or tax_rates — those all move, and a document that changes
// when they move is not a record of anything. If a value is not on the invoice
// row, it does not belong on the paper.

/** Rule 48(1): a supply of goods is invoiced in triplicate, each copy marked. */
export type InvoiceCopy = 'original' | 'duplicate' | 'triplicate' | 'extra'

const COPY_LABEL: Record<InvoiceCopy, string> = {
  original: 'Original for Recipient',
  duplicate: 'Duplicate for Transporter',
  triplicate: 'Triplicate for Supplier',
  extra: 'Extra Copy',
}

export function renderInvoice(invoice: InvoiceWithLines, copy: InvoiceCopy = 'original'): string {
  const intra = !invoice.is_igst
  const seller = invoice.seller_address
  const billing = invoice.billing_address
  const shipping = invoice.shipping_address

  // Column count differs between an intra-state invoice (CGST + SGST, two
  // columns) and an inter-state one (IGST, one). Printing empty CGST/SGST
  // columns on an IGST invoice is a common and confusing mistake.
  const taxCols = intra ? 4 : 2

  const lines = invoice.lines
    .map((l) => {
      const band =
        l.rate_band_min !== null || l.rate_band_max !== null
          ? `<div class="note">band: ${money(l.rate_band_min ?? 0)}${
              l.rate_band_max !== null ? `–${money(l.rate_band_max - 1)}` : ' and above'
            } / piece</div>`
          : ''
      return `<tr>
        <td class="right">${l.line_no}</td>
        <td>${esc(l.description)}${band}</td>
        <td class="mono">${esc(l.hsn_code)}</td>
        <td class="right">${l.quantity}</td>
        <td>${esc(l.uqc)}</td>
        <td class="right mono">${money(l.unit_price)}</td>
        <td class="right mono">${l.discount > 0 ? money(l.discount) : '—'}</td>
        <td class="right mono">${money(l.taxable_value)}</td>
        <td class="right">${Number(l.tax_rate)}%</td>
        ${
          intra
            ? `<td class="right mono">${money(l.cgst_amount)}</td>
               <td class="right mono">${money(l.sgst_amount)}</td>`
            : `<td class="right mono">${money(l.igst_amount)}</td>`
        }
        <td class="right mono strong">${money(l.line_total)}</td>
      </tr>`
    })
    .join('')

  // Rule 46 wants a rate-wise summary. This is the same shape a GSTR-1 line
  // takes, which is the point — the person filing should be able to read it off.
  const summary = (invoice.tax_summary ?? [])
    .map(
      (s) => `<tr>
        <td class="right">${Number(s.rate)}%</td>
        <td class="right mono">${money(s.taxable)}</td>
        ${
          intra
            ? `<td class="right mono">${money(s.cgst)}</td><td class="right mono">${money(s.sgst)}</td>`
            : `<td class="right mono">${money(s.igst)}</td>`
        }
        <td class="right mono strong">${money(s.cgst + s.sgst + s.igst + s.cess)}</td>
      </tr>`
    )
    .join('')

  const totalTax = invoice.cgst_total + invoice.sgst_total + invoice.igst_total + invoice.cess_total

  const body = `
${
  invoice.cancelled_at
    ? `<div class="cancelled">Cancelled${
        invoice.cancellation_reason ? ` — ${esc(invoice.cancellation_reason)}` : ''
      }</div>`
    : ''
}
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10mm">
  <div>
    <h1>${esc(invoice.seller_legal_name)}</h1>
    ${
      invoice.seller_trade_name && invoice.seller_trade_name !== invoice.seller_legal_name
        ? `<div class="muted">trading as ${esc(invoice.seller_trade_name)}</div>`
        : ''
    }
    <div class="muted">${addressLines(seller).map(esc).join('<br>')}</div>
    <div style="margin-top:4px"><span class="strong">GSTIN</span> <span class="mono">${esc(
      invoice.seller_gstin
    )}</span></div>
    <div><span class="strong">State</span> ${esc(invoice.seller_state)} (${esc(
      invoice.seller_state_code
    )})</div>
  </div>
  <div class="right">
    <div class="big strong" style="letter-spacing:.08em">TAX INVOICE</div>
    <div class="badge" style="margin-top:3px">${esc(COPY_LABEL[copy])}</div>
    <table style="margin-top:8px;font-size:11px">
      <tr><td class="muted right" style="padding-right:8px">Invoice no.</td>
          <td class="mono strong right">${esc(invoice.serial)}</td></tr>
      <tr><td class="muted right" style="padding-right:8px">Invoice date</td>
          <td class="right">${istDate(invoice.issued_at)}</td></tr>
      <tr><td class="muted right" style="padding-right:8px">Order</td>
          <td class="mono right">${esc(invoice.order_number)}</td></tr>
      <tr><td class="muted right" style="padding-right:8px">Order date</td>
          <td class="right">${istDate(invoice.order_placed_at)}</td></tr>
    </table>
  </div>
</div>

<div class="rule"></div>

<div class="parties">
  <div>
    <h2>Bill to</h2>
    <div class="strong">${esc(invoice.buyer_legal_name ?? invoice.buyer_name)}</div>
    <div class="muted">${addressLines(billing).map(esc).join('<br>')}</div>
    ${
      invoice.buyer_gstin
        ? `<div style="margin-top:3px"><span class="strong">GSTIN</span> <span class="mono">${esc(
            invoice.buyer_gstin
          )}</span></div>`
        : '<div class="note" style="margin-top:3px">Unregistered buyer</div>'
    }
    ${invoice.buyer_phone ? `<div class="muted">${esc(invoice.buyer_phone)}</div>` : ''}
  </div>
  <div>
    <h2>Ship to</h2>
    ${
      invoice.delivery_address_differs
        ? `<div class="strong">${esc(invoice.buyer_name)}</div>
           <div class="muted">${addressLines(shipping).map(esc).join('<br>')}</div>`
        : '<div class="muted">Same as billing address</div>'
    }
    <div style="margin-top:6px">
      <span class="strong">Place of supply</span>
      ${esc(invoice.place_of_supply_state)} (${esc(invoice.place_of_supply_code)})
    </div>
    <div><span class="strong">Reverse charge</span> ${invoice.reverse_charge ? 'Yes' : 'No'}</div>
  </div>
</div>

<table class="lines" style="margin-top:8px">
  <thead>
    <tr>
      <th class="right" style="width:22px">#</th>
      <th>Description</th>
      <th style="width:44px">HSN</th>
      <th class="right" style="width:28px">Qty</th>
      <th style="width:30px">UQC</th>
      <th class="right" style="width:58px">Rate/unit</th>
      <th class="right" style="width:52px">Disc.</th>
      <th class="right" style="width:62px">Taxable</th>
      <th class="right" style="width:34px">GST</th>
      ${
        intra
          ? '<th class="right" style="width:56px">CGST</th><th class="right" style="width:56px">SGST</th>'
          : '<th class="right" style="width:60px">IGST</th>'
      }
      <th class="right" style="width:66px">Total</th>
    </tr>
  </thead>
  <tbody>${lines}</tbody>
</table>

<div style="display:flex;gap:10mm;margin-top:8px;align-items:flex-start">
  <div style="flex:1">
    <h2>Tax summary</h2>
    <table class="lines">
      <thead><tr>
        <th class="right">Rate</th><th class="right">Taxable</th>
        ${intra ? '<th class="right">CGST</th><th class="right">SGST</th>' : '<th class="right">IGST</th>'}
        <th class="right">Tax</th>
      </tr></thead>
      <tbody>${summary}</tbody>
    </table>
    ${
      invoice.shipping_charge > 0 && invoice.shipping_tax_amount === 0
        ? `<div class="note" style="margin-top:5px">
             Delivery is billed separately and carries no GST on this invoice.
           </div>`
        : ''
    }
  </div>
  <table class="totals">
    <tr><td class="muted">Taxable value</td><td class="right mono">${money(
      invoice.taxable_total
    )}</td></tr>
    ${
      invoice.discount_total > 0
        ? `<tr><td class="muted">Discount</td><td class="right mono">−${money(
            invoice.discount_total
          )}</td></tr>`
        : ''
    }
    ${
      intra
        ? `<tr><td class="muted">CGST</td><td class="right mono">${money(invoice.cgst_total)}</td></tr>
           <tr><td class="muted">SGST</td><td class="right mono">${money(invoice.sgst_total)}</td></tr>`
        : `<tr><td class="muted">IGST</td><td class="right mono">${money(invoice.igst_total)}</td></tr>`
    }
    ${
      invoice.shipping_charge > 0
        ? `<tr><td class="muted">Delivery</td><td class="right mono">${money(
            invoice.shipping_charge
          )}</td></tr>`
        : ''
    }
    <tr class="grand"><td>Total (${esc(invoice.currency)})</td>
        <td class="right mono">${money(invoice.grand_total)}</td></tr>
  </table>
</div>

<div class="note" style="margin-top:6px">
  Total GST charged: ₹${money(totalTax)} · Amount in words: ${esc(rupeesInWords(invoice.grand_total))}
</div>

<div class="foot">
  <div class="note" style="max-width:100mm">
    ${
      invoice.einvoice_declaration
        ? '<div>Declaration: this is an electronically generated invoice.</div>'
        : ''
    }
    <div>Payment: ${esc(invoice.payment_method ?? '—')}${
      invoice.payment_status_at_issue ? ` (${esc(invoice.payment_status_at_issue)} at issue)` : ''
    }</div>
    <div>Goods once printed to order are made specifically for the buyer.</div>
  </div>
  <div class="signature">
    <div class="note">For ${esc(invoice.seller_legal_name)}</div>
    <div class="line">${esc(invoice.signatory_name)}<br><span class="note">Authorised signatory</span></div>
  </div>
</div>`

  return documentShell({
    title: `Tax Invoice ${invoice.serial}`,
    body,
  })
}

/**
 * Amount in words.
 *
 * Not decorative: a rupee figure in words is the conventional check against a
 * altered digit on an Indian invoice, and it is expected on the face of one.
 * Indian numbering — lakh and crore, not million.
 */
export function rupeesInWords(paise: number): string {
  const ONES = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
    'eighteen', 'nineteen',
  ]
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

  const under100 = (n: number): string =>
    n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`
  const under1000 = (n: number): string =>
    n < 100
      ? under100(n)
      : `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${under100(n % 100)}` : ''}`

  const words = (n: number): string => {
    if (n === 0) return 'zero'
    const parts: string[] = []
    const crore = Math.floor(n / 10_000_000)
    const lakh = Math.floor((n % 10_000_000) / 100_000)
    const thousand = Math.floor((n % 100_000) / 1000)
    const rest = n % 1000
    if (crore) parts.push(`${words(crore)} crore`)
    if (lakh) parts.push(`${under1000(lakh)} lakh`)
    if (thousand) parts.push(`${under1000(thousand)} thousand`)
    if (rest) parts.push(under1000(rest))
    return parts.join(' ')
  }

  const rupees = Math.floor(paise / 100)
  const pais = paise % 100
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return `${cap(words(rupees))} rupees${pais ? ` and ${under100(pais)} paise` : ''} only`
}
