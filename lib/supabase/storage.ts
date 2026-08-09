import { createBrowserSupabaseClient } from './client'
import { createAdminSupabaseClient } from './admin'

const STORAGE_BUCKETS = {
  PRODUCTS: 'products',
  AVATARS: 'avatars',
  COLLECTIONS: 'collections',
  DESIGNS: 'design-uploads',
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
        public: true,
        fileSizeLimit: BUCKET_OVERRIDES[bucket]?.fileSizeLimit ?? 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
      })
    }
  }
}

export { STORAGE_BUCKETS }
