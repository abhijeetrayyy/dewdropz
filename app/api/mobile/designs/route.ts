import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { uploadFileAdmin, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import { mobileDesignSchema } from '@/lib/validations'
import { renderPreview, renderPrint, type RenderLayer } from '@/lib/customize/renderDesign'
import type { CustomizationConfig, CustomizationZone } from '@/types/database'

// The mobile studio posts the design as structured layer data, not images.
// Rasterizing here (rather than on the phone) is what makes the print file
// resolution-independent and identical across iOS and Android — and it's
// required in practice, because on-device capture does not work reliably under
// React Native's New Architecture, which the app needs for Reanimated 4.
//
// Auth is optional: custom_designs allows guest rows and the web studio lets
// guests design before signing in, so requiring a token would make mobile
// stricter than web for no reason.

// A relative mockup path (e.g. "/custom/tshirt/tshirt-front.png") is served
// from /public, so read it off disk instead of round-tripping through HTTP —
// that keeps rendering working even if the site isn't reachable from itself.
function resolveMockup(mockupImage: string): { localPath?: string; url?: string } {
  if (/^https?:\/\//i.test(mockupImage)) return { url: mockupImage }
  const clean = mockupImage.replace(/^\/+/, '').split('?')[0]
  // Guard against traversal out of /public via a crafted config value.
  const full = path.join(process.cwd(), 'public', clean)
  const root = path.join(process.cwd(), 'public')
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid mockup path')
  return { localPath: full }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  let userId: string | null = null
  if (token) {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await anon.auth.getUser(token)
    // A token that was sent but doesn't verify is an error, not a guest —
    // silently downgrading would attach someone's design to nobody.
    if (error || !data.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = data.user.id
  }

  const body = await request.json().catch(() => null)
  const parsed = mobileDesignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const input = parsed.data

  const admin = createAdminSupabaseClient()

  // The print zones are server-side truth. Taking geometry from the request
  // would let a client print outside the area the garment actually allows.
  const { data: product, error: productError } = await admin
    .from('products')
    .select('id, is_customizable, customization_config')
    .eq('id', input.productId)
    .single()

  if (productError || !product?.is_customizable) {
    return NextResponse.json({ error: 'This product is not customizable.' }, { status: 400 })
  }

  const config = product.customization_config as CustomizationConfig | null
  const colorway = input.colorName
    ? config?.colors?.find((c) => c.name === input.colorName)
    : config?.colors?.find((c) => c.available)

  if (!colorway) {
    return NextResponse.json({ error: 'That colour is not available.' }, { status: 400 })
  }
  if (!colorway.available) {
    return NextResponse.json({ error: `${colorway.name} isn't available yet.` }, { status: 400 })
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    product_id: input.productId,
    variant_id: input.variantId ?? null,
    color_name: colorway.name,
    color_hex: colorway.hex,
  }

  for (const side of ['front', 'back'] as const) {
    const layers = input[side]
    if (!layers || layers.length === 0) continue

    const zone = colorway[side] as CustomizationZone | undefined
    if (!zone) {
      return NextResponse.json(
        { error: `${colorway.name} has no ${side} print area.` },
        { status: 400 }
      )
    }

    try {
      const [print, preview] = await Promise.all([
        renderPrint(zone, layers as RenderLayer[]),
        renderPreview(zone, layers as RenderLayer[], resolveMockup(zone.mockupImage)),
      ])

      const [printUrl, previewUrl] = await Promise.all([
        uploadFileAdmin(STORAGE_BUCKETS.DESIGNS, `${crypto.randomUUID()}.png`, print, 'image/png'),
        uploadFileAdmin(STORAGE_BUCKETS.DESIGNS, `${crypto.randomUUID()}.png`, preview, 'image/png'),
      ])

      row[`${side}_print_url`] = printUrl
      row[`${side}_preview_url`] = previewUrl
      row[`${side}_design`] = { layers }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not render your design.'
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  const { data, error } = await admin.from('custom_designs').insert(row).select('id').single()
  if (error || !data) {
    return NextResponse.json({ error: 'Could not save your design.' }, { status: 500 })
  }

  return NextResponse.json({
    designId: data.id as string,
    previewUrl: (row.front_preview_url ?? row.back_preview_url ?? null) as string | null,
  })
}
