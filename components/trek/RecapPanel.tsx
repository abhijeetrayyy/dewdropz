'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { saveRecap, type TrekRecap } from '@/actions/trekRecap'
import { getVouchable, vouchFor } from '@/actions/trekBuddy'
import { uploadFile, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import { BLUR_DATA_URL } from '@/lib/constants'
import Avatar from '@/components/trek/ui/Avatar'
import { SectionLabel } from '@/components/trek/ui/Bits'

// What happened, afterwards.
//
// Everything else on this board is a promise about the future. A recap is the
// only thing on it that could not have been written in advance, which is what
// makes it the one piece of evidence that any of this actually happens.
//
// Read by every member, written by the host alone — enforced by RLS, so the
// condition below decides whether a composer appears, not whether anybody can
// write one.
//
// SO IT IS SET AS EVIDENCE, NOT AS A POST. Three things changed and each one
// is the same argument: the photographs are a wall rather than a row of
// thumbnails and they run at full opacity, because every other photograph on
// the product sits under a scrim and these are the only ones that are proof;
// the vouch prompts live here rather than only on the profile page, because a
// vouch is a thing you write about a walk while you can still remember it, and
// the profile is not where you are when it is fresh; and the host is offered
// the next one, because the moment somebody has just had a good day out is the
// moment they will post another.
//
// WHAT CHANGED IN THIS PASS. Almost every word on this panel was in monospace
// capitals at wide tracking: the completed stamp, the edit link, the vouch
// button, the add-a-photograph control, cancel, and the heading on the
// do-it-again card. None of those is a figure and four of them are things you
// press, which is the two rules the board now holds hardest. They are sentence
// case in Inter, and mono is left on the three things here that are actually
// quantities — the recap's date, the photograph's position in the wall, and
// nothing else.
//
// The do-it-again card also stopped being a solid amber gradient. Amber on this
// board means a clock is running, and "post another walk" is the least urgent
// thing on the product — it is an invitation, weeks out, to somebody in a good
// mood. It sits on the sage wash now, with the forest act pill it should have
// had, and the one saturated panel is off a page whose whole subject is a day
// that already went well.
const MAX_PHOTOS = 6
const MAX_BYTES = 6 * 1024 * 1024

/** The wall. Two items break the grid so it reads as a contact sheet pinned up
 *  rather than as a gallery — the same six-slot rhythm the design measures. */
const WALL_SPANS = [
  'col-span-2 row-span-2',
  '',
  '',
  'sm:col-span-2',
  '',
  'sm:row-span-2',
]

type VouchPerson = { user_id: string; display_name: string; vouched: boolean }

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
  const [party, setParty] = useState<VouchPerson[]>([])
  const input = useRef<HTMLInputElement>(null)

  const hasRecap = Boolean(recap)

  // Who you can vouch for, asked for at the one moment it is worth asking.
  // `getVouchable` already answers "which past walks were you actually on, and
  // who else was there" for the profile page; this reads the same answer and
  // keeps the row for this walk. A viewer who was not on it gets nothing back,
  // so the block simply does not appear — the list is the permission.
  useEffect(() => {
    if (!hasRecap) return
    let live = true
    getVouchable()
      .then((rows) => {
        if (!live) return
        setParty(rows.find((r) => r.planId === planId)?.people ?? [])
      })
      .catch(() => {
        // A failed lookup costs a block that is an invitation, not a control.
        // Shouting about it would be louder than the thing it is offering.
      })
    return () => {
      live = false
    }
  }, [hasRecap, planId])

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

  function vouch(person: VouchPerson) {
    start(async () => {
      const r = await vouchFor(planId, person.user_id)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      setParty((p) => p.map((x) => (x.user_id === person.user_id ? { ...x, vouched: true } : x)))
      toast.success(`Vouched for ${person.display_name}`)
    })
  }

  if (!editing) {
    if (!recap) {
      if (!canWrite) return null
      return (
        <div>
          <p className="font-body text-[14px] leading-relaxed text-mid">
            This walk has been and gone. A few lines about how it went is the only proof on this
            board that any of it is real — and it is the thing somebody reads before deciding to
            come on your next one.
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="trek-pill trek-pill-act mt-4 font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            Write the recap
          </button>
        </div>
      )
    }

    return (
      <div>
        {/* Sage on sage, because completion is the one thing this product
            colours green. Forest rather than sage for the type — sage on a
            sage wash measures under AA and this is a claim worth reading.
            "Completed" is a state, so it is set in sentence case; the date
            beside it is a figure, so it keeps the mono. */}
        <p className="inline-flex items-center gap-2 rounded-full border border-forest/25 bg-sage-soft px-3.5 py-1.5 font-body text-[13px] font-medium leading-none text-forest">
          <span aria-hidden="true">✓</span>
          Completed
          <span className="font-mono text-[12px] text-forest/75 tabular-nums">
            ·{' '}
            {new Date(recap.created_at).toLocaleDateString('en-IN', {
              timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
            })}
          </span>
        </p>

        {recap.photo_urls.length > 0 && (
          <ul
            className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
            style={{ gridAutoRows: '180px' }}
          >
            {recap.photo_urls.map((u, i) => (
              <li
                key={u}
                className={`relative overflow-hidden rounded-[var(--r-card)] bg-ink ${
                  WALL_SPANS[i % WALL_SPANS.length]
                }`}
              >
                {/* No scrim and no dimming. Every other photograph on the
                    product is held back under an hour tint; these are the
                    evidence, so they are the only ones shown whole. */}
                <Image
                  src={u}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 30vw, 45vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover"
                />
                <span className="trek-glass-sm absolute bottom-2.5 left-2.5 rounded-[var(--r-stamp)] px-2 py-1 font-mono text-[10px] leading-none text-paper tabular-nums">
                  {i + 1} of {recap.photo_urls.length}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 whitespace-pre-wrap font-body text-[15px] leading-relaxed text-text">
          {recap.body}
        </p>
        <p className="mt-2 font-body text-[13px] text-mid">Written by {hostName} after the walk.</p>

        {canWrite && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 border-b border-rule pb-1 font-body text-[13px] text-mid transition-colors hover:border-forest hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            Edit
          </button>
        )}

        {/* ── Vouching, while it is fresh ──────────────────────────────────
            On ink, because it is the only act on this page and it should not
            read as one more paragraph about the day. */}
        {party.length > 0 && (
          <section className="mt-8 rounded-[var(--r-panel)] bg-ink p-6 md:p-7">
            <SectionLabel as="h3" tone="trust">
              Close the loop — vouch while it is fresh
            </SectionLabel>
            <p className="mt-2.5 max-w-[520px] font-body text-[14px] leading-relaxed text-paper/70">
              Only you can say this, and only about someone who was actually out with you. It is
              the strongest thing on their profile, so mean it.
            </p>
            <ul className="mt-5 space-y-2.5">
              {party.map((p) => (
                <li
                  key={p.user_id}
                  className="flex flex-wrap items-center gap-3.5 rounded-[var(--r-card)] border border-paper/12 px-4.5 py-3.5"
                >
                  <Avatar
                    name={p.display_name}
                    id={p.user_id}
                    size={40}
                    ground="dark"
                    href={`/trek-buddy/people/${p.user_id}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[15px] text-paper">{p.display_name}</p>
                    <p className="mt-0.5 font-body text-[12.5px] leading-relaxed text-paper/55">
                      was out with you on this one
                    </p>
                  </div>
                  {/* Sentence case: this button both states a state and is a
                      thing you press, and it was doing both in 10px capitals
                      at 0.1em. */}
                  <button
                    type="button"
                    disabled={pending || p.vouched}
                    onClick={() => vouch(p)}
                    className={`trek-pill trek-pill-sm font-body transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
                      p.vouched
                        ? 'border border-sage/40 bg-sage/15 text-sage disabled:opacity-100'
                        : 'border border-paper/25 text-paper/80 hover:border-sage hover:text-sage disabled:opacity-40'
                    }`}
                  >
                    {p.vouched ? 'Vouched ✓' : 'Vouch'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Do it again ──────────────────────────────────────────────────
            A host reading their own recap has just had the day that makes them
            want another, so this is the one moment on the product where asking
            for the next walk is not a nag. It sits on the sage wash rather than
            the amber gradient it used to be: amber is a clock now, and there is
            no clock on this. The invite card is named rather than a re-host
            mechanism promised — sending the roster the link is what actually
            exists, and the copy says only that. */}
        {canWrite && (
          <div className="mt-4 rounded-[var(--r-panel)] border border-forest/20 bg-sage-soft/60 p-6">
            <h3 className="trek-label text-forest">Do it again</h3>
            <p className="trek-h3 mt-2.5 text-text">
              Same crew, next ridge? Post the next one and send this lot the invite card first.
            </p>
            <Link
              href="/trek-buddy/new"
              className="trek-pill trek-pill-act mt-4 font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              Post another walk
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <label className="sr-only" htmlFor="recap-body">How it went</label>
      <textarea
        id="recap-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={1200}
        placeholder="Clear all the way up. Nine of us, maggi at the temple hut, back at the cars by two."
        className="w-full resize-y rounded-[var(--r-card)] border border-rule bg-paper px-4 py-3 font-body text-sm leading-relaxed text-text placeholder:text-mid/60 focus:border-forest focus:outline-none"
      />

      <input ref={input} type="file" accept="image/*" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value = '' }} />

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {photos.map((u) => (
            <li key={u} className="relative aspect-square overflow-hidden rounded-[var(--r-input)]">
              <Image src={u} alt="" fill sizes="25vw" className="object-cover" />
              <button
                type="button"
                aria-label="Remove this photograph"
                onClick={() => setPhotos((p) => p.filter((x) => x !== u))}
                className="trek-glass-sm absolute right-1 top-1 rounded-full px-2 py-0.5 font-body text-[13px] leading-tight text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
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
            className="font-body text-[13px] font-medium text-forest underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-50">
            {busy ? 'Uploading…' : `+ Add a photograph (${photos.length}/${MAX_PHOTOS})`}
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={() => setEditing(false)}
          className="font-body text-[13px] text-mid transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={pending || body.trim().length < 10}
          className="trek-pill trek-pill-act font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40">
          {pending ? 'Saving…' : 'Save the recap'}
        </button>
      </div>
      {/* A rule about what happens to what you type, kept at reading size —
          "every member can read this" is not a footnote. */}
      <p className="mt-3 font-body text-[13px] leading-relaxed text-mid">
        Every member can read this. Contact details are refused here as they are everywhere else.
      </p>
    </div>
  )
}
