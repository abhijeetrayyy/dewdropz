import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { COLLECTIONS, PRODUCTS } from '@/lib/constants'

export async function GET() {
  const supabase = createAdminSupabaseClient()
  
  // 1. Seed Collections
  for (const c of COLLECTIONS) {
    // Check if exists
    const { data: existingCol } = await supabase.from('collections').select('id').eq('slug', c.id).single()
    if (!existingCol) {
      await supabase.from('collections').insert({
        id: '00000000-0000-0000-0000-' + Buffer.from(c.id).toString('hex').slice(0, 12).padEnd(12, '0'), // deterministic UUID mock
        slug: c.id,
        name: c.name,
        tagline: c.tagline,
        description: c.description,
        gradient: c.gradient,
        image_url: c.image,
        is_active: true
      })
    }
  }

  // 2. Seed Products
  for (const p of PRODUCTS) {
    const { data: existingProd } = await supabase.from('products').select('id').eq('slug', p.slug).single()
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
  }

  return NextResponse.json({ success: true, message: 'Seed complete' })
}
