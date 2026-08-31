import { createBrowserSupabaseClient } from './client'
import { createAdminSupabaseClient } from './admin'

const STORAGE_BUCKETS = {
  PRODUCTS: 'products',
  AVATARS: 'avatars',
  COLLECTIONS: 'collections',
  DESIGNS: 'design-uploads',
  TREK_COVERS: 'trek-covers',
  // Handover and return photographs on a rental. Private, unlike every other
  // bucket here: this is evidence in a dispute the shop may be having with the
  // person it would be showing it to, and a return set can have other people's
  // gear in frame. Served through a signed URL by an admin, never by public URL.
  RENTAL_EVIDENCE: 'rental-evidence',
} as const

// Per-bucket overrides for ensureBucketsExist — everything defaults to the
// 5MB/raster-image policy below except where noted (customer design uploads
// are often large photos, so they get more headroom).
const BUCKET_OVERRIDES: Partial<Record<(typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS], { fileSizeLimit: number }>> = {
  [STORAGE_BUCKETS.DESIGNS]: { fileSizeLimit: 10485760 }, // 10MB
}

type BucketName = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]

export async function uploadFile(
  bucket: BucketName,
  filePath: string,
  file: File,
  upsert = true
) {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { upsert })

  if (error) throw error
  return getPublicUrl(bucket, data.path)
}

export async function uploadFileAdmin(
  bucket: BucketName,
  filePath: string,
  // Uint8Array covers Node Buffers, which is what server routes get after
  // base64-decoding an upload from a native client.
  file: File | ArrayBuffer | Uint8Array,
  contentType: string
) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType,
      upsert: true,
    })

  if (error) throw error
  return getPublicUrl(bucket, data.path)
}

export function getPublicUrl(bucket: BucketName, path: string) {
  const supabase = createBrowserSupabaseClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteFile(bucket: BucketName, path: string) {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}

export async function listFiles(bucket: BucketName, prefix?: string) {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix ?? '')

  if (error) throw error
  return data.map((file) => ({
    ...file,
    publicUrl: getPublicUrl(bucket, prefix ? `${prefix}/${file.name}` : file.name),
  }))
}

export async function ensureBucketsExist() {
  const supabase = createAdminSupabaseClient()
  
  const buckets = Object.values(STORAGE_BUCKETS)
  for (const bucket of buckets) {
    const { data: existing } = await supabase.storage.getBucket(bucket)
    if (!existing) {
      await supabase.storage.createBucket(bucket, {
        // Everything here is a shop window except the rental evidence, which is
        // a private record. A public bucket means a guessable URL is the whole
        // access control, and that is the wrong answer for a photograph taken
        // to settle an argument about money.
        public: bucket !== STORAGE_BUCKETS.RENTAL_EVIDENCE,
        fileSizeLimit: BUCKET_OVERRIDES[bucket]?.fileSizeLimit ?? 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
      })
    }
  }
}

/**
 * A time-limited URL for an object in a private bucket.
 *
 * Rental evidence lives in the one bucket here that is not public, so there is
 * no `getPublicUrl` for it — by design. The caller is responsible for having
 * checked that whoever is about to see this is allowed to.
 */
export async function getSignedUrl(bucket: BucketName, path: string, expiresInSeconds = 600) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
  if (error || !data) return null
  return data.signedUrl
}

export { STORAGE_BUCKETS }
