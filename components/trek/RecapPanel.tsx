'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { saveRecap, type TrekRecap } from '@/actions/trekRecap'
import { uploadFile, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import { BLUR_DATA_URL } from '@/lib/constants'

// What happened, afterwards.
//
// Everything else on this board is a promise about the future. A recap is the
// only thing on it that could not have been written in advance, which is what
// makes it the one piece of evidence that any of this actually happens.
//
// Read by every member, written by the host alone — enforced by RLS, so the
// condition below decides whether a composer appears, not whether anybody can
// write one.
const MAX_PHOTOS = 6
const MAX_BYTES = 6 * 1024 * 1024

export default function RecapPanel({
  planId,
  userId,
  recap,
  canWrite,
  hostName,
}: {
  planId: string
  userId: string
  recap: TrekRecap | null
  /** The host, and only once the walk has finished. */
  canWrite: boolean
  hostName: string
}) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(recap?.body ?? '')
  const [photos, setPhotos] = useState<string[]>(recap?.photo_urls ?? [])
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function addPhoto(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('That is not an image.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(`That photo is ${(file.size / 1e6).toFixed(1)}MB. Six is the limit.`)
      return
    }
    setBusy(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const url = await uploadFile(STORAGE_BUCKETS.TREK_COVERS, `${userId}/recap-${Date.now()}.${ext}`, file)
      setPhotos((p) => [...p, url])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That did not upload.')
    } finally {
      setBusy(false)
    }
  }

  function save() {
    start(async () => {
      const r = await saveRecap(planId, body, photos)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Recap saved')
      setEditing(false)
    })
  }

  if (!editing) {
    if (!recap) {
      if (!canWrite) return null
      return (
        <div>
          <p className="font-body text-sm leading-relaxed text-mid">
            This walk has been and gone. A few lines about how it went is the only proof on this
            board that any of it is real — and it is the thing somebody reads before deciding to
            come on your next one.
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 rounded-full bg-forest px-5 py-2 font-body text-[11px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-forest-mid"
          >
            Write the recap
          </button>
        </div>
      )
    }

    return (
      <div>
        {recap.photo_urls.length > 0 && (
          <ul className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {recap.photo_urls.map((u) => (
              <li key={u} className="relative aspect-[4/3] overflow-hidden rounded-sm">
                <Image src={u} alt="" fill sizes="(min-width: 640px) 30vw, 45vw"
                  placeholder="blur" blurDataURL={BLUR_DATA_URL} className="object-cover" />
              </li>
            ))}
          </ul>
        )}
        <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-text">{recap.body}</p>
        <p className="mt-2 font-body text-xs text-mid">Written by {hostName} after the walk.</p>
        {canWrite && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:text-text"
          >
            Edit
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={1200}
        placeholder="Clear all the way up. Nine of us, maggi at the temple hut, back at the cars by two."
        className="w-full rounded-sm border border-rule bg-paper px-3 py-2 font-body text-sm text-text placeholder:text-mid/60 focus:border-forest focus:outline-none"
      />

      <input ref={input} type="file" accept="image/*" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value = '' }} />

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((u) => (
            <li key={u} className="relative aspect-square overflow-hidden rounded-sm">
              <Image src={u} alt="" fill sizes="25vw" className="object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((p) => p.filter((x) => x !== u))}
                className="absolute right-1 top-1 rounded-full bg-ink/75 px-2 py-0.5 font-mono text-[9px] uppercase text-paper"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {photos.length < MAX_PHOTOS && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest underline-offset-4 hover:underline disabled:opacity-50">
            {busy ? 'Uploading…' : `+ Add a photograph (${photos.length}/${MAX_PHOTOS})`}
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={() => setEditing(false)}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid hover:text-text">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={pending || body.trim().length < 10}
          className="rounded-full bg-forest px-5 py-2 font-body text-[11px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-forest-mid disabled:opacity-40">
          {pending ? 'Saving…' : 'Save the recap'}
        </button>
      </div>
      <p className="mt-2 font-body text-xs text-mid">
        Every member can read this. Contact details are refused here as they are everywhere else.
      </p>
    </div>
  )
}
