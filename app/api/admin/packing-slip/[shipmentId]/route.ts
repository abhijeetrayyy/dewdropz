import { NextResponse } from 'next/server'
import { requireAdmin } from '@/actions/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getStoreSettings } from '@/actions/settings'
import { renderPackingSlip, type PackingSlipItem } from '@/lib/invoice/renderPackingSlip'

// The packing slip for one parcel.
//
// Keyed on the shipment, because that is the unit the packer holds. An order
// with two parcels gets two slips, each listing only what is in that box.
//
// `shipment_items` carries the per-parcel quantities. It can legitimately be
// empty — the admin can create a parcel without itemising it — and in that case
// the slip falls back to the whole order, which is right for the overwhelmingly
// common single-parcel order.

type ItemRow = {
  id: string
  product_name: string
  variant_name: string | null
  sku: string | null
  quantity: number
  printed_at: string | null
  production_note: string | null
  design: {
    color_name: string | null
    color_hex: string | null
    front_preview_url: string | null
  } | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shipmentId: string }> }
) {
  await requireAdmin()

  const { shipmentId } = await params
  const supabase = createAdminSupabaseClient()

  const { data: shipment } = await supabase
    .from('shipments')
    .select('id, order_id, awb, courier_name, created_at')
    .eq('id', shipmentId)
    .maybeSingle()

  if (!shipment) {
    return NextResponse.json({ error: 'No such parcel' }, { status: 404 })
  }

  const [{ data: order }, { data: parcelItems }, { data: siblings }, { data: invoice }, settings] =
    await Promise.all([
      supabase
        .from('orders')
        .select('order_number, created_at, payment_method, payment_status, total_amount, notes, shipping_address')
        .eq('id', shipment.order_id)
        .single(),
      supabase.from('shipment_items').select('order_item_id, quantity').eq('shipment_id', shipmentId),
      supabase
        .from('shipments')
        .select('id, created_at')
        .eq('order_id', shipment.order_id)
        .order('created_at'),
      supabase.from('invoices').select('serial').eq('order_id', shipment.order_id).maybeSingle(),
      getStoreSettings(),
    ])

  if (!order) {
    return NextResponse.json({ error: 'No such order' }, { status: 404 })
  }

  const { data: allItems } = await supabase
    .from('order_items')
    .select(
      'id, product_name, variant_name, sku, quantity, printed_at, production_note, design:custom_designs(color_name, color_hex, front_preview_url)'
    )
    .eq('order_id', shipment.order_id)
    .order('created_at')

  const rows = (allItems ?? []) as unknown as ItemRow[]
  const perParcel = new Map((parcelItems ?? []).map((r) => [r.order_item_id, r.quantity]))

  const items: PackingSlipItem[] = rows
    .filter((r) => perParcel.size === 0 || perParcel.has(r.id))
    .map((r) => ({
      productName: r.product_name,
      variantName: r.variant_name,
      sku: r.sku,
      quantity: perParcel.get(r.id) ?? r.quantity,
      colorName: r.design?.color_name ?? null,
      colorHex: r.design?.color_hex ?? null,
      previewUrl: r.design?.front_preview_url ?? null,
      productionNote: r.production_note,
      printed: r.printed_at !== null,
    }))

  // Parcels are numbered by creation order — the same order the admin's parcel
  // list shows them in, so "Parcel 2 of 3" on paper matches the screen.
  const index = (siblings ?? []).findIndex((s) => s.id === shipmentId)
  const shipTo = order.shipping_address as Record<string, unknown> | null

  // Only a COD parcel that has not already been paid shows an amount, and it is
  // the whole order total: the courier collects once, not per parcel.
  const isCod = order.payment_method === 'cod' && order.payment_status !== 'paid'

  return new NextResponse(
    renderPackingSlip({
      orderNumber: order.order_number,
      orderPlacedAt: order.created_at,
      parcelLabel: index >= 0 ? `Parcel ${index + 1}` : 'Parcel',
      parcelCount: siblings?.length ?? 1,
      courier: shipment.courier_name,
      awb: shipment.awb,
      storeName: settings.store_name,
      storeSupportEmail: settings.support_email ?? null,
      codAmountToCollect: isCod ? order.total_amount : null,
      shipTo,
      recipientName: (shipTo?.full_name as string) ?? '—',
      recipientPhone: (shipTo?.phone as string) ?? null,
      items,
      giftNote: (order.notes as string) || null,
      invoiceSerial: invoice?.serial ?? null,
    }),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    }
  )
}
