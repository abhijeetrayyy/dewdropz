#!/usr/bin/env node
/**
 * One finished, already-printed garment — so the custom range has something in it.
 *
 * Migration 094 gave products two new edges (`custom_blank_id`,
 * `library_design_id`) and the storefront a banner that reads them. Neither can
 * be judged against an empty catalogue: today every product is a blank, so the
 * "printed on the Custom Print Tee" path has never rendered.
 *
 * THE PHOTOGRAPHS ARE REAL COMPOSITES, NOT MOCKUPS OF A MOCKUP. The product
 * images are the actual Jet Black tee mockup with the actual `garhwal-ridgeline`
 * library artwork drawn into the actual print zone read from
 * `customization_config` — the same rectangle, in the same canonical 800px
 * space, that the studio and the print renderer use. So the product photo shows
 * what the press would produce, rather than a picture of a shirt that does not
 * exist.
 *
 * REVERSIBLE AND MARKED. The row is created with a fixed slug and upserted, so
 * re-running replaces rather than multiplies. To remove it:
 *
 *   node scripts/seed-custom-range-demo.mjs --remove
 */

import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const SLUG = 'garhwal-ridgeline-tee'
const BLANK_SLUG = 'custom-print-tee'
const DESIGN_SLUG = 'garhwal-ridgeline'
const REMOVE = process.argv.includes('--remove')

// The renderer's coordinate space. Zone rectangles in customization_config are
// expressed against an 800px-wide reference mockup, so every drawing figure
// below scales from that — never from the source image's own pixel size.
const CANONICAL_WIDTH = 800

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

if (REMOVE) {
  const { error } = await db.from('products').delete().eq('slug', SLUG)
  console.log(error ? `remove failed: ${error.message}` : `removed ${SLUG}`)
  process.exit(error ? 1 : 0)
}

// ── The pieces ──────────────────────────────────────────────────────────────

const { data: blank, error: blankErr } = await db
  .from('products')
  .select('id,slug,name,price,customization_config')
  .eq('slug', BLANK_SLUG)
  .single()
if (blankErr || !blank) { console.error(`blank ${BLANK_SLUG} not found`); process.exit(1) }

const { data: design, error: designErr } = await db
  .from('design_library')
  .select('id,name,image_url')
  .eq('slug', DESIGN_SLUG)
  .single()
if (designErr || !design) { console.error(`design ${DESIGN_SLUG} not found — run seed-design-library.mjs first`); process.exit(1) }

const colour = blank.customization_config.colors.find((c) => c.available && c.front)
if (!colour) { console.error('blank has no available colourway with a front zone'); process.exit(1) }

// ── Composite ───────────────────────────────────────────────────────────────

async function compose(zone) {
  const garment = await loadImage(zone.mockupImage)
  const art = await loadImage(design.image_url)

  // Work at the mockup's own resolution, scaling the canonical zone up to it.
  const scale = garment.width / CANONICAL_WIDTH
  const canvas = createCanvas(garment.width, garment.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(garment, 0, 0)

  const zx = zone.x * scale
  const zy = zone.y * scale
  const zw = zone.widthPx * scale
  const zh = zone.heightPx * scale

  // Placement, not just fitting.
  //
  // A plain contain-fit is geometrically right and looks wrong: this artwork is
  // 3.5:1 and the front zone is 0.75:1, so fitting it inside the full 12x16in
  // rectangle shrinks a chest print to a thumbnail floating at the vertical
  // centre. A real chest print fills most of the zone's WIDTH and sits in its
  // upper third, which is where a person's chest is. Height is still clamped so
  // a tall design can never overflow the printable area.
  const w = Math.min(zw * 0.92, art.width * (zh / art.height))
  const h = (art.height / art.width) * w
  ctx.drawImage(art, zx + (zw - w) / 2, zy + zh * 0.14, w, h)

  return canvas.toBuffer('image/jpeg', 90)
}

const frontZone = colour.front
const jpg = await compose(frontZone)

const key = `range/${SLUG}-front.jpg`
const { error: upErr } = await db.storage.from('products')
  .upload(key, jpg, { contentType: 'image/jpeg', upsert: true })
if (upErr) { console.error(`upload failed: ${upErr.message}`); process.exit(1) }
const imageUrl = db.storage.from('products').getPublicUrl(key).data.publicUrl

// ── The product ─────────────────────────────────────────────────────────────
//
// Priced above the blank: this one is already printed, so it is a finished good
// rather than a blank plus a design fee. is_customizable is FALSE — that is the
// whole point. It is a garment you buy as-is, which happens to have come out of
// the studio, and 094's trigger would refuse the link if it were a blank.

const { data: product, error: rowErr } = await db
  .from('products')
  .upsert({
    slug: SLUG,
    name: 'Garhwal Ridgeline Tee',
    short_description: 'The Garhwal line, printed on a 240gsm tee.',
    description:
      'Eight peaks between 3,022m and 5,029m, drawn as one continuous line and printed across the front of a 240gsm combed cotton tee in an oversized unisex fit. Printed to order in Dehradun.',
    price: blank.price + 30000, // ₹300 over the blank
    images: [imageUrl],
    is_customizable: false,
    is_active: true,
    // Without this the product page renders "Out of stock" and the banner sits
    // under a button nobody can press — a demo that demonstrates the wrong thing.
    inventory_quantity: 25,
    custom_blank_id: blank.id,
    library_design_id: design.id,
  }, { onConflict: 'slug' })
  .select('id,slug,name,price')
  .single()

if (rowErr) { console.error(`row failed: ${rowErr.message}`); process.exit(1) }

console.log(`composited ${design.name} onto ${colour.name} ${blank.name}`)
console.log(`  image   : ${imageUrl}`)
console.log(`  product : ${product.name}  ₹${(product.price / 100).toLocaleString('en-IN')}  /products/${product.slug}`)
console.log(`  blank   : ${blank.name}`)
console.log(`  artwork : ${design.name}`)
