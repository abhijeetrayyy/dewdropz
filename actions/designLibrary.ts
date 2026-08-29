'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { uploadFileAdmin, deleteFile, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import type { LibraryDesign } from '@/types/database'

/**
 * The DEWDROPZ design library.
 *
 * "There will be two options: customer can select from our pre-set design ready
 * library of DEWDROPZ and second — customer can upload their own design."
 *
 * The second option is the studio's `uploadCustomerImage` and has existed since
 * it shipped. This module is the first: artwork DEWDROPZ has drawn, offered in
 * the studio's Library panel and dropped straight onto the garment. It is the
 * same code path an upload takes once the URL exists — `FabricImage.fromURL` —
 * so a library design behaves exactly like the customer's own image from the
 * moment it lands: movable, scalable, exported at print resolution.
 *
 * Reads are public and unauthenticated: this is a catalogue we are advertising.
 * Writes are admin-only and go through the service-role client, which is why
 * `design_library` carries a SELECT policy and no write policies at all.
 */

/** Every design the studio should offer, in admin order. Public. */
export async function getDesignLibrary(): Promise<LibraryDesign[]> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('design_library')
    .select('*')
    .eq('active', true)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: false })

  // A library that cannot be read is not an error worth breaking the studio
  // over — the customer still has the upload door, which is what they had
  // before this existed. The panel renders its empty state instead.
  if (error) return []
  return (data ?? []) as LibraryDesign[]
}

/** Everything, including switched-off rows. Admin only. */
export async function getAllDesigns(): Promise<LibraryDesign[]> {
  await requireAdmin()
  const { data, error } = await createAdminSupabaseClient()
    .from('design_library')
    .select('*')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as LibraryDesign[]
}

const DESIGN_MIME_TYPES = ['image/png', 'image/webp', 'image/jpeg']
const DESIGN_MAX_BYTES = 10 * 1024 * 1024

/**
 * Upload one piece of library artwork and record it.
 *
 * PNG is the useful format and the reason is worth stating: the studio drops
 * this onto garments in eight colourways, so anything with a baked-in white
 * rectangle behind it is only usable on one of them. JPEG is accepted because
 * refusing a photographic design outright would be worse than letting an admin
 * see the result and choose again.
 */
export async function createLibraryDesign(input: {
  name: string
  collection: string
  sort: number
  file: File
}): Promise<{ ok: true; design: LibraryDesign } | { ok: false; error: string }> {
  await requireAdmin()

  const name = input.name.trim()
  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: 'Give the design a name of 80 characters or fewer.' }
  }
  if (!DESIGN_MIME_TYPES.includes(input.file.type)) {
    return { ok: false, error: 'Upload a PNG, WebP or JPEG. PNG with a transparent background works best.' }
  }
  if (input.file.size > DESIGN_MAX_BYTES) {
    return { ok: false, error: 'That file is over 10MB — please compress it first.' }
  }

  // Slugs have to survive the CHECK constraint in migration 092
  // (`^[a-z0-9][a-z0-9-]{1,60}$`), and they have to be unique. The random tail
  // does the second job without asking the admin to think about it.
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const slug = `${base || 'design'}-${crypto.randomUUID().slice(0, 6)}`

  const ext = input.file.type.split('/')[1]
  let image_url: string
  try {
    image_url = await uploadFileAdmin(
      STORAGE_BUCKETS.DESIGNS,
      `library/${slug}.${ext}`,
      input.file,
      input.file.type
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not upload that file.' }
  }

  const { data, error } = await createAdminSupabaseClient()
    .from('design_library')
    .insert({
      name,
      slug,
      image_url,
      collection: input.collection.trim() || 'DEWDROPZ',
      sort: Number.isFinite(input.sort) ? input.sort : 100,
    })
    .select()
    .single()

  if (error) {
    // The row failed, so the object is now unreferenced. Leaving it behind is
    // how a storage bucket quietly fills with files nothing points at.
    await deleteFile(STORAGE_BUCKETS.DESIGNS, `library/${slug}.${ext}`).catch(() => {})
    return { ok: false, error: error.message }
  }

  revalidateDesignSurfaces()
  return { ok: true, design: data as LibraryDesign }
}

export async function updateLibraryDesign(
  id: string,
  patch: Partial<Pick<LibraryDesign, 'name' | 'collection' | 'sort' | 'active' | 'blank_ids'>>
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()

  // `blank_ids` decides which garments this artwork is offered on, and an empty
  // array means EVERY garment (094). Two things have to be true before it is
  // written: the ids must be real customizable blanks, and duplicates must not
  // accumulate — an array column has no unique constraint to lean on.
  const clean: Record<string, unknown> = { ...patch }
  if (patch.blank_ids) {
    const wanted = [...new Set(patch.blank_ids)]
    if (wanted.length > 0) {
      const { data: real } = await createAdminSupabaseClient()
        .from('products')
        .select('id')
        .in('id', wanted)
        .eq('is_customizable', true)
        .is('deleted_at', null)
      const realIds = new Set((real ?? []).map((r) => r.id as string))
      const unknown = wanted.filter((w) => !realIds.has(w))
      if (unknown.length > 0) {
        return { ok: false, error: 'One of those garments is no longer a customizable blank.' }
      }
      clean.blank_ids = wanted
    } else {
      clean.blank_ids = []
    }
  }

  const { error } = await createAdminSupabaseClient()
    .from('design_library')
    .update(clean)
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidateDesignSurfaces()
  return { ok: true }
}

/**
 * The blanks an admin can restrict a design to.
 *
 * Same filter the storefront and the studio use — customizable, with real
 * colourways. A blank with no print zones would be an option that changes
 * nothing, because no studio session can ever be opened on it.
 */
export async function getBlanksForDesignScoping(): Promise<
  { id: string; name: string }[]
> {
  await requireAdmin()
  const { data } = await createAdminSupabaseClient()
    .from('products')
    .select('id,name,customization_config')
    .eq('is_customizable', true)
    .is('deleted_at', null)
    .order('name')

  return (data ?? [])
    .filter((b) => {
      const cfg = b.customization_config as { colors?: unknown[] } | null
      return (cfg?.colors?.length ?? 0) > 0
    })
    .map(({ id, name }) => ({ id, name: name as string }))
}

export async function deleteLibraryDesign(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  const db = createAdminSupabaseClient()

  const { data: existing } = await db
    .from('design_library')
    .select('image_url')
    .eq('id', id)
    .single()

  const { error } = await db.from('design_library').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  // Best effort, and after the row is gone: a stranded object costs storage,
  // whereas a row pointing at a deleted object is a broken image in the studio.
  // If only one of the two can happen, this is the right order for it.
  if (existing?.image_url) {
    const path = (existing.image_url as string).split(`/${STORAGE_BUCKETS.DESIGNS}/`).pop()
    if (path) await deleteFile(STORAGE_BUCKETS.DESIGNS, decodeURIComponent(path)).catch(() => {})
  }

  revalidateDesignSurfaces()
  return { ok: true }
}

/** Every page whose content changes when the library does. */
function revalidateDesignSurfaces() {
  revalidatePath('/customize')
  revalidatePath('/admin/designs')
}
