import { NextRequest, NextResponse } from 'next/server'
import { uploadFileAdmin, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import { mobileUploadSchema } from '@/lib/validations'

// Shoppers pick photos from their camera roll, but the studio can't write to
// storage itself (that needs the service-role key). It posts the image here,
// gets a public URL back, and stores that URL in the design layer — which is
// what lets the design renderer fetch the artwork later.
//
// Deliberately unauthenticated, matching the web app's uploadCustomerImage:
// designing is allowed before signing in. The trust boundary is validation,
// not identity — real magic-byte sniffing, a hard size cap, raster formats
// only (no SVG, which can carry script), and a random server-side filename.

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
]

const MAX_BYTES = 10 * 1024 * 1024

// MULTIPART FIRST, BASE64 AS A FALLBACK.
//
// The app used to read the whole picked photo with
// `FileSystem.readAsStringAsync(uri, { encoding: 'base64' })` and post it inside
// a JSON body. Three problems, in increasing order of seriousness:
//
//   · base64 inflates by about a third, so the 10MB image this endpoint
//     accepts arrived as a ~13.3MB request body;
//   · that whole string existed at once in the phone's JS heap AND again in the
//     request, which on a low-end Android is a real out-of-memory;
//   · `next.config.ts` sets `serverActions.bodySizeLimit: '12mb'`, which does
//     NOT apply to route handlers, and most hosts cap a request body far lower
//     — so a large photo would have failed in production while passing locally.
//
// A multipart body streams the bytes as bytes. The base64 branch is kept so an
// older build of the app keeps working rather than silently losing uploads.
async function readUpload(request: NextRequest): Promise<Buffer | { error: string }> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof Blob)) return { error: 'No image was attached.' }
    return Buffer.from(await file.arrayBuffer())
  }

  const body = await request.json().catch(() => null)
  const parsed = mobileUploadSchema.safeParse(body)
  if (!parsed.success) return { error: 'Could not read that image.' }
  try {
    return Buffer.from(parsed.data.data.replace(/^data:[^;]+;base64,/, ''), 'base64')
  } catch {
    return { error: 'Could not read that image.' }
  }
}

export async function POST(request: NextRequest) {
  const read = await readUpload(request)
  if (!Buffer.isBuffer(read)) {
    return NextResponse.json({ error: read.error }, { status: 400 })
  }
  const buf = read

  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Please pick an image under 10MB.' }, { status: 400 })
  }

  // Trust the bytes, not the declared content type.
  const match = SIGNATURES.find((s) => s.test(buf))
  if (!match) {
    return NextResponse.json({ error: 'Please pick a JPEG, PNG, or WebP image.' }, { status: 400 })
  }

  try {
    const url = await uploadFileAdmin(
      STORAGE_BUCKETS.DESIGNS,
      `${crypto.randomUUID()}.${match.ext}`,
      buf,
      match.mime
    )
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'Could not store that image.' }, { status: 502 })
  }
}
