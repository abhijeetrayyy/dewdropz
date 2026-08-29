/**
 * Photographs and demo gear for the rental locker.
 *
 * WHAT "LEGITIMATE" MEANS HERE. This does exactly what the admin screen does
 * when a shopkeeper drags a file into the gear editor: it puts the bytes in the
 * `products` storage bucket with a UUID filename and `upsert: true` — the same
 * call `uploadFileAdmin` makes — and stores the resulting PUBLIC URL on the
 * item. Nothing hotlinks a third-party host at render time, so the storefront,
 * both phones and the print pipeline all read the same bytes we control. That
 * distinction is not cosmetic: product imagery used to be site-relative paths
 * that resolved against the web origin, and native has no origin, so every
 * product on the phone rendered as an empty box.
 *
 * WHERE THE PICTURES COME FROM. Unsplash, by photo id, downloaded at run time —
 * the same source `scripts/seed-trek-demo.mjs` already uses for trail covers.
 * Every id below was checked by eye before it was written down, because an id
 * is not evidence of what is in the frame: the first sweep produced a pizza, a
 * toy train and a gaming PC for queries that sounded like camping gear.
 *
 * WHAT IT WILL NOT DO. It never overwrites images an item already has, so
 * running it twice does not duplicate uploads, and anything a human has since
 * photographed proplerly is left alone.
 *
 *   node scripts/seed-rental-catalogue.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Each entry: [unsplash photo id, what is actually in the frame].
const PHOTO = {
  tentDramaticSky:  ['1571687949921-1306bfb24b72', 'orange tent pitched under a breaking sky'],
  tentRidgeSunrise: ['1510312305653-8ed496efae75', 'tent on a ridge at sunrise'],
  tentMilkyWay:     ['1517824806704-9040b037703b', 'lit tent under the milky way'],
  tentInterior:     ['1504280390367-361c6d9f38f4', 'inside a tent, bedding laid out, forest beyond'],
  tentForestNight:  ['1470246973918-29a93221c455', 'lit tent among trees at night'],
  tentsMistyField:  ['1533873984035-25970ab07461', 'several tents in a misty field at dawn'],
  packGreenRock:    ['1622260614153-03223fb72052', 'green trekking pack propped on a rock'],
  hikerWithPack:    ['1526772662000-3f88f10405ff', 'hiker with a loaded pack beside a cairn'],
  campfire:         ['1486915309851-b0cc1f8a0084', 'campfire burning down in a stone ring'],
  campFirelight:    ['1478131143081-80f7f84ca84d', 'people cooking around a fire at camp'],
  snowTraction:     ['1551698618-1dfe5d97d256', 'edging across hard snow'],
  sleepingSunset:   ['1563299796-17596ed6b017', 'bedded down in the back of a vehicle at sunset'],
}

// Photographs for gear that already exists. Trekking poles are deliberately
// absent: nothing in the set actually shows a pair of poles, and dressing the
// listing with a picture of something else is worse than an honest gap — the
// admin screen flags it with a "no photo" badge for exactly this reason.
const PHOTOS_FOR = {
  'four-season-tent': ['tentDramaticSky', 'tentRidgeSunrise', 'tentMilkyWay'],
  'down-sleeping-bag': ['tentInterior', 'sleepingSunset'],
  'sixty-litre-pack': ['packGreenRock', 'hikerWithPack'],
  'microspikes': ['snowTraction'],
}

// Demo gear, chosen so every one of them has a photograph that honestly shows
// what is being rented.
const NEW_GEAR = [
  {
    slug: 'camp-kitchen-kit', name: 'Camp Kitchen Kit',
    summary: 'Stove, pots, and everything else needed to cook for four.',
    description:
      'A canister stove with a wide burner head, two nesting pots, a folding windshield, a lighter and four sets of enamel plates and mugs. Packs into the larger pot. Gas is not included — we sell canisters at the counter.',
    daily_rate: 22000, deposit: 300000, weekly_discount_pct: 10,
    min_days: 2, max_days: 21, buffer_days: 1, gst_rate: 18, sac_code: '997314',
    allows_pickup: true, allows_shipping: true,
    photos: ['campfire', 'campFirelight'], units: ['CKK-001', 'CKK-002', 'CKK-003', 'CKK-004'],
  },
  {
    slug: 'weekend-camp-bundle', name: 'Weekend Camp Bundle (2P)',
    summary: 'Tent, two bags, two mats. One booking, everything for a weekend.',
    description:
      'The whole kit for two people for two nights: a three-season two-person tent, two bags rated to 0°C, and two closed-cell mats. Cheaper than renting the four separately, and it comes packed the way it should be carried.',
    daily_rate: 85000, deposit: 1500000, weekly_discount_pct: 20,
    min_days: 2, max_days: 14, buffer_days: 2, gst_rate: 18, sac_code: '997314',
    allows_pickup: true, allows_shipping: false,
    photos: ['tentsMistyField', 'tentForestNight'], units: ['WCB-001', 'WCB-002', 'WCB-003'],
  },
]

async function upload(key) {
  const [id, alt] = PHOTO[key]
  const res = await fetch(`https://images.unsplash.com/photo-${id}?w=1400&q=80&fm=jpg`)
  if (!res.ok) throw new Error(`could not fetch ${key} (${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  // UUID filename and upsert:true — byte for byte what uploadAdminImage does.
  const path = `${crypto.randomUUID()}.jpg`
  const { data, error } = await db.storage.from('products').upload(path, bytes, {
    contentType: 'image/jpeg', upsert: true,
  })
  if (error) throw error
  const { data: pub } = db.storage.from('products').getPublicUrl(data.path)
  console.log(`   uploaded ${key.padEnd(17)} ${(bytes.length / 1024).toFixed(0)}kB — ${alt}`)
  return pub.publicUrl
}

async function photosFor(keys) {
  const urls = []
  for (const k of keys) urls.push(await upload(k))
  return urls
}

console.log('Photographs for gear already in the locker')
for (const [slug, keys] of Object.entries(PHOTOS_FOR)) {
  const { data: item } = await db.from('rental_items').select('id,name,images').eq('slug', slug).maybeSingle()
  if (!item) { console.log(` ! ${slug} — not in the locker, skipped`); continue }
  if (item.images?.length) { console.log(` · ${item.name} already has ${item.images.length}, left alone`); continue }
  console.log(` → ${item.name}`)
  const images = await photosFor(keys)
  const { error } = await db.from('rental_items').update({ images }).eq('id', item.id)
  console.log(error ? `   FAILED ${error.message}` : `   saved ${images.length} image(s)`)
}

console.log('\nDemo gear')
for (const g of NEW_GEAR) {
  const { units, photos, ...row } = g
  const { data: existing } = await db.from('rental_items').select('id,images').eq('slug', row.slug).maybeSingle()
  const alreadyPhotographed = !!existing?.images?.length
  console.log(` → ${row.name}${alreadyPhotographed ? ' (photographs kept)' : ''}`)
  const images = alreadyPhotographed ? existing.images : await photosFor(photos)
  const { data: item, error } = await db.from('rental_items')
    .upsert({ ...row, images, is_active: true }, { onConflict: 'slug' }).select().single()
  if (error) { console.log(`   FAILED ${error.message}`); continue }
  // Units are the physical copies — without them nothing is bookable, because
  // availability counts units, not items.
  // The unique key is (item_id, code), not code — tag codes only have to be
  // unique WITHIN one piece of gear, so two items may both have a "-001".
  const { error: uErr } = await db.from('rental_units')
    .upsert(units.map((code) => ({ item_id: item.id, code, condition: 'good' })), { onConflict: 'item_id,code' })
  console.log(uErr ? `   units FAILED ${uErr.message}` : `   saved with ${units.length} units`)
}

const { data: all } = await db.from('rental_items').select('slug,name,images,is_active').order('sort')
console.log('\nThe locker now:')
for (const i of all) {
  console.log(`  ${i.images?.length ? String(i.images.length).padStart(2) + ' photo' : ' — no photo'}  ${i.name}${i.is_active ? '' : '  (unlisted)'}`)
}
