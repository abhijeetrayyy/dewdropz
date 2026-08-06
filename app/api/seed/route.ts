import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase'
import { COLLECTIONS, PRODUCTS, CATEGORY_TILES } from '@/lib/constants'

// This runs service-role writes with zero request validation — a one-time catalog
// bootstrap, not something that should ever be reachable without an admin session.
// A redirect() (what requireAdmin() does elsewhere) is meant for page navigation,
// not an API route, so the admin check is inlined here to return a plain 401/403.
export async function GET() {
  const session = await createServerSupabaseClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await session.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminSupabaseClient()

  // 1. Seed Collections — upsert by slug so a re-run also backfills image_url/
  // gradient on rows that were created some other way (e.g. by hand in admin)
  // before those columns were part of the seed.
  for (const c of COLLECTIONS) {
    const { data: existingCol } = await supabase.from('collections').select('id, image_url').eq('slug', c.id).single()
    if (!existingCol) {
      await supabase.from('collections').insert({
        slug: c.id,
        name: c.name,
        tagline: c.tagline,
        description: c.description,
        gradient: c.gradient,
        image_url: c.image,
        is_active: true
      })
    } else if (!existingCol.image_url) {
      await supabase.from('collections').update({ image_url: c.image, gradient: c.gradient }).eq('id', existingCol.id)
    }
  }

  // 2. Seed Categories — top-level tiles only (CATEGORY_TILES has no hierarchy
  // today); each is flagged primary-eligible since they're exactly the curated
  // set the homepage/shop filter show as top-level browse tiles.
  for (const t of CATEGORY_TILES) {
    const { data: existingCat } = await supabase.from('categories').select('id').eq('slug', t.id).single()
    if (!existingCat) {
      await supabase.from('categories').insert({
        slug: t.id,
        name: t.name,
        description: t.blurb,
        image_url: t.image,
        is_primary_eligible: true,
        is_active: true,
      })
    }
  }

  // 3. Seed Products
  for (const p of PRODUCTS) {
    const { data: existingProd } = await supabase.from('products').select('id').eq('slug', p.slug).single()
    let productId = existingProd?.id
    if (!existingProd) {
      // Find the collection ID we just inserted
      const { data: col } = await supabase.from('collections').select('id').eq('slug', p.collectionId).single()

      const { data: insertedProd } = await supabase.from('products').insert({
        slug: p.slug,
        name: p.name,
        description: p.longDescription,
        short_description: p.desc,
        price: p.price * 100, // paise
        inventory_quantity: 100,
        images: [p.image],
        collection_id: col?.id,
        is_active: true
      }).select('id').single()
      productId = insertedProd?.id

      // Insert variants (sizes)
      if (insertedProd && p.sizes) {
        for (const size of p.sizes) {
          await supabase.from('product_variants').insert({
            product_id: insertedProd.id,
            name: `Size: ${size}`,
            sku: `${p.slug.toUpperCase()}-${size.toUpperCase()}`,
            inventory_quantity: 25,
            price_adjustment: 0
          })
        }
      }
    }

    // 4. Link the product to its category (many-to-many, but each seed
    // product only ever had one) — idempotent, skipped if already linked.
    if (productId) {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', p.category).single()
      if (cat) {
        const { data: existingLink } = await supabase.from('product_categories')
          .select('product_id').eq('product_id', productId).eq('category_id', cat.id).single()
        if (!existingLink) {
          await supabase.from('product_categories').insert({ product_id: productId, category_id: cat.id, is_primary: true })
        }
      }
    }
  }

  return NextResponse.json({ success: true, message: 'Seed complete' })
}
