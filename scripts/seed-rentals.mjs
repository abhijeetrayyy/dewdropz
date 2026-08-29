#!/usr/bin/env node
/**
 * Gear to rent, so the rental path has something real behind it.
 *
 * Kit a Garhwal trek actually needs, priced as a shop would: a daily rate, a
 * deposit that reflects what the item costs to replace, and a cleaning buffer
 * that is longer for anything that comes back wet.
 *
 * Re-runnable — items upsert on slug, units are only added if missing.
 *   node scripts/seed-rentals.mjs           # write
 *   node scripts/seed-rentals.mjs --remove  # take it all back out
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const REMOVE = process.argv.includes('--remove')

const GEAR = [
  { slug: 'four-season-tent', name: 'Four-Season Tent (2P)',
    summary: 'Double-wall, taped seams, holds a ridge in wind.',
    description: 'A two-person four-season tent for high camps. Double-wall with taped seams and a full-coverage fly, packed weight 2.8kg. Comes with poles, pegs and a footprint.',
    daily_rate: 45000, deposit: 900000, weekly_discount_pct: 15, min_days: 2, max_days: 21,
    buffer_days: 2, sac_code: '997314', gst_rate: 18,
    allows_pickup: true, allows_shipping: false, sort: 10, units: 4 },
  { slug: 'down-sleeping-bag', name: 'Down Sleeping Bag (−10°C)',
    summary: '650-fill down, comfort rated to −10°C.',
    description: 'A mummy bag rated to −10°C comfort, 650-fill responsibly sourced down, 1.4kg. Washed and re-lofted between every rental.',
    daily_rate: 25000, deposit: 600000, weekly_discount_pct: 15, min_days: 2, max_days: 21,
    buffer_days: 2, sac_code: '997314', gst_rate: 18,
    allows_pickup: true, allows_shipping: true, sort: 20, units: 6 },
  { slug: 'trekking-poles', name: 'Trekking Poles (pair)',
    summary: 'Aluminium, flick-lock, carbide tips.',
    description: 'A pair of three-section aluminium poles with flick locks and carbide tips. Adjustable 65–135cm.',
    daily_rate: 8000, deposit: 150000, weekly_discount_pct: 10, min_days: 1, max_days: 30,
    buffer_days: 0, sac_code: '997314', gst_rate: 18,
    allows_pickup: true, allows_shipping: true, sort: 30, units: 8 },
  { slug: 'sixty-litre-pack', name: '60L Trekking Pack',
    summary: 'Internal frame, rain cover included.',
    description: 'A 60-litre internal-frame pack with an adjustable back system and integrated rain cover. Fits loads to 18kg comfortably.',
    daily_rate: 18000, deposit: 500000, weekly_discount_pct: 15, min_days: 2, max_days: 21,
    buffer_days: 1, sac_code: '997314', gst_rate: 18,
    allows_pickup: true, allows_shipping: true, sort: 40, units: 5 },
  { slug: 'microspikes', name: 'Microspikes',
    summary: 'For frozen sections above the treeline.',
    description: 'Stainless microspikes for hard snow and ice on approach trails. Sized M/L.',
    daily_rate: 10000, deposit: 200000, weekly_discount_pct: 10, min_days: 1, max_days: 21,
    buffer_days: 1, sac_code: '997314', gst_rate: 18,
    allows_pickup: true, allows_shipping: true, sort: 50, units: 6 },
]

if (REMOVE) {
  const { error } = await db.from('rental_items').delete().in('slug', GEAR.map(g => g.slug))
  console.log(error ? 'failed: ' + error.message : `removed ${GEAR.length} rental items (units and bookings cascade)`)
  process.exit(error ? 1 : 0)
}

for (const g of GEAR) {
  const { units, ...item } = g
  const { data: row, error } = await db.from('rental_items')
    .upsert({ ...item, is_active: true }, { onConflict: 'slug' })
    .select('id,slug,name,daily_rate,deposit').single()
  if (error) { console.error(`  ${g.slug}: ${error.message}`); process.exit(1) }

  const { data: existing } = await db.from('rental_units').select('code').eq('item_id', row.id)
  const have = new Set((existing ?? []).map(u => u.code))
  const prefix = g.slug.split('-').map(w => w[0]).join('').toUpperCase()
  const toAdd = []
  for (let i = 1; i <= units; i++) {
    const code = `${prefix}-${String(i).padStart(3, '0')}`
    if (!have.has(code)) toAdd.push({ item_id: row.id, code })
  }
  if (toAdd.length) {
    const { error: uErr } = await db.from('rental_units').insert(toAdd)
    if (uErr) { console.error(`  units ${g.slug}: ${uErr.message}`); process.exit(1) }
  }
  console.log(`${row.name.padEnd(28)} ₹${(row.daily_rate/100).toFixed(0).padStart(4)}/day  deposit ₹${(row.deposit/100).toFixed(0).padStart(5)}  ${units} units (${toAdd.length} new)`)
}
console.log(`\n${GEAR.length} items available to rent`)
