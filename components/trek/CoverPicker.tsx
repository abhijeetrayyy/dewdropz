'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { uploadFile, STORAGE_BUCKETS } from '@/lib/supabase/storage'

// The photograph on a walk.
//
// The board is photograph-led now, and until this existed there was no way for
// a host to put one there — cover_urls had been on trek_plans since 055 with
// nothing on earth writing to it.
//
// One picture, not a gallery. A card shows exactly one, the walk page shows
// exactly one, and asking somebody mid-form to curate a set is how a form stops
// being finished. Multiple covers can come later if a walk page ever earns a
// gallery.
//
// Uploaded straight from the browser to Supabase Storage under the member's own
// user id, which is what the bucket's INSERT policy checks — so a host can only
// ever write into their own folder, and a file cannot be dropped onto somebody
// else's walk.
const MAX_BYTES = 6 * 1024 * 1024

export default function CoverPicker({
  userId,
  value,
  onChange,
}: {
  userId: string
  value: string | null
  onChange: (url: string | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('That is not an image.')
      return
    }
    // Checked before the upload rather than after: a phone photo is routinely
    // 8-12MB, and letting it travel before rejecting it wastes the one thing a
    // host on hill data actually has.
    if (file.size > MAX_BYTES) {
      toast.error(`That photo is ${(file.size / 1e6).toFixed(1)}MB. Six is the limit.`)
      return
    }

    setBusy(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      // Path starts with the user id because the storage policy requires it.
      const path = `${userId}/${Date.now()}.${ext}`
      const url = await uploadFile(STORAGE_BUCKETS.TREK_COVERS, path, file)
      onChange(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That did not upload.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) pick(f)
          e.target.value = ''
        }}
      />

      {value ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[6px] border border-rule">
          <Image src={value} alt="" fill sizes="(min-width: 640px) 50vw, 92vw" className="object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-ink/75 px-3 py-1 trek-label font-mono text-paper backdrop-blur-sm hover:bg-ink"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1.5 rounded-[6px] border border-dashed border-rule bg-paper-warm/40 transition-colors hover:border-forest/50 hover:bg-paper-warm disabled:opacity-60"
        >
          <span className="font-body text-sm text-text">
            {busy ? 'Uploading…' : 'Add a photograph'}
          </span>
          <span className="max-w-xs px-6 text-center font-body text-xs leading-relaxed text-mid">
            Optional, and the single biggest thing you can do to get people to come. A picture of
            the place beats a picture of the view from it.
          </span>
        </button>
      )}
    </div>
  )
}
