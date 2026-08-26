'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Loader2, X } from 'lucide-react'
import { getDesignLibrary } from '@/actions/designLibrary'
import type { LibraryDesign } from '@/types/database'

/**
 * The DEWDROPZ design library, as a picker inside the studio.
 *
 * The brief asks for two doors into customisation — "select from our pre-set
 * design ready library" or "upload their own design" — and the studio only ever
 * had the second. This is the first.
 *
 * It deliberately does NOT try to be a second editor. A design lands on the
 * canvas exactly the way an uploaded image does, through the same
 * `FabricImage.fromURL` path, so from the moment it arrives it is movable,
 * scalable, deletable and exported at print resolution like anything else. The
 * only difference between the two doors is where the URL came from.
 *
 * Designs load when the panel is first opened, not on studio mount: a shopper
 * who brings their own artwork should never pay for a catalogue they are not
 * going to look at.
 */
export default function DesignLibraryPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  /** Given the artwork's public URL. The caller owns placing it. */
  onPick: (url: string, name: string) => void
}) {
  const [designs, setDesigns] = useState<LibraryDesign[] | null>(null)
  // Derived, not a second piece of state. `null` means "not fetched yet", so
  // an open panel with nothing in it IS the loading state — and deriving it
  // also avoids the synchronous setState in an effect that the lint rule
  // (rightly) refuses: the only setState below happens in a promise callback.
  const loading = open && designs === null

  useEffect(() => {
    if (!open || designs !== null) return
    let cancelled = false
    getDesignLibrary()
      .then((rows) => {
        if (!cancelled) setDesigns(rows)
      })
      // The action already swallows read errors into an empty list; this covers
      // the transport failing. Either way the shopper still has the upload
      // door, so an empty shelf is the right failure — not a broken studio.
      .catch(() => {
        if (!cancelled) setDesigns([])
      })
    return () => {
      cancelled = true
    }
  }, [open, designs])

  // Escape closes it. The canvas underneath binds Delete and arrow keys, so a
  // panel sitting over it has to take the keyboard seriously.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // Grouped by design collection, in the order the admin sorted them — the
  // brief's "choose from our DEWDROPZ design collections", plural, is the
  // whole reason the column exists.
  const groups = new Map<string, LibraryDesign[]>()
  for (const d of designs ?? []) {
    const list = groups.get(d.collection) ?? []
    list.push(d)
    groups.set(d.collection, list)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="DEWDROPZ design library"
      onClick={onClose}
    >
      <div
        // The backdrop closes on click; the panel must not, or every attempt to
        // scroll the shelf would dismiss it.
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-lg border border-[var(--st-edge)] bg-[var(--st-panel)] sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--st-edge)] px-5 py-4">
          <div>
            <h2 className="font-body text-[13px] uppercase tracking-[0.14em] text-[var(--st-ink)]">
              The DEWDROPZ library
            </h2>
            <p className="mt-1 font-body text-[12px] leading-relaxed text-[var(--st-ink-3)]">
              Choose from our DEWDROPZ design collections — or close this and upload your own.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the library"
            className="-mr-1 -mt-1 rounded-sm p-2 text-[var(--st-ink-3)] transition-colors hover:text-[var(--st-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="flex items-center gap-2 font-body text-[12px] text-[var(--st-ink-3)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening the library…
            </div>
          )}

          {!loading && designs?.length === 0 && (
            <p className="font-body text-[12.5px] leading-relaxed text-[var(--st-ink-3)]">
              There is nothing in the library yet. Close this and upload your own artwork —
              the studio works exactly the same either way.
            </p>
          )}

          {!loading &&
            [...groups.entries()].map(([collection, items]) => (
              <section key={collection} className="mb-7 last:mb-0">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--st-ink-3)]">
                  {collection}
                </h3>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {items.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => onPick(d.image_url, d.name)}
                        className="group block w-full overflow-hidden rounded-sm border border-[var(--st-edge)] bg-[var(--st-raise)] text-left transition-colors hover:border-[var(--st-accent)]"
                      >
                        {/* Checkerboard, because most of these are PNGs with
                            transparent grounds and a transparent design on a
                            dark panel looks like an empty tile. */}
                        <div
                          className="relative aspect-square"
                          style={{
                            backgroundImage:
                              'linear-gradient(45deg,rgba(255,255,255,0.07) 25%,transparent 25%,transparent 75%,rgba(255,255,255,0.07) 75%),linear-gradient(45deg,rgba(255,255,255,0.07) 25%,transparent 25%,transparent 75%,rgba(255,255,255,0.07) 75%)',
                            backgroundSize: '14px 14px',
                            backgroundPosition: '0 0, 7px 7px',
                          }}
                        >
                          <Image
                            src={d.image_url}
                            alt={d.name}
                            fill
                            sizes="(max-width: 640px) 45vw, 180px"
                            className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                        <span className="block truncate px-2.5 py-2 font-body text-[11.5px] text-[var(--st-ink-2)] group-hover:text-[var(--st-ink)]">
                          {d.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </div>
    </div>
  )
}
