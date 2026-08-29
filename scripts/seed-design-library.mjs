#!/usr/bin/env node
/**
 * The DEWDROPZ design library, stocked from the brand's own marks.
 *
 * `design_library` (migration 092) shipped with a working admin screen and a
 * working studio picker, and zero rows — so the "choose one of ours" door the
 * client brief asked for has been invisible since the day it was built. This
 * fills it.
 *
 * NOTHING HERE IS INVENTED ARTWORK. Two entries are the brand marks already in
 * `public/logo/`, uploaded as they are. The rest are set from the brand's own
 * words in the brand's own faces — the same Fraunces / Space Mono TTFs in
 * `assets/fonts/` that the print renderer uses, so a library design and a
 * customer's own text layer come out of the same typefaces on the same press.
 *
 * INK IS LIGHT, ON PURPOSE. Every colourway that can actually be ordered today
 * is Jet Black (#2B2B2F) — Hunter Green and Vanilla Ice are configured but
 * marked unavailable and have no print zones. Dark artwork on the only garment
 * a shopper can buy would be invisible, so the typographic marks are set in the
 * brand's paper tone. When a light colourway goes live these need dark
 * counterparts; that is a real follow-up, not an oversight.
 *
 * RESOLUTION IS HONEST. The generated marks are authored at 300 DPI across the
 * real 12in zone — 3600px. The two existing logo files are uploaded at their
 * native size and are NOT upscaled: `mountain-mark.png` is 1425px, which spread
 * across a full 12in front is ~119 DPI. Upsampling would manufacture detail
 * that was never there and defeat the DPI warning that exists to catch exactly
 * this. Placed smaller it is sharp, and the studio says so.
 *
 * Re-runnable: every row is upserted on `slug`, and storage uploads use upsert.
 *
 *   node scripts/seed-design-library.mjs          # write
 *   node scripts/seed-design-library.mjs --dry    # render to /tmp, write nothing
 */

import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const DRY = process.argv.includes('--dry')
const ROOT = process.cwd()
const BUCKET = 'design-uploads'

// The real front zone: 12in wide, 16in tall, and 300 DPI is the target the
// print spec already sets. Everything generated is authored to that.
const DPI = 300
const ZONE_W = 12 * DPI // 3600
const ZONE_H = 16 * DPI // 4800

// The brand's paper tone. See the header for why the ink is light.
const INK = '#FBF7EF'
const SAGE = '#7BA46F'

for (const [file, family] of [
  ['Fraunces_400Regular.ttf', 'SeedSerif'],
  ['Fraunces_600SemiBold.ttf', 'SeedSerifBold'],
  ['Fraunces_400Regular_Italic.ttf', 'SeedSerifItalic'],
  ['SpaceMono_400Regular.ttf', 'SeedMono'],
  ['SpaceMono_700Bold.ttf', 'SeedMonoBold'],
]) {
  GlobalFonts.registerFromPath(path.join(ROOT, 'assets', 'fonts', file), family)
}

/** Trim fully-transparent margins so the artwork's own bounds are its bounds. */
function trim(canvas) {
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas
  const { data } = ctx.getImageData(0, 0, w, h)
  let top = h, left = w, right = 0, bottom = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 4) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }
  if (right < left || bottom < top) return canvas
  const pad = 12
  left = Math.max(0, left - pad); top = Math.max(0, top - pad)
  right = Math.min(w - 1, right + pad); bottom = Math.min(h - 1, bottom + pad)
  const out = createCanvas(right - left + 1, bottom - top + 1)
  out.getContext('2d').drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

function centreText(ctx, text, cx, y, font, colour, tracking = 0) {
  ctx.font = font
  ctx.fillStyle = colour
  ctx.textBaseline = 'alphabetic'
  if (!tracking) {
    ctx.textAlign = 'center'
    ctx.fillText(text, cx, y)
    return
  }
  // Manual tracking: node-canvas has no letterSpacing.
  ctx.textAlign = 'left'
  const chars = [...text]
  const width = chars.reduce((s, c) => s + ctx.measureText(c).width + tracking, -tracking)
  let x = cx - width / 2
  for (const c of chars) {
    ctx.fillText(c, x, y)
    x += ctx.measureText(c).width + tracking
  }
}

// ── The generated marks ─────────────────────────────────────────────────────

function wordmark() {
  const c = createCanvas(ZONE_W, 900)
  const ctx = c.getContext('2d')
  centreText(ctx, 'DEWDROPZ', ZONE_W / 2, 560, '300 420px SeedSerif', INK, 46)
  centreText(ctx, 'UTTARAKHAND  ·  EST. SEVEN YEARS ON THE RIDGE', ZONE_W / 2, 730, '400 78px SeedMono', SAGE, 14)
  return trim(c)
}

function coordinates() {
  const c = createCanvas(ZONE_W, 1500)
  const ctx = c.getContext('2d')
  centreText(ctx, '30.3168°N', ZONE_W / 2, 420, '700 300px SeedMonoBold', INK, 4)
  centreText(ctx, '78.0322°E', ZONE_W / 2, 760, '700 300px SeedMonoBold', INK, 4)
  ctx.strokeStyle = SAGE
  ctx.lineWidth = 10
  ctx.beginPath(); ctx.moveTo(ZONE_W / 2 - 420, 900); ctx.lineTo(ZONE_W / 2 + 420, 900); ctx.stroke()
  centreText(ctx, 'DEHRADUN', ZONE_W / 2, 1080, '400 150px SeedMono', SAGE, 32)
  return trim(c)
}

function altitude() {
  const c = createCanvas(ZONE_W, 1750)
  const ctx = c.getContext('2d')
  centreText(ctx, '5,029', ZONE_W / 2, 780, '300 720px SeedSerif', INK, 8)
  centreText(ctx, 'METRES', ZONE_W / 2, 1040, '400 160px SeedMono', SAGE, 40)
  centreText(ctx, 'ROOPKUND', ZONE_W / 2, 1310, '600 190px SeedSerifBold', INK, 24)
  return trim(c)
}

function brandLine() {
  const c = createCanvas(ZONE_W, 2000)
  const ctx = c.getContext('2d')
  centreText(ctx, 'Nobody', ZONE_W / 2, 470, '300 400px SeedSerif', INK, 0)
  centreText(ctx, 'remembers', ZONE_W / 2, 930, '300 400px SeedSerif', INK, 0)
  centreText(ctx, 'the jacket.', ZONE_W / 2, 1390, '400 400px SeedSerifItalic', INK, 0)
  ctx.strokeStyle = SAGE
  ctx.lineWidth = 12
  ctx.beginPath(); ctx.moveTo(ZONE_W / 2 - 180, 1560); ctx.lineTo(ZONE_W / 2 + 180, 1560); ctx.stroke()
  return trim(c)
}

/** A ridgeline drawn from the trail guide's own altitude figures. */
function ridgeline() {
  const c = createCanvas(ZONE_W, 1400)
  const ctx = c.getContext('2d')
  // Real altitudes from the trail guide, normalised across the width.
  const peaks = [3022, 3566, 3658, 3690, 4150, 5029, 4600, 3800]
  const min = 2800, max = 5200
  const stepX = ZONE_W / (peaks.length - 1)
  const yFor = (m) => 1000 - ((m - min) / (max - min)) * 780
  ctx.strokeStyle = INK
  ctx.lineWidth = 26
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  peaks.forEach((m, i) => (i ? ctx.lineTo(i * stepX, yFor(m)) : ctx.moveTo(0, yFor(m))))
  ctx.stroke()
  // Mark the high point, the way the trail guide does.
  const hi = peaks.indexOf(Math.max(...peaks))
  ctx.fillStyle = SAGE
  ctx.beginPath(); ctx.arc(hi * stepX, yFor(peaks[hi]), 34, 0, Math.PI * 2); ctx.fill()
  centreText(ctx, 'THE GARHWAL LINE  ·  3,022M — 5,029M', ZONE_W / 2, 1240, '400 120px SeedMono', SAGE, 20)
  return trim(c)
}

/** An existing brand PNG, re-encoded untouched (no scaling). */
async function fromFile(relPath) {
  const img = await loadImage(await readFile(path.join(ROOT, relPath)))
  const c = createCanvas(img.width, img.height)
  c.getContext('2d').drawImage(img, 0, 0)
  return c
}

// ── The set ─────────────────────────────────────────────────────────────────

const SET = [
  { slug: 'mountain-mark', name: 'Mountain Mark', collection: 'DEWDROPZ MARKS',
    sort: 10, make: () => fromFile('public/logo/mountain-mark.png') },
  { slug: 'summit-mark', name: 'Summit Mark', collection: 'DEWDROPZ MARKS',
    sort: 20, make: () => fromFile('public/logo/mountain.png') },
  { slug: 'dewdropz-wordmark', name: 'Wordmark', collection: 'DEWDROPZ MARKS',
    sort: 30, make: async () => wordmark() },
  { slug: 'field-coordinates', name: 'Dehradun Coordinates', collection: 'FIELD NOTES',
    sort: 40, make: async () => coordinates() },
  { slug: 'roopkund-altitude', name: 'Roopkund 5,029m', collection: 'FIELD NOTES',
    sort: 50, make: async () => altitude() },
  { slug: 'garhwal-ridgeline', name: 'Garhwal Ridgeline', collection: 'FIELD NOTES',
    sort: 60, make: async () => ridgeline() },
  { slug: 'nobody-remembers', name: 'Nobody Remembers The Jacket', collection: 'THE LINE',
    sort: 70, make: async () => brandLine() },
]

// ── Run ─────────────────────────────────────────────────────────────────────

const db = DRY ? null : createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const outDir = '/tmp/dewdropz-design-seed'
if (DRY) await mkdir(outDir, { recursive: true })

for (const d of SET) {
  const canvas = await d.make()
  const png = canvas.toBuffer('image/png')
  const dpiAt12in = Math.round(canvas.width / 12)

  if (DRY) {
    await writeFile(path.join(outDir, `${d.slug}.png`), png)
    console.log(`${d.slug.padEnd(22)} ${String(canvas.width).padStart(5)}x${String(canvas.height).padEnd(5)} ` +
                `${(png.length / 1024).toFixed(0).padStart(4)}KB  ${dpiAt12in} DPI across a 12in front`)
    continue
  }

  const key = `library/${d.slug}.png`
  const { error: upErr } = await db.storage.from(BUCKET)
    .upload(key, png, { contentType: 'image/png', upsert: true })
  if (upErr) { console.error(`  upload failed ${d.slug}: ${upErr.message}`); process.exit(1) }
  const image_url = db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl

  const { error: rowErr } = await db.from('design_library')
    .upsert({ slug: d.slug, name: d.name, image_url, collection: d.collection, sort: d.sort, active: true },
            { onConflict: 'slug' })
  if (rowErr) { console.error(`  row failed ${d.slug}: ${rowErr.message}`); process.exit(1) }

  console.log(`${d.slug.padEnd(22)} ${String(canvas.width).padStart(5)}x${String(canvas.height).padEnd(5)} ` +
              `${dpiAt12in} DPI@12in  ->  ${image_url}`)
}

console.log(DRY ? `\nDRY RUN — ${SET.length} files written to ${outDir}, nothing uploaded`
                : `\n${SET.length} designs in the library`)
