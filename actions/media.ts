'use server'

import { requireAdmin } from './auth'
import { uploadFileAdmin, deleteFile, STORAGE_BUCKETS } from '@/lib/supabase/storage'

export type MediaBucket = keyof typeof STORAGE_BUCKETS

// storage.ts's uploadFileAdmin/deleteFile use the service-role client — they must
// never be imported into a client component (the service role key would either
// silently fail to resolve in the browser or, worse, end up bundled). Routing every
// upload/delete through this 'use server' boundary is what keeps that key server-only.
export async function uploadAdminImage(bucket: MediaBucket, file: File) {
  await requireAdmin()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  return uploadFileAdmin(STORAGE_BUCKETS[bucket], path, file, file.type || 'image/jpeg')
}

export async function deleteAdminImage(bucket: MediaBucket, url: string) {
  await requireAdmin()
  const bucketName = STORAGE_BUCKETS[bucket]
  const path = url.split(`/${bucketName}/`).pop()
  if (!path) throw new Error('Could not determine storage path from URL')
  await deleteFile(bucketName, decodeURIComponent(path))
}
