import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Hardcode data from constants.ts since importing it in a loose TS script might have path alias issues
const COLLECTIONS = [
  { id: 'mist-and-morning', name: 'Mist & Morning', tagline: 'Fog, dew, first light.', description: 'Built for the hours between 5 and 7 a.m.', image: 'https://images.unsplash.com/photo-1758642882005-447873fd2d29', gradient: 'linear-gradient(165deg, #4A5D52 0%, #9AAE9C 40%, #E8EAE4 100%)' },
  { id: 'silent-altitude', name: 'Silent Altitude', tagline: 'Alpine stillness. Deep quiet.', description: 'Above 4,000m the noise of the world finally drops away.', image: 'https://images.unsplash.com/photo-1769631417306-a1da09f42b20', gradient: 'linear-gradient(165deg, #0B1520 0%, #1E3347 40%, #5A7A96 100%)' },
  { id: 'o-collection', name: 'O Collection', tagline: 'Where the trail becomes a way of life.', description: 'For the multi-day hauls across dry ridgelines.', image: 'https://images.unsplash.com/photo-1766933366411-7a921aebe181', gradient: 'linear-gradient(165deg, #2E1F16 0%, #6B3F28 50%, #C8906A 100%)' }
]

const PRODUCTS = [
  { slug: 'mist-tee', name: 'Mist Tee', desc: 'Cotton trekking t-shirt', price: 1800, image: 'https://images.unsplash.com/photo-1629185752193-0d25bb978c04', collectionId: 'mist-and-morning', sizes: ['S', 'M', 'L', 'XL'], longDescription: 'A lightweight base layer built for humid forest switchbacks.' },
  { slug: 'dew-windbreaker', name: 'Dew Windbreaker', desc: 'Packable shell for damp mornings', price: 3200, image: 'https://images.unsplash.com/photo-1595174028948-42a4b1786664', collectionId: 'mist-and-morning', sizes: ['S', 'M', 'L', 'XL'], longDescription: 'Packs down to fist size and cuts the chill off a foggy ridge.' },
  { slug: 'altitude-pack', name: 'Altitude Pack 40L', desc: 'Waterproof trail backpack', price: 2800, image: 'https://images.unsplash.com/photo-1509762774605-f07235a08f1f', collectionId: 'silent-altitude', sizes: ['One Size'], longDescription: 'Redesigned twice to survive monsoon and high-altitude wind.' },
  { slug: 'ridge-beanie', name: 'Ridge Beanie', desc: 'Merino wool summit beanie', price: 1100, image: 'https://images.unsplash.com/photo-1648483092137-6e63796c8b06', collectionId: 'silent-altitude', sizes: ['One Size'], longDescription: 'Tested above 5,000 metres.' },
  { slug: 'trail-cap', name: 'Trail Cap', desc: 'Merino wool cap', price: 1500, image: 'https://images.unsplash.com/photo-1780758841669-c961af1a5a7e', collectionId: 'o-collection', sizes: ['One Size'], longDescription: 'Sun-hardened for multi-day desert-ridge hauls.' },
  { slug: 'desert-scarf', name: 'Desert Scarf', desc: 'Dust-shield trail scarf', price: 900, image: 'https://images.unsplash.com/photo-1706206086774-0017933e52e2', collectionId: 'o-collection', sizes: ['One Size'], longDescription: 'Doubles as dust shield, sun guard, and impromptu pillow.' },
  { slug: 'summit-flask', name: 'Summit Flask', desc: 'Insulated steel bottle', price: 1200, image: 'https://images.unsplash.com/photo-1605539582747-ce302b9afca2', collectionId: 'o-collection', sizes: ['750ml'], longDescription: 'Keeps water cold for 24 hours.' }
]

async function seed() {
  console.log('Seeding DB...')
  
  for (const c of COLLECTIONS) {
    const { data: existingCol } = await supabase.from('collections').select('id').eq('slug', c.id).single()
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
      console.log(`Inserted collection: ${c.name}`)
    }
  }

  for (const p of PRODUCTS) {
    const { data: existingProd } = await supabase.from('products').select('id').eq('slug', p.slug).single()
    if (!existingProd) {
      const { data: col } = await supabase.from('collections').select('id').eq('slug', p.collectionId).single()
      
      const { data: insertedProd, error } = await supabase.from('products').insert({
        slug: p.slug,
        name: p.name,
        description: p.longDescription,
        short_description: p.desc,
        price: p.price * 100, // paise
        inventory_quantity: Math.floor(Math.random() * 20) + 1, // Add some low stock realism
        images: [p.image],
        collection_id: col?.id,
        is_active: true
      }).select('id').single()

      if (error) console.error(error)

      if (insertedProd && p.sizes) {
        for (const size of p.sizes) {
          await supabase.from('product_variants').insert({
            product_id: insertedProd.id,
            name: `Size: ${size}`,
            sku: `${p.slug.toUpperCase()}-${size.toUpperCase()}`,
            inventory_quantity: Math.floor(Math.random() * 50) + 2,
            price_adjustment: 0
          })
        }
        console.log(`Inserted product: ${p.name}`)
      }
    }
  }
  
  // Seed some dummy orders for the dashboard
  const { data: ord } = await supabase.from('orders').select('id').limit(1)
  if (ord?.length === 0) {
    await supabase.from('orders').insert([
      { order_number: 'ORD-1001', email: 'test@example.com', status: 'pending', payment_status: 'paid', subtotal: 360000, total_amount: 360000, shipping_address: { city: 'Dehradun' } },
      { order_number: 'ORD-1002', email: 'hello@dewdropz.com', status: 'processing', payment_status: 'paid', subtotal: 180000, total_amount: 180000, shipping_address: { city: 'Delhi' } },
      { order_number: 'ORD-1003', email: 'demo@dewdropz.com', status: 'shipped', payment_status: 'paid', subtotal: 450000, total_amount: 450000, shipping_address: { city: 'Mumbai' } },
    ])
    console.log('Inserted dummy orders')
  }

  console.log('Done!')
}

seed().catch(console.error)
