// The printable-document shell.
//
// These documents are plain HTML strings served straight from a Route Handler,
// not React pages. Three reasons, in order of weight:
//
//   1. An invoice must look the same in five years. A page inherits the admin's
//      Tailwind build, its fonts and its layout, all of which will be
//      redesigned; a self-contained document with its own inline CSS will not
//      quietly reflow because a utility class changed meaning.
//   2. Nothing here needs client JavaScript. It is a table of frozen numbers.
//   3. No PDF library and no headless browser. @napi-rs/canvas is already a
//      dependency but it is a raster renderer — text in a PNG is not selectable,
//      not searchable and not accessible. The browser's own print-to-PDF gives
//      real vector text, correct A4 pagination and repeating table headers for
//      free, and it runs on the operator's machine rather than in a serverless
//      function with a size limit.
//
// The cost, stated plainly: producing a PDF needs a human to press print. There
// is no server-side PDF, so nothing can be emailed as an attachment yet.

/** Escapes text for HTML. Everything interpolated below is user or buyer data. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Paise to rupees, for print.
 *
 * Deliberately NOT lib/utils.ts's formatPrice, which drops the decimals on a
 * whole-rupee amount. On a tax document every money column is aligned and
 * compared, so ₹1,899.00 and ₹4.95 must have the same shape.
 */
export function money(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** IST, because the business is in India and the server is not. */
export function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function istDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** A postal address as stored, rendered as lines with the empty parts dropped. */
export function addressLines(addr: Record<string, unknown> | null | undefined): string[] {
  if (!addr) return []
  const pick = (k: string) => {
    const v = addr[k]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const cityLine = [pick('city'), pick('state'), pick('postal_code')].filter(Boolean).join(', ')
  return [
    pick('line1') ?? pick('address_line1'),
    pick('line2') ?? pick('address_line2'),
    cityLine || null,
    pick('country'),
  ].filter((l): l is string => Boolean(l))
}

const PRINT_CSS = `
  /* A4 with the margins a courier pouch and a filing cabinet both tolerate. */
  @page { size: A4; margin: 12mm 10mm; }

  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 11px; line-height: 1.45; color: #111827; background: #f3f4f6;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet {
    width: 190mm; min-height: 273mm; margin: 12px auto; padding: 10mm;
    background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18);
  }

  h1 { font-size: 17px; margin: 0; letter-spacing: .02em; }
  h2 { font-size: 12px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; }
  .muted { color: #6b7280; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .right { text-align: right; }
  .center { text-align: center; }
  .strong { font-weight: 600; }
  .big { font-size: 13px; }

  table { width: 100%; border-collapse: collapse; }
  .lines th, .lines td { border: 1px solid #d1d5db; padding: 5px 6px; vertical-align: top; }
  .lines thead th {
    background: #f3f4f6; font-size: 10px; text-transform: uppercase;
    letter-spacing: .04em; color: #374151;
  }
  /* Repeat the header when a long order runs onto a second sheet. */
  .lines thead { display: table-header-group; }
  .lines tfoot { display: table-row-group; }
  .lines tr { break-inside: avoid; page-break-inside: avoid; }

  .parties { display: flex; gap: 10mm; }
  .parties > div { flex: 1; }
  .rule { border-top: 1px solid #e5e7eb; margin: 8px 0; }
  .badge {
    display: inline-block; padding: 1px 6px; border: 1px solid currentColor;
    border-radius: 3px; font-size: 9px; text-transform: uppercase; letter-spacing: .06em;
  }
  .totals { width: 68mm; margin-left: auto; }
  .totals td { padding: 3px 0; }
  .totals tr.grand td { border-top: 1.5px solid #111827; padding-top: 6px; font-size: 13px; font-weight: 700; }
  .foot { margin-top: 10mm; display: flex; justify-content: space-between; align-items: flex-end; gap: 10mm; }
  .signature { width: 58mm; text-align: center; }
  .signature .line { border-top: 1px solid #9ca3af; margin-top: 16mm; padding-top: 4px; }
  .note { font-size: 9.5px; color: #6b7280; }
  .cancelled {
    border: 2px solid #b91c1c; color: #b91c1c; padding: 6px 10px;
    text-align: center; font-weight: 700; letter-spacing: .1em; margin-bottom: 8px;
  }

  .toolbar {
    max-width: 190mm; margin: 12px auto -4px; display: flex; gap: 8px;
    justify-content: flex-end; font-family: inherit;
  }
  .toolbar button {
    font: inherit; font-size: 12px; padding: 7px 14px; border-radius: 6px;
    border: 1px solid #111827; background: #111827; color: #fff; cursor: pointer;
  }
  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  }
`

/**
 * Wraps document body HTML in a complete standalone page.
 *
 * `copyLabel` prints the Rule 48(1) triplicate marking. For a supply of goods
 * the invoice is required in triplicate — ORIGINAL FOR RECIPIENT, DUPLICATE FOR
 * TRANSPORTER, TRIPLICATE FOR SUPPLIER — so the caller decides which copy this
 * render is, rather than the shop printing three identical unmarked sheets.
 */
export function documentShell(opts: {
  title: string
  body: string
  autoPrint?: boolean
}): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<style>${PRINT_CSS}</style>
</head><body>
<div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="sheet">${opts.body}</div>
${opts.autoPrint ? '<script>window.addEventListener("load",()=>window.print())</script>' : ''}
</body></html>`
}
