'use server'

import { requireAdmin } from './auth'
import { uploadFileAdmin, deleteFile, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import { rateLimit } from '@/lib/rateLimit'

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

const CUSTOMER_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
const CUSTOMER_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// The one non-admin upload path in the app — any shopper designing a
// T-shirt needs to place their own photo, so this deliberately skips
// requireAdmin(). The trust boundary is real validation instead: raster
// images only (no SVG — avoids embedded-script/parsing risk), a real size
// cap, and a random filename (never the client-supplied name).
export async function uploadCustomerImage(file: File) {
  // Unauthenticated by design — you can put a photo on a shirt before making an
  // account — and it writes a permanent public object with no cleanup. That
  // combination is worth a rate limit: 30 images per 10 minutes is far more
  // than a person iterating on one design, and stops the endpoint being free
  // permanent storage. Fails open, like every other rateLimit caller.
  const limited = await rateLimit('upload.customer-image', { limit: 30, windowSeconds: 600 })
  if (!limited.ok) throw new Error(limited.error)

  if (!CUSTOMER_UPLOAD_MIME_TYPES.includes(file.type)) {
    throw new Error('Please upload a JPEG, PNG, or WebP image.')
  }
  if (file.size > CUSTOMER_UPLOAD_MAX_BYTES) {
    throw new Error('Image is too large — please upload something under 10MB.')
  }
  const ext = file.type.split('/')[1]
  const path = `${crypto.randomUUID()}.${ext}`
  return uploadFileAdmin(STORAGE_BUCKETS.DESIGNS, path, file, file.type)
}
