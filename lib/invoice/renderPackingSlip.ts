import { addressLines, documentShell, esc, istDate, money } from './documentShell'

// The packing slip — the sheet that goes in the box.
//
// One slip per PARCEL, not per order. The schema already models split parcels
// and the admin can create several, so an order-level slip would list items that
// are not in the box the packer is holding, which is exactly the mistake the
// slip exists to prevent.
//
// It carries NO prices. A packing slip conventionally omits them, and here that
// matters twice over: the parcel may be a gift, and the tax invoice is the
// document that states money. The ONE exception is cash on delivery, where the
// amount to collect is the entire point of handing the courier a piece of paper.
//
// It DOES carry the artwork thumbnail and the colour, because this is a
// print-on-demand shop: the packer's real job is matching the right printed
// garment to the right parcel, and a row of text descriptions does not do that.
// The thumbnail never leaves the building — deliberately not on the invoice,
// which gets emailed and stored (see migration 045, which exists because
// customer design material was once world-readable).

export type PackingSlipItem = {
  productName: string
  variantName: string | null
  sku: string | null
  quantity: number
  colorName: string | null
  colorHex: string | null
  previewUrl: string | null
  productionNote: string | null
  printed: boolean
}

export type PackingSlipData = {
  orderNumber: string
  orderPlacedAt: string
  parcelLabel: string
  parcelCount: number
  courier: string | null
  awb: string | null
  storeName: string
  storeSupportEmail: string | null
  /** Only set when the courier must collect cash. */
  codAmountToCollect: number | null
  shipTo: Record<string, unknown> | null
  recipientName: string
  recipientPhone: string | null
  items: PackingSlipItem[]
  giftNote: string | null
  invoiceSerial: string | null
}

export function renderPackingSlip(data: PackingSlipData): string {
  const rows = data.items
    .map(
      (it) => `<tr>
      <td style="width:52px">
        ${
          it.previewUrl
            ? `<img src="${esc(it.previewUrl)}" alt="" style="width:44px;height:44px;object-fit:cover;border:1px solid #d1d5db;border-radius:3px">`
            : '<div style="width:44px;height:44px;border:1px dashed #d1d5db;border-radius:3px"></div>'
        }
      </td>
      <td>
        <div class="strong">${esc(it.productName)}</div>
        <div class="muted">${[it.variantName, it.colorName].filter(Boolean).map(esc).join(' · ')}</div>
        ${it.sku ? `<div class="note mono">${esc(it.sku)}</div>` : ''}
        ${it.productionNote ? `<div class="note strong">Note: ${esc(it.productionNote)}</div>` : ''}
      </td>
      <td class="center" style="width:56px">
        ${
          it.colorHex
            ? `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid #9ca3af;background:${esc(
                it.colorHex
              )}"></span>`
            : '—'
        }
      </td>
      <td class="center" style="width:46px">${it.printed ? '✓' : '—'}</td>
      <td class="right strong big" style="width:40px">${it.quantity}</td>
      <td class="center" style="width:44px">
        <span style="display:inline-block;width:16px;height:16px;border:1.5px solid #6b7280;border-radius:2px"></span>
      </td>
    </tr>`
    )
    .join('')

  const totalUnits = data.items.reduce((n, i) => n + i.quantity, 0)

  const body = `
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10mm">
  <div>
    <h1>${esc(data.storeName)}</h1>
    <div class="muted">Packing slip</div>
  </div>
  <div class="right">
    <div class="mono big strong">${esc(data.orderNumber)}</div>
    <div class="muted">Ordered ${istDate(data.orderPlacedAt)}</div>
    <div class="badge" style="margin-top:4px">${esc(data.parcelLabel)}${
      data.parcelCount > 1 ? ` of ${data.parcelCount}` : ''
    }</div>
  </div>
</div>

${
  data.codAmountToCollect !== null
    ? `<div style="margin-top:8px;border:2px solid #111827;padding:8px 10px;display:flex;justify-content:space-between;align-items:center">
         <div class="strong" style="letter-spacing:.08em">CASH ON DELIVERY — COLLECT</div>
         <div style="font-size:19px;font-weight:700">₹${money(data.codAmountToCollect)}</div>
       </div>`
    : ''
}

<div class="rule"></div>

<div class="parties">
  <div>
    <h2>Deliver to</h2>
    <div class="strong big">${esc(data.recipientName)}</div>
    <div>${addressLines(data.shipTo).map(esc).join('<br>')}</div>
    ${data.recipientPhone ? `<div class="strong">${esc(data.recipientPhone)}</div>` : ''}
  </div>
  <div>
    <h2>Parcel</h2>
    <div><span class="muted">Courier</span> ${esc(data.courier ?? 'not assigned')}</div>
    <div><span class="muted">AWB</span> <span class="mono">${esc(data.awb ?? '—')}</span></div>
    ${
      data.invoiceSerial
        ? `<div><span class="muted">Tax invoice</span> <span class="mono">${esc(
            data.invoiceSerial
          )}</span></div>`
        : '<div class="note">No tax invoice issued for this order.</div>'
    }
  </div>
</div>

<table class="lines" style="margin-top:8px">
  <thead><tr>
    <th style="width:52px">Art</th>
    <th>Item</th>
    <th class="center">Colour</th>
    <th class="center">Printed</th>
    <th class="right">Qty</th>
    <th class="center">Packed</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div style="display:flex;justify-content:space-between;margin-top:6px">
  <div class="note">Tick each line as it goes in the box.</div>
  <div class="strong">${totalUnits} item${totalUnits === 1 ? '' : 's'} in this parcel</div>
</div>

${
  data.giftNote
    ? `<div style="margin-top:8px;border:1px solid #d1d5db;padding:8px">
         <h2>Gift note</h2><div>${esc(data.giftNote)}</div>
       </div>`
    : ''
}

<div class="foot">
  <div class="note" style="max-width:110mm">
    <div class="strong">Not a tax invoice.</div>
    <div>Prices are not shown on this slip. ${
      data.invoiceSerial
        ? 'The tax invoice is sent separately and is available in the account area.'
        : ''
    }</div>
    ${
      data.storeSupportEmail
        ? `<div>Something wrong with this parcel? ${esc(data.storeSupportEmail)}</div>`
        : ''
    }
  </div>
  <div class="signature">
    <div class="line"><span class="note">Packed and checked by</span></div>
  </div>
</div>`

  return documentShell({
    title: `Packing slip ${data.orderNumber} ${data.parcelLabel}`,
    body,
  })
}
