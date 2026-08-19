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
        // THE DOUBLE HALO. A media tile that has been chosen is ringed twice —
        // a paper gap, then forest — rather than given a coloured border. Two
        // reasons it is drawn as a box-shadow: rings cost no layout, so the
        // tile does not jump six pixels the moment a photograph lands; and a
        // border laid directly against a photograph reads as a frame the
        // picture came with, while a gap reads as a selection somebody made.
        //
        // The outer ring used to be dawn. Amber on this board now means one
        // thing only — a clock is running — and a photograph a host has picked
        // is not urgent, it is settled. Forest is the colour of a decision that
        // has been made, which is exactly what a selected cover is.
        <div
          className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--r-input)]"
          style={{ boxShadow: '0 0 0 3px var(--paper), 0 0 0 6px var(--forest)' }}
        >
          <Image src={value} alt="" fill sizes="(min-width: 640px) 50vw, 92vw" className="object-cover" />
          {/* A stamp burned into the photograph, so it takes the stamp class the
              rest of the board uses rather than its own 9px mono. */}
          <span className="trek-glass-sm trek-label-xs absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-paper">
            On the card
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="trek-glass-sm absolute right-2 top-2 rounded-full px-3 py-1.5 font-body text-xs font-medium leading-none text-paper transition-colors hover:text-paper/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-[var(--r-input)] border-2 border-dashed border-rule-warm bg-paper-warm/40 transition-colors duration-200 hover:border-forest hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-60"
        >
          {/* The face of a button, so it is set like one: sentence case, body
              type, no tracking. It was 10px ember mono at 0.16em, which is a
              caption costume on the one control in this component. */}
          <span className="font-body text-[15px] font-medium leading-none text-forest">
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
