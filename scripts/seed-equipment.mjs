/**
 * Equipment you can BUY, linked to the same gear you can rent.
 *
 * The client sells adventure equipment as well as renting it, and the app could
 * only ever rent. Rather than a second parallel listing per item — which drifts
 * the first time somebody edits one side — each sellable piece becomes a normal
 * product and the existing rental row points at it (migration 098). The
 * storefront then offers both on one page.
 *
 * WHAT IS DELIBERATELY NOT SHARED: the counts. `inventory_quantity` here is how
 * many we can SELL. The rental locker's supply is `rental_units` and its
 * availability comes from the no-double-booking constraint. Selling the last
 * sellable tent must not empty the locker; a tent coming back from rent must
 * not become sellable stock. See the header of 098.
 *
 * Photographs are reused from the rental rows — same gear, same pictures,
 * already in our own storage bucket.
 *
 *   node scripts/seed-equipment.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// HSN codes are the goods equivalent of the rental SAC — a sale is a supply of
// GOODS, a rental is a supply of SERVICE, and they are not interchangeable.
// These are the usual chapter headings for camping equipment; the shop's
// accountant should confirm them before this goes live.
const GEAR = [
  { rental: 'four-season-tent',      name: 'Four-Season Tent (2P)',   price: 1200000, hsn: '6306', stock: 4,
    blurb: 'The same double-wall tent we rent out, to own.' },
  { rental: 'basecamp-dome-tent-4p', name: 'Basecamp Dome Tent (4P)', price: 1600000, hsn: '6306', stock: 3,
    blurb: 'Four-person freestanding dome, colour-coded poles.' },
  { rental: 'down-sleeping-bag',     name: 'Down Sleeping Bag (−10°C)', price: 850000, hsn: '9404', stock: 6,
    blurb: '650-fill responsibly sourced down, comfort rated to −10°C.' },
  { rental: 'sixty-litre-pack',      name: '60L Trekking Pack',       price: 650000,  hsn: '4202', stock: 5,
    blurb: 'Internal frame, rain cover included.' },
  { rental: 'trekking-poles',        name: 'Trekking Poles (pair)',   price: 220000,  hsn: '9506', stock: 8,
    blurb: 'Aluminium, flick-lock, carbide tips.' },
  { rental: 'microspikes',           name: 'Microspikes',             price: 280000,  hsn: '9506', stock: 6,
    blurb: 'Stainless spikes on an elastomer harness.' },
]

// A shelf for them, so gear is findable without going through the locker.
const { data: cat } = await db.from('categories')
  .upsert({ slug: 'equipment', name: 'Equipment', description: 'Tents, bags, packs and traction — to buy or to borrow.', sort_order: 30, is_active: true },
          { onConflict: 'slug' })
  .select().single()
console.log('category:', cat.slug)

for (const g of GEAR) {
  const { data: item } = await db.from('rental_items')
    .select('id,slug,name,summary,description,images,product_id').eq('slug', g.rental).maybeSingle()
  if (!item) { console.log(` ! no rental row for ${g.rental}, skipped`); continue }

  const slug = `${g.rental}-buy`
  const { data: product, error } = await db.from('products').upsert({
    slug,
    name: g.name,
    short_description: g.blurb,
    description: item.description,
    price: g.price,
    images: item.images,
    inventory_quantity: g.stock,
    low_stock_threshold: 2,
    hsn_code: g.hsn,
    is_active: true,
    is_customizable: false,
  }, { onConflict: 'slug' }).select().single()
  if (error) { console.log(` ! ${g.name}: ${error.message}`); continue }

  await db.from('product_categories')
    .upsert({ product_id: product.id, category_id: cat.id, is_primary: true }, { onConflict: 'product_id,category_id' })

  const { error: linkErr } = await db.from('rental_items')
    .update({ product_id: product.id }).eq('id', item.id)

  console.log(` ${linkErr ? 'LINK FAILED ' + linkErr.message : 'ok'}  ${g.name.padEnd(26)} buy ₹${g.price/100} · rent ${item.slug}`)
}

const { data: check } = await db.from('rental_items')
  .select('slug,name,product_id,product:products(slug,price,inventory_quantity)').order('sort')
console.log('\nthe locker, and what each piece costs to own:')
for (const r of check) {
  console.log(`  ${r.slug.padEnd(24)} ${r.product ? `buy ₹${r.product.price/100} (${r.product.inventory_quantity} in stock)` : 'rent only'}`)
}
