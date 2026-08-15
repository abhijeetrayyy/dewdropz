import 'server-only'
import { randomBytes } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { sendAbandonedCartEmail } from '@/lib/email'

// How long a cart must sit untouched before it counts as abandoned. Short
// enough that the reminder still feels related to the visit, long enough that
// nobody gets emailed while they are still shopping in another tab.
export const ABANDONED_AFTER_HOURS = 6

// And how long before it is not worth chasing. A three-week-old cart is a
// stranger, and mailing them reads as spam rather than service.
export const ABANDONED_GIVE_UP_DAYS = 14

type CartRow = {
  id: string
  user_id: string
  last_activity_at: string
  profile: { email: string; full_name: string | null } | null
  items: { quantity: number; product: { name: string; price: number; slug: string } | null }[]
}

/**
 * One pass of abandoned-cart recovery.
 *
 * Deliberately not a queue or a drip campaign: it finds carts that have been
 * still for a while, emails each one once, and records that it did. The
 * `recovery_sent_at IS NULL` filter is what makes running it twice harmless —
 * the safest scheduled job is one that is safe to run again.
 */
export async function recoverAbandonedCarts({ dryRun = false }: { dryRun?: boolean } = {}) {
  const admin = createAdminSupabaseClient()
  const now = Date.now()
  const abandonedBefore = new Date(now - ABANDONED_AFTER_HOURS * 3600_000).toISOString()
  const giveUpBefore = new Date(now - ABANDONED_GIVE_UP_DAYS * 86_400_000).toISOString()

  const { data, error } = await admin
    .from('carts')
    .select(`
      id, user_id, last_activity_at,
      profile:profiles!inner(email, full_name),
      items:cart_items(quantity, product:products(name, price, slug))
    `)
    .is('recovery_sent_at', null)
    .not('user_id', 'is', null)
    .lt('last_activity_at', abandonedBefore)
    .gt('last_activity_at', giveUpBefore)
    .order('last_activity_at', { ascending: true })
    .limit(100) // a bounded pass; the next run picks up the rest

  if (error) return { error: error.message, considered: 0, emailed: 0, skipped: 0 }

  const carts = (data ?? []) as unknown as CartRow[]
  let emailed = 0
  let skipped = 0

  for (const cart of carts) {
    // An empty cart is not an abandoned cart — it is a converted one, or one
    // the customer cleared on purpose. Either way there is nothing to say.
    const items = (cart.items ?? []).filter((i) => i.product)
    if (items.length === 0 || !cart.profile?.email) { skipped++; continue }

    // Checked before anything is written. A dry run that stamped the carts it
    // reported would consume exactly the ones the operator was previewing, and
    // the real run afterwards would find nothing.
    if (dryRun) { emailed++; continue }

    const token = randomBytes(24).toString('base64url')

    // Stamped BEFORE sending. If the send throws, the customer gets no email —
    // annoying but harmless. Stamping after would mean a mail that goes out and
    // a flag that never lands, and the next run mails them again.
    const { error: stampError } = await admin
      .from('carts')
      .update({ recovery_token: token, recovery_sent_at: new Date().toISOString() })
      .eq('id', cart.id)
      .is('recovery_sent_at', null) // loses the race rather than double-sending
    if (stampError) { skipped++; continue }

    try {
      await sendAbandonedCartEmail({
        email: cart.profile.email,
        name: cart.profile.full_name,
        recoveryUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://dewdropz.shop'}/cart/recover/${token}`,
        items: items.map((i) => ({
          name: i.product!.name,
          quantity: i.quantity,
          price: i.product!.price,
        })),
      })
      emailed++
    } catch {
      // The flag stays set. One missed reminder beats a mail loop.
      skipped++
    }
  }

  return { considered: carts.length, emailed, skipped }
}

/**
 * Redeem a recovery link. Returns the cart's lines so the storefront can put
 * them back in the customer's local cart — the emailed link has to survive a
 * new device or a cleared browser, which a link to /cart alone would not.
 */
export async function redeemRecoveryToken(token: string) {
  const admin = createAdminSupabaseClient()

  const { data: cart } = await admin
    .from('carts')
    .select(`
      id, recovered_at,
      items:cart_items(quantity, variant_id, product:products(slug, name, price, images, is_active), variant:product_variants(name))
    `)
    .eq('recovery_token', token)
    .maybeSingle()

  if (!cart) return null

  // Stamped on first open only, so the number means "carts recovered", not
  // "times the link was clicked".
  if (!cart.recovered_at) {
    await admin.from('carts').update({ recovered_at: new Date().toISOString() }).eq('id', cart.id)
  }

  type Item = {
    quantity: number
    product: { slug: string; name: string; price: number; images: string[] | null; is_active: boolean } | null
    variant: { name: string } | null
  }

  return {
    lines: ((cart.items ?? []) as unknown as Item[])
      // A product pulled from sale since the email went out must not reappear in
      // the cart at a price we are no longer offering.
      .filter((i) => i.product?.is_active)
      .map((i) => ({
        slug: i.product!.slug,
        name: i.product!.name,
        price: i.product!.price,
        image: i.product!.images?.[0] ?? '',
        // Variant names are compound ("S / Sage"); the local cart only tracks
        // the size half.
        size: i.variant?.name?.split('/')[0]?.trim() ?? '',
        quantity: i.quantity,
      })),
  }
}
