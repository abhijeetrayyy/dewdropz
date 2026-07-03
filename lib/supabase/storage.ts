import { createBrowserSupabaseClient } from './client'
import { createAdminSupabaseClient } from './server'

const STORAGE_BUCKETS = {
  PRODUCTS: 'products',
  AVATARS: 'avatars',
  COLLECTIONS: 'collections',
} as const

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
  file: File | ArrayBuffer,
  contentType: string
) {
  const supabase = await createAdminSupabaseClient()
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
  const supabase = await createAdminSupabaseClient()
  
  const buckets = Object.values(STORAGE_BUCKETS)
  for (const bucket of buckets) {
    const { data: existing } = await supabase.storage.getBucket(bucket)
    if (!existing) {
      await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
      })
    }
  }
}

export { STORAGE_BUCKETS }
