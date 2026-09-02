/**
 * Move original camera and design files out of `public/` and into the private
 * `brand-masters` bucket.
 *
 * WHY THIS EXISTS: `public/` was 42MB, and 35MB of it was three files no line of
 * code referenced — a 29MB 4K grade, a 7MB unused clip, and the untrimmed 2000px
 * logo canvas. Anything in `public/` is committed to the repo, copied into every
 * deployment, and served by the CDN to anyone who guesses the path. None of that
 * is what you want for a master you touch twice a year.
 *
 * They are not deleted, because they are the sources you re-export FROM: the
 * shipped hero loop is a 1600×900 crush of the 4K file, and the logo mark is a
 * tight crop of the 2000px canvas. Regenerating either at a new size means
 * starting from these. They go to a private bucket instead, reachable with a
 * signed URL by an admin and by nobody else.
 *
 * Idempotent: uploads use upsert, and the bucket is only created if absent.
 *
 * It also reconciles every bucket the app declares. `ensureBucketsExist()` in
 * lib/supabase/storage.ts has no caller anywhere in the repo, so two declared
 * buckets had never been created — including `rental-evidence`, which
 * actions/rentalOps.ts writes handover and return photographs to. Those uploads
 * were failing against a bucket that does not exist.
 *
 *   node scripts/archive-brand-masters.mjs           # reconcile buckets, upload masters
 *   node scripts/archive-brand-masters.mjs --prune   # ...then delete the verified local copies
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, statSync, unlinkSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const BUCKET = 'brand-masters'

// Mirrors STORAGE_BUCKETS / BUCKET_OVERRIDES / PRIVATE_BUCKETS in
// lib/supabase/storage.ts, which stays the app's source of truth. A plain .mjs
// script cannot import the TS module without a build step, so this is duplicated
// deliberately — if you add a bucket there, add it here too.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const DECLARED = [
  { name: 'products',        public: true },
  { name: 'avatars',         public: true },
  { name: 'collections',     public: true },
  { name: 'design-uploads',  public: true,  fileSizeLimit: 10485760 },
  { name: 'trek-covers',     public: true },
  { name: 'rental-evidence', public: false },
  {
    name: BUCKET,
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: [...IMAGE_TYPES, 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime'],
  },
]

// `to` is the key in the bucket. The prefixes are the only organisation this
// bucket needs — it is an archive, not a browsable library.
const MASTERS = [
  {
    from: 'public/14356650_3840_2160_60fps.mp4',
    to: 'video/hero-trek-master-3840x2160-60fps.mp4',
    type: 'video/mp4',
    note: 'Source grade for public/videos/hero-trek.mp4 (SummitHero act 4).',
  },
  {
    from: 'public/kling_20260703_VIDEO_Cinematic__1368_0.mp4',
    to: 'video/kling-cinematic-1920x1080-24fps.mp4',
    type: 'video/mp4',
    note: 'Generated clip, never shipped. Kept in case the hero act is recut.',
  },
  {
    from: 'public/logo/mountain.png',
    to: 'logo/mountain-master-2000x2000.png',
    type: 'image/png',
    note: 'Untrimmed 2000×2000 canvas. public/logo/mountain-mark.webp is its crop.',
  },
]

async function main() {
  const prune = process.argv.includes('--prune')

  // Existing buckets are left exactly as they are. This only fills in what is
  // missing — it never re-applies policy over a bucket somebody has since tuned
  // in the dashboard, and never touches a bucket the app does not declare.
  for (const b of DECLARED) {
    const { data: existing } = await db.storage.getBucket(b.name)
    if (existing) {
      console.log(`bucket ${b.name} — exists`)
      continue
    }
    const { error } = await db.storage.createBucket(b.name, {
      public: b.public,
      fileSizeLimit: b.fileSizeLimit ?? 5242880, // 5MB
      allowedMimeTypes: b.allowedMimeTypes ?? IMAGE_TYPES,
    })
    if (error) throw new Error(`createBucket ${b.name}: ${error.message}`)
    console.log(`bucket ${b.name} — CREATED (${b.public ? 'public' : 'private'})`)
  }
  console.log('')

  const uploaded = []
  for (const m of MASTERS) {
    let local
    try {
      local = statSync(m.from)
    } catch {
      console.log(`skip  ${m.from} — not present locally (already archived?)`)
      continue
    }
    const body = readFileSync(m.from)
    const { error } = await db.storage.from(BUCKET).upload(m.to, body, {
      contentType: m.type,
      upsert: true,
    })
    if (error) throw new Error(`upload ${m.to}: ${error.message}`)

    // Verify the stored object is the size we sent before anything is deleted.
    // An upload that reports success but stores a truncated object would
    // otherwise take the only copy of a master with it.
    const dir = m.to.slice(0, m.to.lastIndexOf('/'))
    const base = m.to.slice(m.to.lastIndexOf('/') + 1)
    const { data: listed, error: listErr } = await db.storage.from(BUCKET).list(dir, { search: base })
    if (listErr) throw new Error(`verify ${m.to}: ${listErr.message}`)
    const remote = listed?.find((f) => f.name === base)
    const remoteSize = remote?.metadata?.size
    if (remoteSize !== local.size) {
      throw new Error(`verify ${m.to}: stored ${remoteSize} bytes, local file is ${local.size}`)
    }
    console.log(`ok    ${m.from} -> ${BUCKET}/${m.to} (${(local.size / 1048576).toFixed(1)}MB verified)`)
    uploaded.push(m)
  }

  if (!prune) {
    console.log('\nuploads verified. re-run with --prune to remove the local copies.')
    return
  }
  for (const m of uploaded) {
    unlinkSync(m.from)
    console.log(`pruned ${m.from}`)
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
