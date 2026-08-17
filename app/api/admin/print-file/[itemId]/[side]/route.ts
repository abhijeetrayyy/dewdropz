import { NextResponse } from 'next/server'
import { requireAdmin } from '@/actions/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'

// Streams a print file to the browser as an actual download.
//
// The admin used to link straight at the Supabase storage URL with a `download`
// attribute. Browsers ignore that attribute on cross-origin links, so the click
// opened the PNG in a tab instead of saving it — and when it did save, the file
// was called `52bd21ab-3aad-4e9b-8eaf-083f1bbe6620.png`, which tells the person
// at the press nothing about which order or which side it belongs to.
//
// Same-origin, so `Content-Disposition: attachment` is honoured, and the file
// arrives named after the order it has to be printed for.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string; side: string }> }
) {
  // Customer artwork, so this is behind the same gate as the rest of admin
  // rather than being a public URL that happens to be hard to guess.
  await requireAdmin()

  const { itemId, side } = await params
  if (side !== 'front' && side !== 'back') {
    return NextResponse.json({ error: 'Side must be front or back' }, { status: 400 })
  }

  const { data: item } = await createAdminSupabaseClient()
    .from('order_items')
    .select('product_name, variant_name, design:custom_designs(front_print_url, back_print_url), order:orders(order_number)')
    .eq('id', itemId)
    .maybeSingle()

  type Row = {
    product_name: string
    variant_name: string | null
    design: { front_print_url: string | null; back_print_url: string | null } | null
    order: { order_number: string } | null
  }
  const row = item as unknown as Row | null

  const url = side === 'front' ? row?.design?.front_print_url : row?.design?.back_print_url
  if (!url) {
    return NextResponse.json({ error: 'No print file for that side' }, { status: 404 })
  }

  // The URL is read from a row a customer's design write put there, so it is
  // client-influenced data being fetched by the server and streamed to an
  // admin's browser. Pinned to our own storage: without this, a crafted design
  // row could make this privileged route fetch an arbitrary host and hand the
  // response to whoever opened it.
  const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!storageOrigin || new URL(url).origin !== new URL(storageOrigin).origin) {
    return NextResponse.json({ error: 'Print file is not in this store\'s storage' }, { status: 400 })
  }

  const upstream = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Print file could not be read from storage' }, { status: 502 })
  }

  // Named for the press bench: order, side, garment. Anything that could upset
  // a filesystem is flattened rather than escaped, since these get dragged
  // between machines.
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  const parts = [
    row?.order?.order_number ?? 'order',
    side,
    row?.product_name ?? 'design',
    row?.variant_name ?? '',
  ].filter(Boolean).map(safe)
  const filename = `${parts.join('_')}.png`

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Artwork is immutable once an order exists, but it is also customer
      // data — cached in the browser only, never by a shared proxy.
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
